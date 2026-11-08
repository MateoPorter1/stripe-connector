const {test}=require('node:test');
const assert=require('node:assert/strict');
const {recoveryFilter,recoveryHistory,historyPage}=require('../services/recoveryHistory');
const id=n=>String(n).padStart(24,'0');
function matches(row,filter){
  if(String(row.userId)!==String(filter.userId)||row.currency!==filter.currency)return false;
  const at=new Date(row.recoveredAt);
  if(filter.recoveredAt?.$gte&&at<filter.recoveredAt.$gte)return false;
  if(filter.recoveredAt?.$lte&&at>filter.recoveredAt.$lte)return false;
  if(filter.$or&&!filter.$or.some(condition=>condition.recoveredAt?.$lt?at<condition.recoveredAt.$lt:at.getTime()===condition.recoveredAt.getTime()&&String(row._id)<String(condition._id.$lt)))return false;
  return true;
}
function storage(rows){
  return {
    find:filter=>{
      let limit;const chain={sort:()=>chain,limit:n=>{limit=n;return chain;},select:fields=>{assert(!fields.includes('userId'));return chain;},lean:async()=>rows.filter(row=>matches(row,filter)).sort((a,b)=>new Date(b.recoveredAt)-new Date(a.recoveredAt)||String(b._id).localeCompare(String(a._id))).slice(0,limit)};return chain;
    },
    aggregate:async pipeline=>{const found=rows.filter(row=>matches(row,pipeline[0].$match));return found.length?[{count:found.length,totalAmount:found.reduce((sum,row)=>sum+row.amount,0),customers:[...new Set(found.map(row=>row.customerId))]}]:[];}
  };
}
test('month and applied date range intersect in New York time, including both whole end dates',()=>{
  const whole=recoveryFilter('owner',{month:'2026-11',currency:'usd'});
  assert.equal(whole.recoveredAt.$gte.toISOString(),'2026-11-01T04:00:00.000Z');
  assert.equal(whole.recoveredAt.$lte.toISOString(),'2026-12-01T04:59:59.999Z');
  const partial=recoveryFilter('owner',{month:'2026-11',currency:'usd',startDate:'2026-11-06',endDate:'2026-11-08'});
  assert.equal(partial.recoveredAt.$gte.toISOString(),'2026-11-06T05:00:00.000Z');
  assert.equal(partial.recoveredAt.$lte.toISOString(),'2026-11-09T04:59:59.999Z');
  assert.equal(partial.currency,'USD');assert.equal(partial.userId,'owner');
});
test('history stays within the owner, month, dates and currency, with exact totals and stable pagination',async()=>{
  const row=(n,changes={})=>({_id:id(n),userId:'owner',customerId:'cus_1',customerEmail:'customer@example.invalid',amount:1000,currency:'USD',recoveredAt:'2026-11-08T19:00:00.000Z',paymentIntentId:'pi_'+n,...changes});
  const db=storage([row(1),row(2),row(3,{customerId:'cus_2',amount:2000}),row(4,{userId:'other'}),row(5,{currency:'EUR'}),row(6,{recoveredAt:'2026-11-05T19:00:00.000Z'}),row(7,{recoveredAt:'2026-12-01T05:00:00.000Z'})]);
  const query={month:'2026-11',startDate:'2026-11-06',endDate:'2026-11-08',currency:'USD',limit:'2',userId:'other'};
  const first=await recoveryHistory(db,'owner',query);
  assert.equal(first.totalCount,3);assert.equal(first.totalAmount,4000);assert.equal(first.customerCount,2);
  assert.deepEqual(first.recoveries.map(row=>row._id),[id(3),id(2)]);assert(first.hasMore);
  const last=await recoveryHistory(db,'owner',{...query,cursor:first.nextCursor});
  assert.deepEqual(last.recoveries.map(row=>row._id),[id(1)]);assert.equal(last.hasMore,false);assert.equal(last.nextCursor,null);assert.equal(last.totalAmount,4000);
});
test('empty histories are explicit and malformed months, dates and cursors cannot broaden the query',async()=>{
  const result=await recoveryHistory(storage([]),'owner',{month:'2026-11'});assert.equal(result.totalCount,0);assert.equal(result.customerCount,0);assert.deepEqual(result.recoveries,[]);
  for(const month of ['2026-13','2026-00','all',{$gt:''}])assert.throws(()=>recoveryFilter('owner',{month}));
  assert.throws(()=>recoveryFilter('owner',{startDate:'2026-02-30'}));assert.throws(()=>recoveryFilter('owner',{startDate:'2026-11-08',endDate:'2026-11-01'}));
  assert.throws(()=>historyPage({limit:101}));assert.throws(()=>historyPage({cursor:'broken'}));
  await assert.rejects(recoveryHistory(storage([]),'owner',{}),/Choose a month/);
});
