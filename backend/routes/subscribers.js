const express=require('express');const mongoose=require('mongoose');
const {collectionAccess}=require('../services/billingAccess');
function createSubscriberRouter({User=require('../models/User'),Store=require('../models/BillingAccount'),Audit=require('../models/BillingAudit'),auth=require('../middleware/auth'),admin=require('../middleware/admin'),runtime=require('../services/billingRuntime').getBilling}={}){
 const router=express.Router();router.use(auth,admin);router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
 const fail=(res,e)=>res.status(e.statusCode||503).json({success:false,error:e.statusCode?e.message:'Subscriber management is temporarily unavailable.'});
 const invalid=m=>Object.assign(new Error(m),{statusCode:400});
 function row(user,billing,config){return {id:String(user._id),name:user.name,email:user.email,role:user.role,createdAt:user.createdAt,billing:{status:billing?.status||'none',interval:billing?.interval||null,customerId:billing?.customerId||null,subscriptionId:billing?.subscriptionId||null,trialEndsAt:billing?.trialEndsAt||null,paidThrough:billing?.paidThrough||null,currentPeriodEnd:billing?.currentPeriodEnd||null,cancelAtPeriodEnd:Boolean(billing?.cancelAtPeriodEnd),collectionBlocked:Boolean(billing?.collectionBlocked),blockReason:billing?.blockReason||'',syncedAt:billing?.syncedAt||null},access:collectionAccess(user,billing,{mode:config.mode})};}
 router.get('/',async(req,res)=>{try{
  const {config}=runtime(),q=String(req.query.q||'').trim().slice(0,100),page=Math.max(1,parseInt(req.query.page,10)||1),limit=25;
  const match=q?{$or:[{email:{$regex:q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),$options:'i'}},{name:{$regex:q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),$options:'i'}}]}:{};
  const [users,total]=await Promise.all([User.find(match).select('name email role createdAt').sort({createdAt:-1,_id:1}).skip((page-1)*limit).limit(limit),User.countDocuments(match)]);
  const records=await Store.find({scope:config.scope,userId:{$in:users.map(u=>u._id)}});const map=new Map(records.map(b=>[String(b.userId),b]));
  res.json({success:true,mode:config.mode,plans:[{amount:5000,currency:'usd',interval:'month',trialDays:14},{amount:50000,currency:'usd',interval:'year',trialDays:14}],page,total,pages:Math.max(1,Math.ceil(total/limit)),users:users.map(u=>row(u,map.get(String(u._id)),config))});
 }catch(e){fail(res,e);}});
 router.post('/:id/:action',async(req,res)=>{let audit;try{
  const {id,action}=req.params;if(!mongoose.isValidObjectId(id)||!['refresh','block','cancel'].includes(action))throw invalid('Invalid subscriber action.');
  const {config,service}=runtime(),user=await User.findById(id).select('name email role createdAt');if(!user)throw Object.assign(new Error('Subscriber not found.'),{statusCode:404});
  if(action==='refresh')await service.status(id,user);
  else{
   if(!/^[a-zA-Z0-9-]{16,64}$/.test(req.body.requestId||''))throw invalid('A unique request reference is required.');
   const reason=String(req.body.reason||'').trim();if(reason.length<3||reason.length>300)throw invalid('Enter a short reason for this change.');
   if(action==='block'&&typeof req.body.blocked!=='boolean'||action==='cancel'&&typeof req.body.cancelAtPeriodEnd!=='boolean')throw invalid('Choose the intended subscription action.');
   if(action==='block'&&String(req.user._id)===id)throw invalid('You cannot block your own administrator workspace.');
   audit=await Audit.create({actorId:req.user._id,userId:id,scope:config.scope,action:action==='block'?(req.body.blocked?'block_collection':'unblock_collection'):(req.body.cancelAtPeriodEnd?'cancel_at_period_end':'keep_subscription'),reason,status:'pending',requestId:req.body.requestId});
   if(action==='block')await Store.findOneAndUpdate({userId:id,scope:config.scope},{$set:{collectionBlocked:req.body.blocked,blockReason:req.body.blocked?reason:''},$setOnInsert:{userId:id,scope:config.scope,status:'none'}},{new:true,upsert:true});
   else await service.manage(id,req.body.cancelAtPeriodEnd,req.body.requestId);
   audit.status='completed';await audit.save();
  }
  const record=await Store.findOne({userId:id,scope:config.scope});res.json({success:true,user:row(user,record,config)});
 }catch(e){if(audit){audit.status='failed';await audit.save().catch(()=>{});}fail(res,e);}});
 router.get('/:id/audit',async(req,res)=>{try{if(!mongoose.isValidObjectId(req.params.id))throw invalid('Invalid subscriber.');const {config}=runtime();const actions=await Audit.find({userId:req.params.id,scope:config.scope}).sort({createdAt:-1}).limit(50).select('action reason status createdAt actorId');res.json({success:true,actions});}catch(e){fail(res,e);}});
 return router;
}
module.exports={createSubscriberRouter};
