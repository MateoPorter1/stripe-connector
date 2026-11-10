const {billingConfig,makeClient,createBilling}=require('./billing');
let cached;
function getBilling(){if(!cached){const config=billingConfig();cached={config,stripe:makeClient(config)};cached.service=createBilling({...cached,Store:require('../models/BillingAccount')});}return cached;}
async function assertRetryAccess(userId,{fresh=false}={}){
 if(process.env.REBOUND_BILLING_ENFORCE!=='true')return {allowed:true,reason:'billing_not_launched'};
 const User=require('../models/User'),Store=require('../models/BillingAccount'),{collectionAccess}=require('./billingAccess');
 const user=await User.findById(userId).select('role');
 if(!user)throw Object.assign(new Error('Your account could not be verified.'),{statusCode:401});
 const {config,service}=getBilling();
 let row=await Store.findOne({userId,scope:config.scope});
 const connection=await require('../models/StripeConnection').findOne({userId});
 if(!row?.collectionBlocked&&require('./stripeReviewAccess').hasSandboxReviewAccess(userId,connection))return {allowed:true,reason:'sandbox_review',message:'Stripe review workspace: sandbox testing only. Live collections are not enabled.'};
 // Refresh at run start/resume; during a run enforce dates on every card, refresh
 // at most once a minute, and honor webhook/admin revocation immediately.
 if(user.role!=='admin'&&(fresh||!row?.syncedAt||Date.now()-+row.syncedAt>60000)){await service.status(userId,user);row=await Store.findOne({userId,scope:config.scope});}
 const access=collectionAccess(user,row,{mode:config.mode});
 if(!access.allowed)throw Object.assign(new Error(access.message),{statusCode:402,code:access.reason});
 return access;
}
module.exports={getBilling,assertRetryAccess};
