const {test}=require('node:test');
const assert=require('node:assert/strict');
const {retryInvoiceOnce}=require('../services/manualInvoiceRetry');
function setup(outcomes){
  const cards=[1,2,3].map(n=>({id:`pm_${n}`,customer:'cus_1',type:'card',card:{fingerprint:`finger_${n}`,brand:'visa',last4:`000${n}`,exp_year:2099,exp_month:12}}));
  let invoice={id:'in_1',subscription:{id:'sub_1',default_payment_method:'pm_1'},customer:'cus_1',status:'open',amount_remaining:4000,amount_paid:0,currency:'usd',payment_intent:{id:'pi_1',status:'requires_payment_method',payment_method:'pm_1'}};
  const history=[],calls=[],paid=[];
  const ledger={blocked:async()=>false,count:async()=>history.length,seen:async(b,i,k)=>history.some(a=>a.cardKey===k),claim:async a=>{history.push(a);return true;},finish:async(key,data)=>Object.assign(history.find(a=>a.cardKey===key.cardKey),data)};
  const stripe={paymentMethods:{list:async()=>({data:cards,has_more:false})},invoices:{retrieve:async()=>invoice,pay:async(id,params,options)=>{
    calls.push({id,params,options});const outcome=outcomes[calls.length-1];
    if(outcome==='paid'){invoice={...invoice,status:'paid',amount_remaining:0,amount_paid:4000,payment_intent:{id:'pi_1',status:'succeeded'}};return invoice;}
    if(outcome==='unknown')throw Object.assign(new Error('timeout'),{type:'StripeConnectionError'});
    const status=outcome==='auth'?'requires_action':'requires_payment_method';
    invoice={...invoice,payment_intent:{id:'pi_1',status}};
    throw Object.assign(new Error('declined'),{type:'StripeCardError',code:'card_declined',payment_intent:invoice.payment_intent});
  }}};
  const args={stripe,batchId:'batch_1',accountId:'acct_1',item:{invoiceId:'in_1',currency:'usd',maxAmount:4000},ledger,allowed:async()=>true,recordPaid:async data=>paid.push(data)};
  return {args,cards,history,calls,paid,setInvoice:value=>{invoice={...invoice,...value};}};
}
test('three declined cards means exactly three attempts, including the default that failed before',async()=>{
  const s=setup(['declined','declined','declined']);const result=await retryInvoiceOnce(s.args);
  assert.equal(result.state,'failed');assert.equal(result.attempts,3);
  assert.deepEqual(s.calls.map(c=>c.params.payment_method),['pm_1','pm_2','pm_3']);
  assert(s.calls.every(c=>c.id==='in_1'&&c.options.maxNetworkRetries===0));
  await retryInvoiceOnce(s.args);assert.equal(s.calls.length,3,'same run must never repeat a card');
});
test('second card succeeds: stop before third and record original invoice payment',async()=>{
  const s=setup(['declined','paid']);assert.equal((await retryInvoiceOnce(s.args)).state,'paid');
  assert.equal(s.calls.length,2);assert.equal(s.paid[0].amount,4000);
  assert.notEqual(s.calls[0].options.idempotencyKey,s.calls[1].options.idempotencyKey);
});
test('authentication failure can move to next card; uncertain money outcome cannot',async()=>{
  const auth=setup(['auth','paid']);assert.equal((await retryInvoiceOnce(auth.args)).state,'paid');assert.equal(auth.calls.length,2);
  const uncertain=setup(['unknown','paid']);assert.equal((await retryInvoiceOnce(uncertain.args)).state,'review');assert.equal(uncertain.calls.length,1);assert.equal(uncertain.history[0].status,'uncertain');
});
test('a previously uncertain attempt blocks all further cards and a stop prevents submission',async()=>{
  const s=setup(['paid']);s.args.ledger.blocked=async()=>true;assert.equal((await retryInvoiceOnce(s.args)).state,'review');assert.equal(s.calls.length,0);
  s.args.ledger.blocked=async()=>false;s.args.allowed=async()=>false;assert.equal((await retryInvoiceOnce(s.args)).state,'pending');assert.equal(s.calls.length,0);
});
test('closed invoices and increased debt never get charged',async()=>{
  for(const change of [{status:'paid',amount_remaining:0},{amount_remaining:5000}]){const s=setup(['paid']);s.setInvoice(change);assert.equal((await retryInvoiceOnce(s.args)).state,'skipped');assert.equal(s.calls.length,0);}
});
test('duplicate physical cards are tried once even with separate method ids',async()=>{
  const s=setup(['declined','declined']);s.cards[2].card.fingerprint=s.cards[0].card.fingerprint;
  assert.equal((await retryInvoiceOnce(s.args)).attempts,2);assert.equal(s.calls.length,2);
});
