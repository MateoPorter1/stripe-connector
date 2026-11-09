const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const {enrichCardCounts}=require('./customerCardCounts');
const bad = message => Object.assign(new Error(message), { statusCode: 400 });
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw bad('Choose valid start and end dates.');
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== value) throw bad('Choose valid start and end dates.');
  return date;
}
function midnightNY(value) {
  const target = validDate(value).getTime(); let guess = target;
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone:'America/New_York', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' });
  for (let i=0;i<3;i++) {
    const parts=Object.fromEntries(formatter.formatToParts(new Date(guess)).map(part=>[part.type,part.value]));
    const actual=Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second);
    guess += target-actual;
  }
  return Math.floor(guess/1000);
}
function dateBounds(startDate,endDate) {
  validDate(startDate); const end=validDate(endDate);
  if(startDate>endDate)throw bad('The start date must come before the end date.');
  end.setUTCDate(end.getUTCDate()+1);
  return {gte:midnightNY(startDate),lte:midnightNY(end.toISOString().slice(0,10))-1};
}
const selectionSecret = secret => crypto.createHmac('sha256',secret).update('filtered-payment-selection-v1').digest('hex');
const keyVersion = key => crypto.createHash('sha256').update(key).digest('hex');
const idOf = value => typeof value === 'string' ? value : value?.id;
const readOptions = {timeout:20000,maxNetworkRetries:0};
function failureRow({charge,payment,invoice,failedAt,query,scope}) {
  const exists=invoice && typeof invoice==='object' && !invoice.deleted;
  const subscription=exists && (invoice.subscription||invoice.parent?.subscription_details?.subscription);
  const invoiceId=idOf(invoice)||idOf(payment?.invoice)||payment?.payment_details?.order_reference;
  // Keep unavailable invoice records without claiming their subscription can be verified.
  // Genuine standalone payments with no invoice association are outside this tool.
  if(exists&&!subscription)return null;
  if(!exists&&!invoiceId&&payment?.cancellation_reason!=='failed_invoice')return null;
  const latest=typeof payment?.latest_charge==='object'?payment.latest_charge:charge;
  const paymentState=payment?.status==='succeeded'?'paid':latest?.outcome?.type==='blocked'?'blocked':
    payment?.status==='processing'?'processing':'failed';
  const state=!exists?'unavailable':invoice.status==='paid'||invoice.amount_remaining===0?'paid':
    invoice.status==='uncollectible'?'written_off':invoice.status==='void'?'void':paymentState==='blocked'?'blocked':
    paymentState==='processing'?'processing':payment?.status==='canceled'?'cancelled':invoice.status==='open'?'open':invoice.status;
  const notes={open:'Included in the retry run.',written_off:'Included in the retry run despite Stripe marking it uncollectible.',
    unavailable:'Stripe cannot provide the original invoice. Kept visible; cannot be retried here.',
    paid:'Already paid. No further charge.',void:'Invoice was voided. No further charge.',blocked:'Stripe blocked this payment. Review it in Stripe.',
    processing:'A payment is processing. Wait for its result.',cancelled:'Payment was cancelled. Review the invoice in Stripe.'};
  const row={id:invoiceId||payment.id,number:exists?(invoice.number||invoice.id):(invoiceId||payment.id),invoiceId:exists?invoice.id:null,
    email:(exists&&invoice.customer_email)||charge?.billing_details?.email||charge?.customer?.email||payment?.customer?.email||idOf(payment?.customer)||'Customer unavailable',
    customerId:idOf(invoice?.customer)||idOf(charge?.customer)||idOf(payment?.customer)||null,
    subscription:idOf(subscription)||null,currency:invoice?.currency||payment?.currency||charge?.currency,
    amount:exists?invoice.amount_remaining:null,failedAmount:charge?.amount||payment?.amount||0,
    failedPayments:charge?[charge.id]:[payment.id],payments:[{id:idOf(payment)||charge.id,state:paymentState}],
    lastFailure:failedAt,reason:charge?.failure_message||payment?.last_payment_error?.message||charge?.failure_code||'Invoice payment failed',
    invoiceStatus:exists?invoice.status:'unavailable',displayStatus:state,retryNote:notes[state]||'Review this invoice in Stripe.',retryable:['open','written_off'].includes(state)};
  if(row.retryable)row.selectionToken=jwt.sign({kind:'filtered-invoice',userId:String(scope.userId),keyHash:scope.keyHash,invoiceId:invoice.id,
    startDate:query.startDate,endDate:query.endDate,amount:invoice.amount_remaining,currency:invoice.currency},selectionSecret(scope.secret),{expiresIn:'30m'});
  return row;
}
function combineFailureRows(prior,row) {
  if(!prior)return row;
  const newest=row.lastFailure>=prior.lastFailure?row:prior;
  return {...newest,lastFailure:Math.max(row.lastFailure,prior.lastFailure),failedPayments:[...new Set([...prior.failedPayments,...row.failedPayments])],
    payments:[...new Map([...prior.payments,...row.payments].map(payment=>[payment.id,payment])).values()]};
}
async function filteredFailuresPage(stripe,query,scope) {
  const created=dateBounds(query.startDate,query.endDate);
  const phase=query.phase||'charges';
  if(!['charges','payments'].includes(phase))throw bad('Invalid filter phase. Apply the dates again.');
  const prefix=phase==='charges'?'ch_':'pi_';
  if(query.cursor&&(typeof query.cursor!=='string'||!new RegExp('^'+prefix+'[a-zA-Z0-9]+$').test(query.cursor)))throw bad('Invalid payment cursor. Apply the dates again.');
  const page=phase==='charges'?await stripe.charges.list({limit:100,created,expand:['data.invoice','data.customer','data.payment_intent.latest_charge'],
    ...(query.cursor?{starting_after:query.cursor}:{})},readOptions):await stripe.paymentIntents.list({limit:100,created,expand:['data.invoice','data.customer'],
    ...(query.cursor?{starting_after:query.cursor}:{})},readOptions);
  const rows=new Map();
  for(const record of page.data){
    let charge,payment,invoice,failedAt;
    if(phase==='charges'){
      if(record.status!=='failed')continue;
      charge=record;payment=typeof charge.payment_intent==='object'?charge.payment_intent:null;
      invoice=charge.invoice||payment?.invoice;failedAt=charge.created;
    }else{
      // Stripe can cancel a failed invoice payment before any Charge exists.
      // Those entries appear in its Failed view and must not disappear here.
      if(record.status!=='canceled'||record.cancellation_reason!=='failed_invoice'||record.latest_charge)continue;
      failedAt=record.canceled_at;if(!failedAt||failedAt<created.gte||failedAt>created.lte)continue;
      payment=record;invoice=record.invoice;
    }
    const row=failureRow({charge,payment,invoice,failedAt,query,scope});
    if(row)rows.set(row.id,combineFailureRows(rows.get(row.id),row));
  }
  const cursor=page.has_more?page.data[page.data.length-1]?.id:null;
  if(page.has_more&&(!cursor||cursor===query.cursor))throw new Error('The payment scan could not advance.');
  return {success:true,invoices:await enrichCardCounts(stripe,[...rows.values()],scope),totalFetched:page.data.length,nextCursor:cursor||null,hasMore:Boolean(page.has_more),
    nextPhase:phase==='charges'&&!page.has_more?'payments':null};
}
function verifySelection(tokens,{userId,keyHash,secret,startDate,endDate}) {
  dateBounds(startDate,endDate);
  if(!Array.isArray(tokens)||tokens.length<1||tokens.length>500)throw bad('Select between 1 and 500 invoices. Narrow the date range if needed.');
  const selected=new Map();
  for(const token of tokens){
    let item;try{item=jwt.verify(token,selectionSecret(secret),{algorithms:['HS256']});}catch{throw bad('The filtered results expired. Apply the dates again before starting a run.');}
    if(item.kind!=='filtered-invoice'||item.userId!==String(userId)||item.keyHash!==keyHash||item.startDate!==startDate||item.endDate!==endDate)throw bad('The selected invoices do not match this account and date range. Apply the dates again.');
    if(!/^in_[a-zA-Z0-9]+$/.test(item.invoiceId)||!Number.isInteger(item.amount)||item.amount<=0)throw bad('Invalid invoice selection.');
    selected.set(item.invoiceId,{invoiceId:item.invoiceId,maxAmount:item.amount,currency:item.currency,state:'pending',attempts:0});
  }
  return [...selected.values()];
}
module.exports={filteredFailuresPage,verifySelection,dateBounds,keyVersion,combineFailureRows};
