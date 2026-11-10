// Pure access decision, also used in admin summaries. Never trust a browser plan flag.
function collectionAccess(user,row,{now=Date.now(),mode='live'}={}){
 if(row?.collectionBlocked)return {allowed:false,reason:'blocked',message:'Collection access is disabled. Contact support.'};
 if(user.role==='admin')return {allowed:true,reason:'administrator',message:'Administrator workspace'};
 if(mode!=='live')return {allowed:false,reason:'test_only',message:'A test subscription does not unlock live payment retries.'};
 if(row?.status==='trialing'&&row.trialStartedAt&&row.trialEndsAt){
  const end=Math.min(+new Date(row.trialEndsAt),+new Date(row.trialStartedAt)+14*86400000);
  if(now<end)return {allowed:true,reason:'trial',until:new Date(end),message:'Your 14-day trial is active.'};
 }
 if(row?.status==='active'&&row.paidThrough&&now<+new Date(row.paidThrough))return {allowed:true,reason:'paid',until:row.paidThrough,message:'Your paid subscription is active.'};
 return {allowed:false,reason:row?.status==='past_due'?'payment_failed':'subscription_required',message:row?.status==='past_due'?'Your subscription payment failed. Update billing to resume retries.':'Start your 14-day trial or subscribe for $50/month to retry payments.'};
}
module.exports={collectionAccess};
