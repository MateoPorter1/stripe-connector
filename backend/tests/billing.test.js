const test=require('node:test');const assert=require('node:assert/strict');
const {createBilling,billingConfig}=require('../services/billing');
const Stripe=require('stripe-billing');const express=require('express');
const {createBillingRoutes}=require('../routes/billing');
function fixture(){
 const config={scope:'test:acct_rebound',account:'acct_rebound',price:'price_monthly',origin:'http://localhost:3000',webhookSecret:'whsec_fixture'};
 let rows=[],subs=[],sessions=new Map(),count=0,calls=[];
 function match(row,q){return Object.entries(q).every(([k,v])=>k==='$or'?v.some(x=>match(row,x)):v&&typeof v==='object'&&'$lte'in v?row[k]!=null&&+row[k]<=+v.$lte:row[k]==v);}
 function wrap(row){return Object.assign({...row}, {async save(){const dest=rows.find(x=>x._id===this._id);for(const [k,v]of Object.entries(this))if(typeof v!=='function')dest[k]=v;return this;}});}
 const Store={init:async()=>{},async findOne(q){const row=rows.find(x=>match(x,q));return row?wrap(row):null;},async findOneAndUpdate(q,u,o={}){let row=rows.find(x=>match(x,q));if(!row&&o.upsert){row={_id:String(++count),...u.$setOnInsert};rows.push(row);}if(!row)return null;if(u.$set)Object.assign(row,u.$set);return wrap(row);},async updateOne(q,u){const row=rows.find(x=>match(x,q));if(row&&u.$unset)for(const k of Object.keys(u.$unset))delete row[k];}};
 const stripe={accounts:{retrieve:async()=>({id:'acct_rebound'})},prices:{retrieve:async()=>({id:'price_monthly',livemode:false,active:true,type:'recurring',recurring:{interval:'month',interval_count:1},unit_amount:100,currency:'usd',product:{name:'Rebound TEST',active:true}})},customers:{create:async(p,o)=>{calls.push(['customer',p,o]);return {id:'cus_ours'};}},subscriptions:{list:async()=>({data:subs,has_more:false})},checkout:{sessions:{create:async(p,o)=>{calls.push(['checkout',p,o]);const s={id:'cs_test_ABC',url:'https://checkout.stripe.com/c/pay/cs_test_ABC',expires_at:Math.floor(Date.now()/1000)+1800,status:'open',customer:p.customer,client_reference_id:p.client_reference_id,mode:'subscription',livemode:false};sessions.set(s.id,s);return s;},retrieve:async id=>{const s=sessions.get(id);if(!s)throw Error('missing');return s;}}},billingPortal:{sessions:{create:async p=>{calls.push(['portal',p]);return {url:'https://billing.stripe.com/p/session/test_x'};}}},webhooks:new Stripe('sk_test_fixture').webhooks};
 return {config,Store,stripe,calls,rows,sessions,service:createBilling({config,Store,stripe}),setSubs(x){subs=x;}};
}
const user={_id:'user1',name:'Test user',email:'billing@example.com'};
const sub=(status='active',extra={})=>({id:'sub_ours',status,created:2,items:{data:[{price:{id:'price_monthly'},current_period_end:1900000000}]},...extra});
test('billing config rejects live keys and live mode; fixes return origin server-side',()=>{
 const env={BILLING_ENABLED:'true',BILLING_MODE:'test',REBOUND_BILLING_KEY:'rk_test_fixture',REBOUND_BILLING_ACCOUNT:'acct_rebound',REBOUND_BILLING_PRICE:'price_monthly',REBOUND_BILLING_WEBHOOK_SECRET:'whsec_fixture',BILLING_APP_ORIGIN:'http://localhost:3000/path'};
 assert.equal(billingConfig(env).origin,'http://localhost:3000');
 assert.throws(()=>billingConfig({...env,REBOUND_BILLING_KEY:'sk_live_fixture'}));assert.throws(()=>billingConfig({...env,BILLING_MODE:'live'}));assert.throws(()=>billingConfig({...env,BILLING_APP_ORIGIN:'http://untrusted.example'}));
});
test('checkout uses only configured price, reuses open checkout and separate billing customer',async()=>{
 const f=fixture();const one=await f.service.checkout(user),two=await f.service.checkout(user);assert.deepEqual(one,two);
 const calls=f.calls.filter(c=>c[0]==='checkout');assert.equal(calls.length,1);const p=calls[0][1];assert.equal(p.mode,'subscription');assert.equal(p.line_items[0].price,'price_monthly');assert.equal(p.customer,'cus_ours');assert.equal(p.client_reference_id,'user1');assert.match(p.integration_identifier,/rebound_billing_[a-z]{8}$/);assert.equal(p.payment_method_types,undefined);assert.equal(p.subscription_data.trial_period_days,undefined);
 assert.equal(user.plan,undefined);assert.equal(user.stripeApiKey,undefined);
});
test('blocks an existing subscription and routes management to owned customer',async()=>{
 const f=fixture();await f.service.checkout(user);f.setSubs([sub('past_due')]);await assert.rejects(()=>f.service.checkout(user),/already exists/);await f.service.portal('user1');assert.equal(f.calls.find(x=>x[0]==='portal')[1].customer,'cus_ours');
});
test('success redirect cannot grant access or confirm another customer checkout',async()=>{
 const f=fixture();await f.service.checkout(user);let result=await f.service.confirm('user1','cs_test_ABC');assert.equal(result.billing.status,'none');assert.equal(result.billing.testSubscriptionActive,false);assert.equal(result.billing.liveAccessChanged,false);
 f.sessions.get('cs_test_ABC').customer='cus_other';await assert.rejects(()=>f.service.confirm('user1','cs_test_ABC'),/does not belong/);
});
test('failed, paid, duplicate, old and cancellation events converge to authoritative subscription',async()=>{
 const f=fixture();await f.service.checkout(user);const evt={livemode:false,type:'invoice.paid',data:{object:{customer:'cus_ours'}}};
 f.setSubs([sub('past_due')]);await f.service.event(evt);assert.equal((await f.service.status('user1')).billing.testSubscriptionActive,false);
 f.setSubs([sub('active')]);await f.service.event(evt);await f.service.event(evt);assert.equal((await f.service.status('user1')).billing.testSubscriptionActive,true);
 f.setSubs([sub('active',{cancel_at_period_end:true})]);await f.service.event({...evt,type:'invoice.payment_failed'});assert.equal((await f.service.status('user1')).billing.cancelAtPeriodEnd,true);
 f.setSubs([sub('canceled')]);await f.service.event(evt);assert.equal((await f.service.status('user1')).billing.status,'canceled');
 await assert.rejects(()=>f.service.event({...evt,livemode:true}));await assert.rejects(()=>f.service.event({...evt,account:'acct_client'}));
});
test('transient checkout failure retries the exact same idempotency parameters',async()=>{
 const f=fixture();let tries=[];const original=f.stripe.checkout.sessions.create;
 f.stripe.checkout.sessions.create=async(p,o)=>{tries.push([p,o]);if(tries.length===1)throw Error('timeout');return original(p,o);};
 await assert.rejects(()=>f.service.checkout(user),/timeout/);await f.service.checkout(user);assert.deepEqual(tries[0],tries[1]);
});
test('an active lock prevents concurrent checkout starts',async()=>{
 const f=fixture();await f.service.status('user1');f.rows[0].leaseUntil=new Date(Date.now()+60000);await assert.rejects(()=>f.service.checkout(user),e=>e.statusCode===409);
});
test('webhook verifies original bytes, rejects forged signatures and accepts signed retry',async()=>{
 const f=fixture();await f.service.checkout(user);f.setSubs([sub()]);const env={BILLING_ENABLED:'true',BILLING_MODE:'test',REBOUND_BILLING_KEY:'sk_test_fixture',REBOUND_BILLING_ACCOUNT:f.config.account,REBOUND_BILLING_PRICE:f.config.price,REBOUND_BILLING_WEBHOOK_SECRET:f.config.webhookSecret};
 const routes=createBillingRoutes({Store:f.Store,stripe:f.stripe,env,auth:(req,res,next)=>{req.user=user;next();}}),app=express();app.post('/webhook',express.raw({type:'application/json'}),routes.webhook);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url=`http://127.0.0.1:${server.address().port}/webhook`;
 const payload=JSON.stringify({id:'evt_fixture',livemode:false,type:'invoice.paid',data:{object:{customer:'cus_ours'}}});
 try{let r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','stripe-signature':'fake'},body:payload});assert.equal(r.status,400);
 const signature=f.stripe.webhooks.generateTestHeaderString({payload,secret:f.config.webhookSecret});r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','stripe-signature':signature},body:payload});assert.equal(r.status,200);assert.equal((await f.service.status('user1')).billing.status,'active');
 }finally{await new Promise(r=>server.close(r));}
});

test('a cancelled subscription can start a new checkout even when old checkout completed',async()=>{
 const f=fixture();await f.service.checkout(user);f.sessions.get('cs_test_ABC').status='complete';f.setSubs([sub('canceled')]);await f.service.checkout(user);assert.equal(f.calls.filter(c=>c[0]==='checkout').length,2);
});
