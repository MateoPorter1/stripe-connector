const test=require('node:test'),assert=require('node:assert/strict');
const {collectionAccess:access}=require('../services/billingAccess');
const start=Date.UTC(2026,0,1),day=86400000,user={role:'user',plan:'premium'};
test('trial ends exactly after 14 days, even if Stripe trial was extended',()=>{
 const row={status:'trialing',trialStartedAt:new Date(start),trialEndsAt:new Date(start+30*day)};
 assert.equal(access(user,row,{now:start+14*day-1}).allowed,true);
 assert.equal(access(user,row,{now:start+14*day}).allowed,false);
});
test('only active paid service permits retries; legacy premium and test billing never do',()=>{
 for(const status of ['none','past_due','unpaid','incomplete','canceled','paused'])assert.equal(access(user,{status,paidThrough:new Date(start+day)},{now:start}).allowed,false);
 assert.equal(access(user,{status:'active'},{now:start}).allowed,false);
 assert.equal(access(user,{status:'active',paidThrough:new Date(start+day)},{now:start}).allowed,true);
 assert.equal(access(user,{status:'active',paidThrough:new Date(start+day)},{now:start+day}).allowed,false);
 assert.equal(access(user,{status:'active',paidThrough:new Date(start+day)},{now:start,mode:'test'}).allowed,false);
});
test('blocked workspaces deny access, including administrators',()=>{
 assert.equal(access({role:'admin'},null).allowed,true);
 assert.equal(access({role:'admin'},{collectionBlocked:true}).allowed,false);
});
test('malformed dates cannot grant access',()=>{
 assert.equal(access(user,{status:'trialing',trialStartedAt:'bad',trialEndsAt:'bad'}).allowed,false);
 assert.equal(access(user,{status:'active',paidThrough:'bad'}).allowed,false);
});
