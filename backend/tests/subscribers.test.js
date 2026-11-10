const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const {createSubscriberRouter}=require('../routes/subscribers');
const owner={_id:'507f1f77bcf86cd799439011',role:'admin'},customer={_id:'507f1f77bcf86cd799439012',role:'user',name:'Customer',email:'customer@example.invalid'};
async function serverFor(role,extra={}){const app=express();app.use(express.json());app.use('/subscribers',createSubscriberRouter({auth:(req,res,next)=>{req.user=role==='none'?null:role==='admin'?owner:customer;next();},...extra}));const s=app.listen(0,'127.0.0.1');await new Promise(r=>s.once('listening',r));return {url:`http://127.0.0.1:${s.address().port}/subscribers`,close:()=>new Promise(r=>s.close(r))};}
test('subscriber admin denies customers and unauthenticated callers',async()=>{for(const [role,status] of [['none',401],['user',403]]){const s=await serverFor(role);try{assert.equal((await fetch(s.url)).status,status);assert.equal((await fetch(`${s.url}/${customer._id}/block`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({blocked:true})})).status,status);}finally{await s.close();}}});
test('admin access block is recorded, scoped to Rebound and requires a reason',async()=>{
 let saved,entry;const Store={findOneAndUpdate:async(q,u)=>{saved={...q,...u.$set};},findOne:async()=>saved};const Audit={create:async x=>(entry={...x,save:async()=>{}})};
 const s=await serverFor('admin',{User:{findById:()=>({select:async()=>customer})},Store,Audit,runtime:()=>({config:{scope:'live:acct_rebound',mode:'live'}})});
 try{const opts=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const url=`${s.url}/${customer._id}/block`;assert.equal((await fetch(url,opts({blocked:true,requestId:'1234567890123456'}))).status,400);assert.equal(saved,undefined);
 const r=await fetch(url,opts({blocked:true,requestId:'1234567890123456',reason:'Support review'}));assert.equal(r.status,200);assert.equal(saved.scope,'live:acct_rebound');assert.equal(saved.collectionBlocked,true);assert.equal(entry.status,'completed');assert.equal((await r.json()).user.access.allowed,false);
 }finally{await s.close();}
});
