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
test('filter actual failed charge dates, deduplicate debt, keep paid history, exclude genuine one-time invoices',async()=>{
  const invoice={id:'in_1',created:1,subscription:'sub_1',status:'open',amount_remaining:4000,currency:'usd'};
  const charge=(id,changes={})=>({id,status:'failed',created:100,invoice,payment_intent:{id:'pi_1',status:'requires_payment_method'},...changes});
  let params;
  const stripe={charges:{list:async p=>{params=p;return {data:[charge('ch_1'),charge('ch_2'),charge('ch_paid',{invoice:{...invoice,id:'in_2',status:'paid'}}),charge('ch_once',{invoice:{...invoice,id:'in_3',subscription:null}}),charge('ch_success',{status:'succeeded'})],has_more:false};}}};
  const page=await filteredFailuresPage(stripe,scope,scope);assert.deepEqual(params.created,dateBounds(scope.startDate,scope.endDate));
  assert.equal(page.invoices.length,2);assert.equal(page.invoices[1].displayStatus,'paid');assert.equal(page.invoices[1].selectionToken,undefined);assert.equal(page.invoices[0].failedPayments.length,2);
  const tokens=page.invoices.filter(row=>row.selectionToken).map(row=>row.selectionToken);const items=verifySelection(tokens,scope);assert.equal(items[0].invoiceId,'in_1');assert.equal(items[0].maxAmount,4000);
  assert.throws(()=>verifySelection(tokens,{...scope,userId:'other'}));assert.throws(()=>verifySelection(tokens,{...scope,keyHash:'other'}));assert.throws(()=>verifySelection(tokens,{...scope,endDate:'2026-11-02'}));
  assert.throws(()=>jwt.verify(tokens[0],scope.secret),'selection tokens cannot authenticate as a login token');
});
test('written-off, blocked and unavailable invoices remain visible but cannot authorize collection',async()=>{
  const base={id:'in_1',subscription:'sub_1',status:'open',amount_remaining:4000,currency:'usd'};
  const data=[
    {id:'ch_written',status:'failed',created:100,invoice:{...base,status:'uncollectible'},payment_intent:{id:'pi_written',status:'requires_payment_method'}},
    {id:'ch_blocked',status:'failed',created:110,invoice:{...base,id:'in_2'},payment_intent:{id:'pi_blocked',status:'requires_payment_method',latest_charge:{outcome:{type:'blocked'}}}},
    {id:'ch_gone',status:'failed',created:120,invoice:null,payment_intent:{id:'pi_gone',invoice:'in_gone',status:'canceled',cancellation_reason:'failed_invoice'}},
    {id:'ch_standalone',status:'failed',created:125,invoice:null,payment_intent:{id:'pi_standalone',status:'requires_payment_method'}}
  ];
  const page=await filteredFailuresPage({charges:{list:async()=>({data,has_more:false})}},scope,scope);
  assert.deepEqual(page.invoices.map(row=>row.displayStatus),['written_off','blocked','unavailable']);
  assert(page.invoices.every(row=>!row.selectionToken&&!row.retryable));assert.equal(page.invoices[2].amount,null);assert.equal(page.nextPhase,'payments');
});
test('cancelled failed-invoice payments without charges are included using the failure date',async()=>{
  const bounds=dateBounds(scope.startDate,scope.endDate);let params;
  const payment={id:'pi_nocharge',status:'canceled',cancellation_reason:'failed_invoice',created:bounds.gte+100,canceled_at:bounds.gte+101,invoice:null,latest_charge:null,amount:14501,currency:'usd',customer:{id:'cus_1',email:'missing@example.invalid'}};
  const stripe={paymentIntents:{list:async p=>{params=p;return {data:[payment,{...payment,id:'pi_outside',canceled_at:bounds.lte+1},{...payment,id:'pi_hascharge',latest_charge:'ch_existing'},{...payment,id:'pi_unattempted',status:'requires_confirmation'}],has_more:false};}}};
  const page=await filteredFailuresPage(stripe,{...scope,phase:'payments'},scope);
  assert.deepEqual(params.created,bounds);assert.equal(page.invoices.length,1);assert.equal(page.invoices[0].id,'pi_nocharge');assert.equal(page.invoices[0].email,'missing@example.invalid');assert.equal(page.invoices[0].displayStatus,'unavailable');assert.equal(page.invoices[0].payments[0].state,'failed');assert.equal(page.nextPhase,null);
});
test('merge pages preserves each invoice, unique payment counts and the newest failure explanation',()=>{
  const {combineFailureRows}=require('../services/filteredFailures');
  const newer={id:'in_1',lastFailure:200,reason:'newest',failedPayments:['ch_2'],payments:[{id:'pi_1',state:'failed'}]};
  const older={...newer,lastFailure:100,reason:'older',failedPayments:['ch_1']};
  const row=combineFailureRows(newer,older);assert.equal(row.reason,'newest');assert.equal(row.payments.length,1);assert.equal(row.failedPayments.length,2);
});
