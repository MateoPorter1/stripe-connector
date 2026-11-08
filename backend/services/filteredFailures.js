const jwt = require('jsonwebtoken');
const crypto = require('crypto');
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
async function filteredFailuresPage(stripe,query,{userId,keyHash,secret}) {
  const created=dateBounds(query.startDate,query.endDate);
  const params={limit:100,created,expand:['data.invoice']};
  if(query.cursor){if(typeof query.cursor!=='string'||!/^ch_[a-zA-Z0-9]+$/.test(query.cursor))throw bad('Invalid payment cursor. Apply the dates again.');params.starting_after=query.cursor;}
  const page=await stripe.charges.list(params,{timeout:20000,maxNetworkRetries:0});
  const rows=new Map();
  for(const charge of page.data){
    if(charge.status!=='failed')continue;
    const invoice=typeof charge.invoice==='object'?charge.invoice:null;
    const subscription=invoice?.subscription||invoice?.parent?.subscription_details?.subscription;
    if(!invoice||!subscription||invoice.status!=='open'||invoice.amount_remaining<=0)continue;
    let row=rows.get(invoice.id);
    if(!row){
      row={id:invoice.id,number:invoice.number||invoice.id,email:invoice.customer_email||charge.billing_details?.email||'No email',
        subscription:typeof subscription==='string'?subscription:subscription.id,currency:invoice.currency,amount:invoice.amount_remaining,
        failedPayments:[],lastFailure:charge.created,reason:charge.failure_message||charge.failure_code||'Payment failed'};
      row.selectionToken=jwt.sign({kind:'filtered-invoice',userId:String(userId),keyHash,invoiceId:invoice.id,startDate:query.startDate,endDate:query.endDate,
        amount:invoice.amount_remaining,currency:invoice.currency},selectionSecret(secret),{expiresIn:'30m'});
      rows.set(invoice.id,row);
    }
    row.failedPayments.push(charge.id);
    row.lastFailure=Math.max(row.lastFailure,charge.created);
  }
  const cursor=page.has_more?page.data[page.data.length-1]?.id:null;
  if(page.has_more&&(!cursor||cursor===query.cursor))throw new Error('The payment scan could not advance.');
  return {success:true,invoices:[...rows.values()],totalFetched:page.data.length,nextCursor:cursor||null,hasMore:Boolean(page.has_more)};
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
module.exports={filteredFailuresPage,verifySelection,dateBounds,keyVersion};
