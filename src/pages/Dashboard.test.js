import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Dashboard from './Dashboard';
import { paymentBatchRequest } from '../services/api';
jest.mock('../components/Sidebar',()=>()=>null);
jest.mock('../services/api',()=>({...jest.requireActual('../services/api'),paymentBatchRequest:jest.fn()}));
const invoice=id=>({id,number:id,email:'demo@example.invalid',currency:'usd',amount:4000,failedPayments:['ch_'+id],lastFailure:1800000000,reason:'Declined',selectionToken:'signed_'+id,cardCount:3,eligibleCardCount:2});
let root,container;
const button=text=>[...container.querySelectorAll('button')].find(b=>b.textContent.includes(text));
beforeEach(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;paymentBatchRequest.mockReset();paymentBatchRequest.mockResolvedValue({success:true,ready:true});Object.defineProperty(global,'crypto',{configurable:true,value:{randomUUID:()=> '12345678-1234-1234-1234-123456789012'}});container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(()=>{act(()=>root.unmount());container.remove();});
test('opening page only reads status; applying dates never charges',async()=>{
  paymentBatchRequest.mockResolvedValueOnce({batch:null,attempts:[]}).mockResolvedValueOnce({invoices:[invoice('in_1')],totalFetched:1,nextCursor:null});
  await act(async()=>root.render(<Dashboard/>));expect(paymentBatchRequest.mock.calls.map(c=>c[0])).toEqual(['/latest']);
  expect(button('Retry filtered').disabled).toBe(true);
  await act(async()=>button('Apply dates').click());
  expect(paymentBatchRequest.mock.calls[1][0]).toMatch(/^\/failed\?startDate=/);expect(button('Retry filtered').disabled).toBe(false);
  expect(container.textContent).toContain('demo@example.invalid');expect(paymentBatchRequest.mock.calls.some(c=>c[1]?.method==='POST')).toBe(false);
});
test('one top button submits exactly the displayed, deduplicated snapshot',async()=>{
  paymentBatchRequest.mockResolvedValueOnce({batch:null}).mockResolvedValueOnce({invoices:[invoice('in_1')],totalFetched:100,nextCursor:'ch_cursor',hasMore:true}).mockResolvedValueOnce({invoices:[invoice('in_1'),invoice('in_2')],totalFetched:2,nextCursor:null});
  await act(async()=>root.render(<Dashboard/>));await act(async()=>button('Apply dates').click());
  expect(button('Retry filtered').textContent).toContain('(2)');
  paymentBatchRequest.mockResolvedValueOnce({batch:{_id:'batch_1',status:'completed',items:[],startDate:'a',endDate:'b'},attempts:[]});
  await act(async()=>button('Retry filtered').click());
  const request=paymentBatchRequest.mock.calls.find(c=>c[0]==='/start');const body=JSON.parse(request[1].body);
  expect(body.tokens).toEqual(['signed_in_1','signed_in_2']);expect(body.authorize).toBe(true);expect(body.requestId).toBeTruthy();
  expect(button('Retry filtered').disabled).toBe(true);
});
test('incomplete filtering cannot start a payment run',async()=>{
  paymentBatchRequest.mockResolvedValueOnce({batch:null}).mockResolvedValueOnce({invoices:[invoice('in_1')],totalFetched:100,nextCursor:'ch_cursor',hasMore:true}).mockRejectedValueOnce(new Error('Stripe unavailable'));
  await act(async()=>root.render(<Dashboard/>));await act(async()=>button('Apply dates').click());
  expect(container.textContent).toContain('Stripe unavailable');expect(button('Retry filtered').disabled).toBe(true);
});
test('keeps written-off and unavailable subscriptions visible, submits only payable rows',async()=>{
  const written={...invoice('in_written'),selectionToken:null,displayStatus:'written_off',retryNote:'Stripe marked this invoice uncollectible.'};
  const unavailable={...invoice('pi_deleted'),amount:null,failedAmount:14501,selectionToken:null,displayStatus:'unavailable',retryNote:'Original invoice unavailable.'};
  const paid={...invoice('in_paid'),selectionToken:null,displayStatus:'paid'};
  paymentBatchRequest.mockResolvedValueOnce({batch:null})
    .mockResolvedValueOnce({invoices:[invoice('in_1'),written,paid],totalFetched:100,nextCursor:null,nextPhase:'payments'})
    .mockResolvedValueOnce({invoices:[unavailable],totalFetched:100,nextCursor:null});
  await act(async()=>root.render(<Dashboard/>));await act(async()=>button('Apply dates').click());
  expect(paymentBatchRequest.mock.calls[2][0]).toContain('phase=payments');expect(container.textContent).toContain('in_written');expect(container.textContent).toContain('pi_deleted');expect(container.textContent).not.toContain('in_paid');
  expect(button('Retry filtered').textContent).toContain('(1)');
  await act(async()=>button('All failure history').click());expect(container.textContent).toContain('in_paid');
  paymentBatchRequest.mockResolvedValueOnce({batch:{_id:'batch_1',status:'completed',items:[]},attempts:[]});
  await act(async()=>button('Retry filtered').click());
  const request=paymentBatchRequest.mock.calls.find(call=>call[0]==='/start');expect(JSON.parse(request[1].body).tokens).toEqual(['signed_in_1']);
});
test('saved-card counts replace the invoice-status column without requiring a separate click',async()=>{
  paymentBatchRequest.mockResolvedValueOnce({batch:null}).mockResolvedValueOnce({invoices:[invoice('in_1')],totalFetched:1,nextCursor:null});
  await act(async()=>root.render(<Dashboard/>));await act(async()=>button('Apply dates').click());
  expect([...container.querySelectorAll('th')].map(th=>th.textContent)).toContain('Saved credit cards');
  expect([...container.querySelectorAll('th')].map(th=>th.textContent)).not.toContain('Invoice status');
  expect(container.querySelector('.saved-card-count').textContent).toContain('3 saved');
  expect(container.querySelector('.saved-card-count').textContent).toContain('2 eligible for retry');
  expect(paymentBatchRequest.mock.calls.some(call=>call[0]==='/ready')).toBe(true);
});
test('a confirmed successful collection turns the row green and stays visible after applying dates again',async()=>{
  paymentBatchRequest.mockResolvedValueOnce({batch:null}).mockResolvedValueOnce({invoices:[invoice('in_1')],totalFetched:1,nextCursor:null});
  await act(async()=>root.render(<Dashboard/>));await act(async()=>button('Apply dates').click());
  let dates;
  paymentBatchRequest.mockImplementationOnce(async(path,options)=>{
    const body=JSON.parse(options.body);dates=body;
    return {batch:{_id:'batch_1',status:'completed',startDate:body.startDate,endDate:body.endDate,items:[{invoiceId:'in_1',state:'paid',attempts:2}]},attempts:[]};
  });
  await act(async()=>button('Retry filtered').click());
  let paidRow=container.querySelector('tr.payment-row-paid');expect(paidRow).not.toBeNull();expect(paidRow.textContent).toContain('Paid');expect(paidRow.querySelector('.amount').textContent).toContain('$0.00');
  expect(container.textContent).toContain('0 included in retry');
  paymentBatchRequest.mockResolvedValueOnce({invoices:[{...invoice('in_1'),displayStatus:'paid',selectionToken:null,amount:0}],totalFetched:1,nextCursor:null});
  await act(async()=>button('Apply dates').click());
  expect(container.querySelector('tr.payment-row-paid')).not.toBeNull();expect(container.querySelector('.payment-row-paid').textContent).toContain('in_1');
  expect(dates.tokens).toEqual(['signed_in_1']);
});
test('an unsuccessful readiness check cannot enable real collections',async()=>{
  paymentBatchRequest.mockResolvedValueOnce({batch:null}).mockResolvedValueOnce({invoices:[invoice('in_1')],totalFetched:1,nextCursor:null}).mockRejectedValueOnce(new Error('The run is not ready.'));
  await act(async()=>root.render(<Dashboard/>));await act(async()=>button('Apply dates').click());
  expect(button('Retry filtered').disabled).toBe(true);expect(container.textContent).toContain('The run is not ready.');
  expect(paymentBatchRequest.mock.calls.some(call=>call[1]?.method==='POST')).toBe(false);
});
