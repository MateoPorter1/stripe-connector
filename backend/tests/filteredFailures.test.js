const {test}=require('node:test');
const assert=require('node:assert/strict');
const jwt=require('jsonwebtoken');
const {dateBounds,filteredFailuresPage,verifySelection}=require('../services/filteredFailures');
const scope={userId:'user1',keyHash:'hash',secret:'test-selection-secret',startDate:'2026-11-01',endDate:'2026-11-01'};
test('date bounds include the whole New York day across the fall DST change',()=>{
  const bounds=dateBounds(scope.startDate,scope.endDate);assert.equal(bounds.lte-bounds.gte+1,25*3600);
  assert.equal(new Date(bounds.gte*1000).toISOString(),'2026-11-01T04:00:00.000Z');
  assert.throws(()=>dateBounds('2026-02-30','2026-03-01'));assert.throws(()=>dateBounds('2026-11-03','2026-11-01'));
});
test('filter actual failed charge dates, deduplicate debt, exclude paid and one-time invoices',async()=>{
  const invoice={id:'in_1',created:1,subscription:'sub_1',status:'open',amount_remaining:4000,currency:'usd'};
  const charge=(id,changes={})=>({id,status:'failed',created:100,invoice,...changes});
  let params;
  const stripe={charges:{list:async p=>{params=p;return {data:[charge('ch_1'),charge('ch_2'),charge('ch_paid',{invoice:{...invoice,id:'in_2',status:'paid'}}),charge('ch_once',{invoice:{...invoice,id:'in_3',subscription:null}}),charge('ch_success',{status:'succeeded'})],has_more:false};}}};
  const page=await filteredFailuresPage(stripe,scope,scope);assert.deepEqual(params.created,dateBounds(scope.startDate,scope.endDate));
  assert.equal(page.invoices.length,1);assert.equal(page.invoices[0].failedPayments.length,2);
  const tokens=page.invoices.map(row=>row.selectionToken);const items=verifySelection(tokens,scope);assert.equal(items[0].invoiceId,'in_1');assert.equal(items[0].maxAmount,4000);
  assert.throws(()=>verifySelection(tokens,{...scope,userId:'other'}));assert.throws(()=>verifySelection(tokens,{...scope,keyHash:'other'}));assert.throws(()=>verifySelection(tokens,{...scope,endDate:'2026-11-02'}));
  assert.throws(()=>jwt.verify(tokens[0],scope.secret),'selection tokens cannot authenticate as a login token');
});
