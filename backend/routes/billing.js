const express=require('express');
const {billingConfig,makeClient,createBilling}=require('../services/billing');
function createBillingRoutes({Store=require('../models/BillingAccount'),auth=require('../middleware/auth'),env=process.env,stripe}={}){
 let cached;
 function setup(){if(!cached){const config=billingConfig(env);cached={config,stripe:stripe||makeClient(config)};cached.service=createBilling({stripe:cached.stripe,Store,config});}return cached;}
 function failure(res,error){
  const code=error.statusCode&&error.statusCode<500?error.statusCode:503;
  // Stripe errors can include sensitive request details; never serialize or log them.
  res.status(code).json({success:false,error:code<500?error.message:'Test billing is temporarily unavailable. Please try again.'});
 }
 const webhook=async(req,res)=>{
  try{
   const {config,stripe,service}=setup();let event;
   try{event=stripe.webhooks.constructEvent(req.body,req.headers['stripe-signature'],config.webhookSecret);}catch{return res.status(400).json({success:false,error:'Invalid webhook signature.'});}
   await service.event(event);res.json({received:true});
  }catch(error){failure(res,error);}
 };
 const router=express.Router();router.use(auth);router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
 router.get('/',async(req,res)=>{if(env.BILLING_ENABLED!=='true')return res.json({success:true,configured:false,mode:'test'});try{res.json({success:true,configured:true,...await setup().service.status(req.user._id)});}catch(e){failure(res,e);}});
 router.post('/checkout',async(req,res)=>{try{res.json({success:true,...await setup().service.checkout(req.user)});}catch(e){failure(res,e);}});
 router.post('/confirm',async(req,res)=>{try{res.json({success:true,...await setup().service.confirm(req.user._id,req.body.sessionId)});}catch(e){failure(res,e);}});
 router.post('/portal',async(req,res)=>{try{res.json({success:true,...await setup().service.portal(req.user._id)});}catch(e){failure(res,e);}});
 return {router,webhook};
}
module.exports={createBillingRoutes};
