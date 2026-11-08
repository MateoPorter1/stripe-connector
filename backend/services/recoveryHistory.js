const {dateBounds}=require('./filteredFailures');
const mongoose=require('mongoose');
const bad=message=>Object.assign(new Error(message),{statusCode:400});
const TIMEZONE='America/New_York';
function recoveryFilter(userId,{startDate,endDate,currency,month}={}) {
  const filter={userId};
  if(currency!==undefined){if(typeof currency!=='string'||! /^[a-zA-Z]{3}$/.test(currency))throw bad('Choose a valid currency.');filter.currency=currency.toUpperCase();}
  if(startDate&&endDate&&startDate>endDate)throw bad('The start date must come before the end date.');
  let from,to;
  if(startDate)from=dateBounds(startDate,startDate).gte*1000;
  if(endDate)to=dateBounds(endDate,endDate).lte*1000+999;
  if(month!==undefined){
    if(typeof month!=='string'||! /^\d{4}-(0[1-9]|1[0-2])$/.test(month)||+month.slice(0,4)<1900||+month.slice(0,4)>9998)throw bad('Choose a valid month.');
    const last=new Date(Date.UTC(+month.slice(0,4),+month.slice(5),0)).toISOString().slice(0,10);
    const bounds=dateBounds(month+'-01',last);
    from=Math.max(from??-Infinity,bounds.gte*1000);to=Math.min(to??Infinity,bounds.lte*1000+999);
  }
  if(from!==undefined||to!==undefined){filter.recoveredAt={};if(from!==undefined)filter.recoveredAt.$gte=new Date(from);if(to!==undefined)filter.recoveredAt.$lte=new Date(to);}
  return filter;
}
function historyPage(query) {
  const limit=query.limit===undefined?50:Number(query.limit);
  if(!Number.isInteger(limit)||limit<1||limit>100)throw bad('Choose a page size between 1 and 100.');
  let cursor;
  if(query.cursor!==undefined){
    try{
      if(typeof query.cursor!=='string'||query.cursor.length>300)throw new Error();
      const decoded=JSON.parse(Buffer.from(query.cursor,'base64url').toString());
      const time=new Date(decoded.date);
      if(!/^[a-fA-F0-9]{24}$/.test(decoded.id)||!Number.isFinite(time.getTime())||time.toISOString()!==decoded.date)throw new Error();
      cursor={$or:[{recoveredAt:{$lt:time}},{recoveredAt:time,_id:{$lt:new mongoose.Types.ObjectId(decoded.id)}}]};
    }catch{throw bad('The history page is invalid. Select the month again.');}
  }
  return {limit,cursor};
}
async function recoveryHistory(Recovery,userId,query) {
  if(!query.month)throw bad('Choose a month to see its payments.');
  const filter=recoveryFilter(userId,{...query,currency:query.currency||'USD'});
  const {limit,cursor}=historyPage(query);
  const [rows,totals]=await Promise.all([
    Recovery.find({...filter,...cursor}).sort({recoveredAt:-1,_id:-1}).limit(limit+1)
      .select('customerId customerEmail amount currency recoveredAt paymentIntentId paymentMethodUsed paymentMethodDetails invoiceId subscriptionId retryBatchId').lean(),
    Recovery.aggregate([{$match:filter},{$group:{_id:null,totalAmount:{$sum:'$amount'},count:{$sum:1},customers:{$addToSet:'$customerId'}}}])
  ]);
  const hasMore=rows.length>limit;const recoveries=rows.slice(0,limit);const last=recoveries.at(-1);
  const nextCursor=hasMore?Buffer.from(JSON.stringify({date:new Date(last.recoveredAt).toISOString(),id:String(last._id)})).toString('base64url'):null;
  const total=totals[0];
  return {success:true,month:query.month,currency:filter.currency,recoveries,hasMore,nextCursor,
    totalCount:total?.count||0,totalAmount:total?.totalAmount||0,customerCount:total?.customers?.length||0};
}
module.exports={recoveryFilter,recoveryHistory,historyPage,TIMEZONE};
