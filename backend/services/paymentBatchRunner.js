const Batch=require('../models/RetryBatch');
const Attempt=require('../models/BatchCardAttempt');
const LegacyAttempt=require('../models/FallbackAttempt');
const Lease=require('../models/FallbackLease');
const Recovery=require('../models/Recovery');
const User=require('../models/User');
const {retryInvoiceOnce}=require('./manualInvoiceRetry');
const {keyVersion}=require('./filteredFailures');
const {idOf}=require('./cardFallback');
let prepared;
async function prepareBatchStorage(){
  if(!prepared)prepared=(async()=>{
    for(const model of [Batch,Attempt,Lease,Recovery])await model.createCollection();
    await Promise.all([Batch.createIndexes(),Attempt.createIndexes(),Recovery.createIndexes()]);
  })().catch(error=>{prepared=null;throw error;});
  return prepared;
}
async function takeLease(accountId,runnerId){
  try{return await Lease.findOneAndUpdate({_id:accountId,$or:[{until:{$lt:new Date()}},{owner:runnerId}]},{$set:{owner:runnerId,until:new Date(Date.now()+120000)}},{upsert:true,new:true});}
  catch(error){if(error.code===11000)return null;throw error;}
}
async function batchPayload(batch){
  const attempts=await Attempt.find({batchId:batch._id}).sort({createdAt:1}).select('invoiceId brand last4 amount currency status code createdAt updatedAt');
  return {success:true,batch,attempts};
}
async function processBatch(batch,stripe){
  const batchId=String(batch._id),runnerId=batch.runnerId;
  try{
    const allowed=async()=>{
      const current=await Batch.exists({_id:batch._id,status:'running',runnerId});
      const user=await User.findById(batch.userId).select('+stripeApiKey');
      if(!current||!user?.stripeApiKey||keyVersion(user.stripeApiKey)!==batch.keyHash)return false;
      const lease=await Lease.updateOne({_id:batch.accountId,owner:runnerId,until:{$gt:new Date()}},{$set:{until:new Date(Date.now()+120000)}});
      return lease.matchedCount===1;
    };
    const ledger={
      blocked:async(accountId,invoiceId)=>Boolean(await Attempt.exists({accountId,invoiceId,status:{$in:['pending','uncertain','processing']}})||await LegacyAttempt.exists({accountId,invoiceId,status:{$in:['pending','uncertain','processing']}})),
      count:(id,invoiceId)=>Attempt.countDocuments({batchId:id,invoiceId}),
      seen:(id,invoiceId,cardKey)=>Attempt.exists({batchId:id,invoiceId,cardKey}),
      claim:async(data)=>{try{await Attempt.create(data);return true;}catch(error){if(error.code===11000)return false;throw error;}},
      finish:(key,data)=>Attempt.updateOne(key,{$set:data})
    };
    for(const item of batch.items){
      if(!['pending','running'].includes(item.state))continue;
      if(!await allowed())break;
      await Batch.updateOne({_id:batch._id,runnerId,'items.invoiceId':item.invoiceId},{$set:{'items.$.state':'running'}});
      let result;
      try{
        result=await retryInvoiceOnce({stripe,batchId,accountId:batch.accountId,item,ledger,allowed,
          recordPaid:async({invoice,method,amount})=>{
            const paymentIntentId=idOf(invoice.payment_intent);
            if(paymentIntentId&&amount>0)await Recovery.updateOne({userId:batch.userId,paymentIntentId},{$setOnInsert:{
              userId:batch.userId,paymentIntentId,customerId:idOf(invoice.customer),customerEmail:invoice.customer_email||'',amount,currency:invoice.currency,
              paymentMethodUsed:method.id,paymentMethodDetails:{brand:method.card.brand,last4:method.card.last4},recoveredAt:new Date(),originalFailedDate:new Date(invoice.created*1000)
            }},{upsert:true});
          }});
      }catch(error){
        console.error('Manual invoice retry:',error.type||error.name);
        result={state:'review',reason:'could_not_confirm_outcome',attempts:await Attempt.countDocuments({batchId,invoiceId:item.invoiceId})};
      }
      await Batch.updateOne({_id:batch._id,runnerId,'items.invoiceId':item.invoiceId},{$set:{'items.$.state':result.state,'items.$.attempts':result.attempts,'items.$.reason':result.reason||''}});
      if(result.state==='pending')break;
    }
    const current=await Batch.findOne({_id:batch._id,runnerId});
    if(current){
      const pending=current.items.some(item=>['pending','running'].includes(item.state));
      const status=current.status==='stopping'?'cancelled':pending?'interrupted':'completed';
      await Batch.updateOne({_id:batch._id,runnerId},{$set:{status,finishedAt:new Date()}});
    }
  }catch(error){
    console.error('Manual batch:',error.type||error.name);
    await Batch.updateOne({_id:batch._id,runnerId},{$set:{status:'failed',lastError:'The run stopped. Review recorded attempts before resuming.',finishedAt:new Date()}});
  }finally{await Lease.deleteOne({_id:batch.accountId,owner:runnerId});}
}
function launchBatch(batch,stripe){
  // Only called from an authenticated user Start/Resume request. No schedules.
  setImmediate(()=>processBatch(batch,stripe).catch(error=>console.error('Manual batch stopped:',error.name)));
}
module.exports={prepareBatchStorage,takeLease,batchPayload,launchBatch};
