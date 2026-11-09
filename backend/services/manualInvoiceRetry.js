const crypto=require('crypto');
const {savedCards,idOf,invoiceExpand}=require('./cardFallback');
function retryEligibility(invoice,item) {
  if(!(invoice.subscription||invoice.parent?.subscription_details?.subscription))return 'not_subscription';
  if(!['open','uncollectible'].includes(invoice.status)||invoice.amount_remaining<=0)return 'already_paid_or_closed';
  if(invoice.currency!==item.currency||invoice.amount_remaining>item.maxAmount)return 'invoice_amount_changed';
  const payment=invoice.payment_intent;
  if(!payment||typeof payment!=='object')return 'payment_state_unknown';
  if(['processing','succeeded','requires_capture'].includes(payment.status))return 'payment_already_processing';
  if(!['requires_payment_method','requires_confirmation','requires_action'].includes(payment.status))return 'payment_state_unknown';
  return null;
}
function orderedCards(invoice,cards) {
  const priority=[idOf(invoice.default_payment_method),idOf(invoice.subscription?.default_payment_method),
    idOf(invoice.payment_intent?.payment_method),idOf(invoice.payment_intent?.last_payment_error?.payment_method)].filter(Boolean);
  const sorted=[...cards].sort((a,b)=>{
    const pa=priority.indexOf(a.id),pb=priority.indexOf(b.id);return (pa<0?999:pa)-(pb<0?999:pb);
  });
  const seen=new Set();
  return sorted.filter(card=>{const key=card.card.fingerprint||card.id;if(seen.has(key))return false;seen.add(key);return true;});
}
async function retryInvoiceOnce({stripe,batchId,accountId,item,ledger,allowed,recordPaid,now=Date.now}) {
  let invoice=await stripe.invoices.retrieve(item.invoiceId,{expand:invoiceExpand},{timeout:15000,maxNetworkRetries:0});
  let reason=retryEligibility(invoice,item);if(reason)return {state:'skipped',reason,attempts:0};
  if(await ledger.blocked(accountId,item.invoiceId,batchId))return {state:'review',reason:'previous_payment_outcome_unknown',attempts:0};
  const customer=idOf(invoice.customer);
  if(!customer)return {state:'skipped',reason:'no_customer',attempts:0};
  const cards=orderedCards(invoice,await savedCards(stripe,customer,now()));
  let attempts=await ledger.count(batchId,item.invoiceId);
  for(const card of cards){
    if(!await allowed())return {state:'pending',reason:'run_stopped',attempts};
    const cardKey=card.card.fingerprint||card.id;
    if(await ledger.seen(batchId,item.invoiceId,cardKey))continue;
    invoice=await stripe.invoices.retrieve(item.invoiceId,{expand:invoiceExpand},{timeout:15000,maxNetworkRetries:0});
    reason=retryEligibility(invoice,item);if(reason)return {state:'skipped',reason,attempts};
    if(idOf(invoice.customer)!==customer)return {state:'review',reason:'customer_changed',attempts};
    if(!await allowed())return {state:'pending',reason:'run_stopped',attempts};
    const key={batchId,invoiceId:item.invoiceId,cardKey};
    if(!await ledger.claim({...key,accountId,methodId:card.id,brand:card.card.brand,last4:card.card.last4,amount:invoice.amount_remaining,currency:invoice.currency,status:'pending'}))return {state:'review',reason:'concurrent_attempt',attempts};
    attempts++;
    const idempotencyKey='manual-batch-v1-'+crypto.createHash('sha256').update(`${batchId}:${item.invoiceId}:${cardKey}`).digest('hex');
    let paid;
    try{
      paid=await stripe.invoices.pay(item.invoiceId,{payment_method:card.id,off_session:true,expand:['payment_intent']},{idempotencyKey,timeout:20000,maxNetworkRetries:0});
    }catch(error){
      let payment=error.payment_intent||error.raw?.payment_intent;
      if(error.type==='StripeCardError'&&(!payment||typeof payment!=='object')){
        payment=(await stripe.invoices.retrieve(item.invoiceId,{expand:['payment_intent']},{timeout:15000,maxNetworkRetries:0})).payment_intent;
      }
      const code=error.decline_code||error.code||error.raw?.decline_code||'unknown';
      let status='uncertain';
      if(payment?.status==='processing'||payment?.status==='succeeded')status='processing';
      else if(error.type==='StripeCardError'&&payment?.status==='requires_action')status='authentication_required';
      else if(error.type==='StripeCardError'&&payment?.status==='requires_payment_method'&&!['highest_risk_level','fraudulent','merchant_blacklist'].includes(code))status='declined';
      await ledger.finish(key,{status,code,paymentIntentId:idOf(payment)});
      if(['declined','authentication_required'].includes(status))continue;
      return {state:'review',reason:status,attempts};
    }
    const payment=paid.payment_intent;
    if(paid.status==='paid'&&paid.amount_remaining===0){
      const amount=Math.max(0,paid.amount_paid-(invoice.amount_paid||0));
      await ledger.finish(key,{status:'paid',paymentIntentId:idOf(payment),amount});
      await recordPaid({invoice:paid,method:card,amount});
      return {state:'paid',attempts};
    }
    if(payment?.status==='requires_action'){
      await ledger.finish(key,{status:'authentication_required',paymentIntentId:idOf(payment)});continue;
    }
    await ledger.finish(key,{status:payment?.status==='processing'?'processing':'uncertain',paymentIntentId:idOf(payment)});
    return {state:'review',reason:'payment_outcome_pending',attempts};
  }
  return {state:'failed',reason:cards.length?'all_cards_tried_once':'no_eligible_saved_cards',attempts};
}
module.exports={retryInvoiceOnce,orderedCards,retryEligibility};
