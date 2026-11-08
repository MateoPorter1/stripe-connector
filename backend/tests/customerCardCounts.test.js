const {test}=require('node:test');
const assert=require('node:assert/strict');
const {countCustomerCards,enrichCardCounts}=require('../services/customerCardCounts');
const card=(id,changes={})=>({id,customer:'cus_1',type:'card',card:{fingerprint:id,exp_year:2099,exp_month:12},...changes});
test('counts every saved card, including expired cards, and reports distinct eligible cards separately',async()=>{
  const calls=[];
  const stripe={paymentMethods:{list:async params=>{calls.push(params);return calls.length===1?{data:[card('pm_1'),card('pm_expired',{card:{fingerprint:'old',exp_year:2000,exp_month:1}})],has_more:true}:{data:[card('pm_duplicate',{card:{fingerprint:'pm_1',exp_year:2099,exp_month:12}}),card('pm_foreign',{customer:'cus_else'})],has_more:false};}}};
  const result=await countCustomerCards(stripe,'cus_1');
  assert.equal(result.cardCount,3);assert.equal(result.eligibleCardCount,1);assert.equal(calls[1].starting_after,'pm_expired');
  assert(calls.every(call=>call.customer==='cus_1'&&call.type==='card'));
});
test('reads each customer once across invoices and pages; never shares counts between Stripe connections',async()=>{
  let firstCalls=0,secondCalls=0;
  const one={paymentMethods:{list:async()=>{firstCalls++;return {data:[card('pm_1')],has_more:false};}}};
  const two={paymentMethods:{list:async()=>{secondCalls++;return {data:[card('pm_1'),card('pm_2')],has_more:false};}}};
  const rows=[{id:'in_a',customerId:'cus_1'},{id:'in_b',customerId:'cus_1'}],scope={userId:'test-user',keyHash:'connection-one'};
  let result=await enrichCardCounts(one,rows,scope);assert.deepEqual(result.map(row=>row.cardCount),[1,1]);assert.equal(firstCalls,1);
  await enrichCardCounts(one,rows,scope);assert.equal(firstCalls,1);
  result=await enrichCardCounts(two,rows,{...scope,keyHash:'connection-two'});assert.equal(result[0].cardCount,2);assert.equal(secondCalls,1);
});
test('unknown counts are not zero and a failed lookup can be retried',async()=>{
  let calls=0;const stripe={paymentMethods:{list:async()=>{if(++calls===1)throw new Error('Stripe unavailable');return {data:[],has_more:false};}}};
  const rows=[{id:'in_a',customerId:'cus_1'}],scope={userId:'failed-test',keyHash:'connection'};
  const failed=await enrichCardCounts(stripe,rows,scope);assert.equal(failed[0].cardCount,null);assert.equal(failed[0].cardCountError,true);
  const recovered=await enrichCardCounts(stripe,rows,scope);assert.equal(recovered[0].cardCount,0);assert.equal(recovered[0].cardCountError,false);
});
