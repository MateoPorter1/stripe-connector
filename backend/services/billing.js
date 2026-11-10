const crypto=require('crypto');
const Stripe=require('stripe-billing');
const OPEN=new Set(['active','trialing','past_due','unpaid','paused','incomplete']);
const problem=(message,statusCode=400)=>Object.assign(new Error(message),{statusCode});
function billingConfig(env=process.env){
 if(env.BILLING_ENABLED!=='true')throw problem('Subscription billing is not configured yet.',503);
 const live=env.BILLING_MODE==='live';
 if(!['test','live'].includes(env.BILLING_MODE)||!(live?/^(?:rk|sk)_live_/:/^(?:rkcs|rk|sk)_test_/).test(env.REBOUND_BILLING_KEY||''))throw problem('Billing credentials do not match the selected environment.',503);
 const origin=new URL(env.BILLING_APP_ORIGIN||'http://localhost:3000');
 if(origin.protocol!=='https:'&&!(origin.protocol==='http:'&&['localhost','127.0.0.1'].includes(origin.hostname)))throw problem('Billing return address is not configured.',503);
 if(!/^acct_/.test(env.REBOUND_BILLING_ACCOUNT||'')||!/^price_/.test(env.REBOUND_BILLING_PRICE||'')||!env.REBOUND_BILLING_WEBHOOK_SECRET)throw problem('Subscription billing is not configured yet.',503);
 return {key:env.REBOUND_BILLING_KEY,account:env.REBOUND_BILLING_ACCOUNT,price:env.REBOUND_BILLING_PRICE,webhookSecret:env.REBOUND_BILLING_WEBHOOK_SECRET,portal:env.REBOUND_BILLING_PORTAL,origin:origin.origin,mode:env.BILLING_MODE,scope:`${env.BILLING_MODE}:${env.REBOUND_BILLING_ACCOUNT}`};
}
function makeClient(config){return new Stripe(config.key,{timeout:15000,maxNetworkRetries:1});}
function createBilling({stripe,Store,config}){
 let verified;
 async function catalog(){
  if(!verified)verified=(async()=>{
   const [account,price]=await Promise.all([stripe.accounts.retrieve(),stripe.prices.retrieve(config.price,{expand:['product']})]);
   if(account.id!==config.account||price.livemode!==(config.mode==='live')||!price.active||price.type!=='recurring'||price.recurring?.interval!=='month'||price.recurring?.interval_count!==1||price.unit_amount!==5000||price.currency!=='usd'||price.product?.active!==true)throw problem('The $50 monthly plan is unavailable.',503);
   return {name:price.product.name,amount:price.unit_amount,currency:price.currency,interval:'month',trialDays:14};
  })().catch(e=>{verified=null;throw e;});
  return verified;
 }
 async function account(userId){
  await Store.init();
  try{return await Store.findOneAndUpdate({userId,scope:config.scope},{$setOnInsert:{userId,scope:config.scope,status:'none'}},{upsert:true,new:true});}
  catch(e){if(e.code===11000)return Store.findOne({userId,scope:config.scope});throw e;}
 }
 async function locked(userId,fn){
  const row=await account(userId),now=new Date();
  const lock=await Store.findOneAndUpdate({_id:row._id,$or:[{leaseUntil:{$lte:now}},{leaseUntil:null}]},{$set:{leaseUntil:new Date(+now+120000)}},{new:true});
  if(!lock)throw problem('Billing is already updating. Please try again shortly.',409);
  try{return await fn(lock);}finally{await Store.updateOne({_id:row._id},{$unset:{leaseUntil:1}});}
 }
 async function subscriptions(row){
  if(!row.customerId)return [];
  const list=await stripe.subscriptions.list({customer:row.customerId,status:'all',limit:100,expand:['data.latest_invoice']});
  if(list.has_more)throw problem('Billing needs a manual review before another subscription.',409);
  return list.data.filter(s=>s.items.data.some(i=>i.price.id===config.price));
 }
 async function sync(row){
  const all=await subscriptions(row);
  const sorted=all.sort((a,b)=>Number(OPEN.has(b.status))-Number(OPEN.has(a.status))||b.created-a.created);
  const sub=sorted[0];
  const trials=all.map(s=>s.trial_start).filter(Boolean);
  if(trials.length){const first=Math.min(...trials)*1000;row.trialStartedAt=new Date(Math.min(+(row.trialStartedAt||first),first));}
  row.trialEndsAt=sub?.status==='trialing'&&row.trialStartedAt?new Date(Math.min(sub.trial_end*1000,+row.trialStartedAt+14*86400000)):null;
  const invoice=sub?.latest_invoice;
  const lines=invoice&&typeof invoice==='object'&&invoice.status==='paid'?invoice.lines?.data||[]:[];
  const ends=lines.filter(l=>l.price?.id===config.price||l.pricing?.price_details?.price===config.price).map(l=>l.period?.end||0);
  row.paidThrough=ends.length?new Date(Math.max(...ends)*1000):null;
  row.subscriptionId=sub?.id;row.status=sub?.status||'none';row.cancelAtPeriodEnd=Boolean(sub?.cancel_at_period_end);
  const end=sub?.current_period_end||Math.max(0,...(sub?.items.data||[]).map(i=>i.current_period_end||0));
  row.currentPeriodEnd=end?new Date(end*1000):null;row.syncedAt=new Date();await row.save();
  return sorted;
 }
 function view(row,user){const {collectionAccess}=require('./billingAccess');return {mode:config.mode||'test',status:row.status||'none',cancelAtPeriodEnd:Boolean(row.cancelAtPeriodEnd),currentPeriodEnd:row.currentPeriodEnd||null,trialStartedAt:row.trialStartedAt||null,trialEndsAt:row.trialEndsAt||null,paidThrough:row.paidThrough||null,syncedAt:row.syncedAt||null,hasCustomer:Boolean(row.customerId),collectionBlocked:Boolean(row.collectionBlocked),access:collectionAccess(user||{},row,{mode:config.mode||'test'})};}
 async function status(userId,user){return locked(userId,async row=>{await catalog();await sync(row);return {plan:await catalog(),billing:view(row,user)};});}
 async function checkout(user){return locked(user._id,async row=>{
  await catalog();const all=await sync(row);
  if(all.some(s=>OPEN.has(s.status)))throw problem('A subscription already exists. Use Manage subscription instead.',409);
  if(row.checkoutId&&!row.checkoutId.startsWith('pending_')&&+row.checkoutExpiresAt>Date.now()){
   const existing=await stripe.checkout.sessions.retrieve(row.checkoutId);
   if(existing.status==='open')return {url:existing.url};
   if(existing.status==='complete'&&!all.length)throw problem('Your payment is being confirmed. Refresh billing before starting again.',409);
  }
  if(!row.customerId){
   // Stable idempotency protects a retry after Stripe created a customer but DB save failed.
   const customer=await stripe.customers.create({email:user.email,name:user.name,metadata:{rebound_user_id:String(user._id)}},{idempotencyKey:`rebound-customer-${config.account}-${user._id}`});
   row.customerId=customer.id;await row.save();
  }
  // Session key is persisted before the API call, so timeouts cannot create duplicate checkouts.
  const key=row.checkoutId?.startsWith('pending_')?row.checkoutId:`pending_${crypto.randomUUID()}`;
  row.checkoutId=key;await row.save();
  const marker=Array.from(crypto.createHash('sha256').update(key).digest().subarray(0,8),n=>String.fromCharCode(97+n%26)).join('');
  const session=await stripe.checkout.sessions.create({mode:'subscription',customer:row.customerId,line_items:[{price:config.price,quantity:1}],client_reference_id:String(user._id),metadata:{rebound_user_id:String(user._id)},payment_method_collection:'always',subscription_data:{metadata:{rebound_user_id:String(user._id)},...(!row.trialStartedAt?{trial_period_days:14}:{}),trial_settings:{end_behavior:{missing_payment_method:'cancel'}}},integration_identifier:`rebound_billing_${marker}`,success_url:`${config.origin}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${config.origin}/billing?checkout=cancelled`},{idempotencyKey:key});
  row.checkoutId=session.id;row.checkoutUrl=session.url;row.checkoutExpiresAt=new Date(session.expires_at*1000);await row.save();return {url:session.url};
 });}
 async function confirm(userId,sessionId){
  if(!(config.mode==='live'?/^cs_live_[A-Za-z0-9]+$/:/^cs_test_[A-Za-z0-9]+$/).test(sessionId||''))throw problem('Invalid checkout reference.');
  return locked(userId,async row=>{
   await catalog();const session=await stripe.checkout.sessions.retrieve(sessionId);
   if(session.customer!==row.customerId||session.client_reference_id!==String(userId)||session.mode!=='subscription'||session.livemode!==(config.mode==='live'))throw problem('This checkout does not belong to your account.',403);
   await sync(row);return {plan:await catalog(),billing:view(row)};
  });
 }
 async function portal(userId){return locked(userId,async row=>{
  await catalog();if(!row.customerId)throw problem('Start your subscription first.');
  const session=await stripe.billingPortal.sessions.create({customer:row.customerId,return_url:`${config.origin}/billing`,...(config.portal?{configuration:config.portal}:{})});return {url:session.url};
 });}
 async function event(event){
  if(event.livemode!==(config.mode==='live')||event.account)throw problem('Unexpected billing event context.');
  if(!['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','customer.subscription.created','customer.subscription.trial_will_end','customer.subscription.updated','customer.subscription.deleted','invoice.paid','invoice.payment_failed','invoice.payment_action_required'].includes(event.type))return;
  const obj=event.data.object,cid=typeof obj.customer==='string'?obj.customer:obj.customer?.id;if(!cid)return;
  const row=await Store.findOne({scope:config.scope,customerId:cid});if(!row)return;
  // Re-read authoritative subscriptions under the same lock. Duplicate and out-of-order
  // deliveries converge to current Stripe state instead of replaying stale event bodies.
  await locked(row.userId,async current=>{await catalog();await sync(current);});
 }
 async function manage(userId,cancelAtPeriodEnd,requestId){return locked(userId,async row=>{await catalog();await sync(row);if(!row.subscriptionId||!OPEN.has(row.status))throw problem('No manageable subscription was found.');await stripe.subscriptions.update(row.subscriptionId,{cancel_at_period_end:cancelAtPeriodEnd},{idempotencyKey:`rebound-admin-${requestId}`});await sync(row);return {billing:view(row)};});}
 return {status,checkout,confirm,portal,event,manage};
}
module.exports={billingConfig,makeClient,createBilling};
