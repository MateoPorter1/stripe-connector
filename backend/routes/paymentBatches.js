const express=require('express');
const Stripe=require('stripe');
const crypto=require('crypto');
const mongoose=require('mongoose');
const auth=require('../middleware/auth');
const User=require('../models/User');
const Batch=require('../models/RetryBatch');
const Lease=require('../models/FallbackLease');
const {filteredFailuresPage,verifySelection,keyVersion}=require('../services/filteredFailures');
const {prepareBatchStorage,takeLease,batchPayload,launchBatch}=require('../services/paymentBatchRunner');
const {assertRetryAccess}=require('../services/billingRuntime');
const router=express.Router();router.use(auth);
const {connectedStripe}=require('../services/stripeAppConnection');
async function client(userId){return connectedStripe(userId);}
function fail(res,error){console.error('Payment batch API:',error.type||error.name);res.status(error.statusCode||502).json({success:false,error:error.statusCode?error.message:'Could not complete this request. Refresh the run status before trying again.'});}
async function checkInterrupted(batch){
  if(batch&&['running','stopping'].includes(batch.status)){
    const lease=await Lease.exists({_id:batch.accountId,owner:batch.runnerId,until:{$gt:new Date()}});
    if(!lease){await Batch.updateOne({_id:batch._id,runnerId:batch.runnerId,status:batch.status},{$set:{status:batch.status==='stopping'?'cancelled':'interrupted'}});batch=await Batch.findById(batch._id);}
  }
  return batch;
}
router.get('/failed',async(req,res)=>{try{const {stripe,keyHash}=await client(req.user._id);res.set('Cache-Control','no-store').json(await filteredFailuresPage(stripe,req.query,{userId:req.user._id,keyHash,secret:process.env.JWT_SECRET}));}catch(error){fail(res,error);}});
router.get('/ready',async(req,res)=>{try{const {stripe}=await client(req.user._id);await prepareBatchStorage();const account=await stripe.accounts.retrieve();res.set('Cache-Control','no-store').json({success:true,ready:true,accountName:account.business_profile?.name||account.settings?.dashboard?.display_name||account.id});}catch(error){fail(res,error);}});
router.get('/latest',async(req,res)=>{try{const batch=await checkInterrupted(await Batch.findOne({userId:req.user._id}).sort({createdAt:-1}));res.set('Cache-Control','no-store').json(batch?await batchPayload(batch):{success:true,batch:null,attempts:[]});}catch(error){fail(res,error);}});
router.post('/start',async(req,res)=>{
  let batch,lease;
  try{
    if(req.body.authorize!==true)throw Object.assign(new Error('Use Retry filtered payments to authorize this run.'),{statusCode:400});
    if(typeof req.body.requestId!=='string'||! /^[a-zA-Z0-9-]{16,64}$/.test(req.body.requestId))throw Object.assign(new Error('Invalid run identifier.'),{statusCode:400});
    await assertRetryAccess(req.user._id,{fresh:true});
    await prepareBatchStorage();
    const previous=await Batch.findOne({userId:req.user._id,requestId:req.body.requestId});
    if(previous)return res.json(await batchPayload(await checkInterrupted(previous)));
    const {stripe,keyHash}=await client(req.user._id);
    const items=verifySelection(req.body.tokens,{userId:req.user._id,keyHash,secret:process.env.JWT_SECRET,startDate:req.body.startDate,endDate:req.body.endDate});
    const account=await stripe.accounts.retrieve();const runnerId=crypto.randomUUID();
    lease=await takeLease(account.id,runnerId);
    if(!lease)throw Object.assign(new Error('A run is already processing payments on this Stripe account. Wait for it to finish or stop it first.'),{statusCode:409});
    try{batch=await Batch.create({_id:new mongoose.Types.ObjectId(),userId:req.user._id,accountId:account.id,keyHash,requestId:req.body.requestId,runnerId,
      startDate:req.body.startDate,endDate:req.body.endDate,status:'running',items});}
    catch(error){await Lease.deleteOne({_id:account.id,owner:runnerId});if(error.code===11000){const existing=await Batch.findOne({userId:req.user._id,requestId:req.body.requestId});return res.json(await batchPayload(existing));}throw error;}
    res.status(202).json(await batchPayload(batch));launchBatch(batch,stripe);
  }catch(error){if(lease&&!batch)await Lease.deleteOne({_id:lease._id,owner:lease.owner});fail(res,error);}
});
router.post('/:id/stop',async(req,res)=>{try{if(!mongoose.isValidObjectId(req.params.id))throw Object.assign(new Error('Run not found.'),{statusCode:404});let batch=await Batch.findOneAndUpdate({_id:req.params.id,userId:req.user._id,status:'running'},{$set:{status:'stopping'}},{new:true});if(!batch)batch=await Batch.findOne({_id:req.params.id,userId:req.user._id});if(!batch)throw Object.assign(new Error('Run not found.'),{statusCode:404});res.json(await batchPayload(await checkInterrupted(batch)));}catch(error){fail(res,error);}});
router.post('/:id/resume',async(req,res)=>{
  try{
    if(req.body.authorize!==true||!mongoose.isValidObjectId(req.params.id))throw Object.assign(new Error('Explicitly resume the selected run.'),{statusCode:400});
    await assertRetryAccess(req.user._id,{fresh:true});
    let batch=await checkInterrupted(await Batch.findOne({_id:req.params.id,userId:req.user._id}));
    if(!batch||!['interrupted','failed'].includes(batch.status))throw Object.assign(new Error('This run cannot be resumed.'),{statusCode:409});
    const {stripe,keyHash}=await client(req.user._id);if(keyHash!==batch.keyHash)throw Object.assign(new Error('The Stripe connection changed. Apply the dates again.'),{statusCode:400});
    const runnerId=crypto.randomUUID();const lease=await takeLease(batch.accountId,runnerId);if(!lease)throw Object.assign(new Error('Another run is active on this Stripe account.'),{statusCode:409});
    batch=await Batch.findOneAndUpdate({_id:batch._id,status:batch.status},{$set:{status:'running',runnerId,lastError:''}},{new:true});
    if(!batch){await Lease.deleteOne({_id:lease._id,owner:runnerId});throw Object.assign(new Error('Run state changed. Refresh its status.'),{statusCode:409});}
    res.status(202).json(await batchPayload(batch));launchBatch(batch,stripe);
  }catch(error){fail(res,error);}
});
module.exports=router;
