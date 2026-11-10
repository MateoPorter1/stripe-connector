import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Dashboard from './Dashboard';
import {MemoryRouter} from 'react-router-dom';
import {billingRequest} from '../services/billing';
jest.mock('../services/billing',()=>({billingRequest:jest.fn()}));
import { paymentBatchRequest } from '../services/api';
jest.mock('../components/Sidebar',()=>()=>null);
jest.mock('../services/api',()=>({...jest.requireActual('../services/api'),paymentBatchRequest:jest.fn()}));
const invoice=id=>({id,number:id,email:'demo@example.invalid',currency:'usd',amount:4000,failedPayments:['ch_'+id],lastFailure:1800000000,reason:'Declined',selectionToken:'signed_'+id,cardCount:3,eligibleCardCount:2});
let root,container;
const button=text=>text==='Retry filtered'?document.querySelector('.desk-run-button'):[...document.querySelectorAll('button')].find(b=>b.textContent.includes(text));
const applyRange=async()=>{await act(async()=>button('Date range').click());await act(async()=>button('Apply').click());};
beforeEach(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;billingRequest.mockReset();billingRequest.mockResolvedValue({success:true,access:{allowed:true}});paymentBatchRequest.mockReset();paymentBatchRequest.mockResolvedValue({success:true,ready:true});Object.defineProperty(global,'crypto',{configurable:true,value:{randomUUID:()=> '12345678-1234-1234-1234-123456789012'}});container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(()=>{act(()=>root.unmount());container.remove();});
test('opening page automatically loads the last 15 New York days without charging',async()=>{
  paymentBatchRequest.mockResolvedValueOnce({batch:null,attempts:[]}).mockResolvedValueOnce({invoices:[invoice('in_1')],totalFetched:1,nextCursor:null});
  await act(async()=>root.render(<Dashboard/>));const params=new URLSearchParams(paymentBatchRequest.mock.calls[1][0].split('?')[1]);
  const end=new Date(params.get('endDate')+'T12:00:00Z');const start=new Date(params.get('startDate')+'T12:00:00Z');
  expect((end-start)/86400000).toBe(14);expect(button('Date range').textContent).toContain('Last 15 days');
  expect(paymentBatchRequest.mock.calls[1][0]).toMatch(/^\/failed\?startDate=/);expect(button('Retry filtered').disabled).toBe(false);
  expect(container.textContent).toContain('demo@example.invalid');expect(paymentBatchRequest.mock.calls.some(c=>c[1]?.method==='POST')).toBe(false);
});
test('one top button submits exactly the displayed, deduplicated snapshot',async()=>{
  paymentBatchRequest.mockResolvedValueOnce({batch:null}).mockResolvedValueOnce({invoices:[invoice('in_1')],totalFetched:100,nextCursor:'ch_cursor',hasMore:true}).mockResolvedValueOnce({invoices:[invoice('in_1'),invoice('in_2')],totalFetched:2,nextCursor:null});
  await act(async()=>root.render(<Dashboard/>));
  expect(button('Retry filtered').textContent).toContain('(2)');
  paymentBatchRequest.mockResolvedValueOnce({batch:{_id:'batch_1',status:'completed',items:[],startDate:'a',endDate:'b'},attempts:[]});
  await act(async()=>button('Retry filtered').click());
  const request=paymentBatchRequest.mock.calls.find(c=>c[0]==='/start');const body=JSON.parse(request[1].body);
  expect(body.tokens).toEqual(['signed_in_1','signed_in_2']);expect(body.authorize).toBe(true);expect(body.requestId).toBeTruthy();
  expect(button('Retry filtered').disabled).toBe(true);
});
test('incomplete filtering cannot start a payment run',async()=>{
  paymentBatchRequest.mockResolvedValueOnce({batch:null}).mockResolvedValueOnce({invoices:[invoice('in_1')],totalFetched:100,nextCursor:'ch_cursor',hasMore:true}).mockRejectedValueOnce(new Error('Stripe unavailable'));
  await act(async()=>root.render(<Dashboard/>));
  expect(container.textContent).toContain('Stripe unavailable');expect(button('Retry filtered').disabled).toBe(true);
});
test('keeps written-off and unavailable subscriptions visible, submits only payable rows',async()=>{
  const written={...invoice('in_written'),selectionToken:null,displayStatus:'written_off',retryNote:'Stripe marked this invoice uncollectible.'};
  const unavailable={...invoice('pi_deleted'),amount:null,failedAmount:14501,selectionToken:null,displayStatus:'unavailable',retryNote:'Original invoice unavailable.'};
  const paid={...invoice('in_paid'),selectionToken:null,displayStatus:'paid'};
  paymentBatchRequest.mockResolvedValueOnce({batch:null})
    .mockResolvedValueOnce({invoices:[invoice('in_1'),written,paid],totalFetched:100,nextCursor:null,nextPhase:'payments'})
    .mockResolvedValueOnce({invoices:[unavailable],totalFetched:100,nextCursor:null});
  await act(async()=>root.render(<Dashboard/>));
  expect(paymentBatchRequest.mock.calls[2][0]).toContain('phase=payments');expect(container.textContent).toContain('in_written');expect(container.textContent).toContain('pi_deleted');expect(container.textContent).not.toContain('in_paid');
  expect(button('Retry filtered').textContent).toContain('(1)');
  await act(async()=>button('All failure history').click());expect(container.textContent).toContain('in_paid');
  paymentBatchRequest.mockResolvedValueOnce({batch:{_id:'batch_1',status:'completed',items:[]},attempts:[]});
  await act(async()=>button('Retry filtered').click());
  const request=paymentBatchRequest.mock.calls.find(call=>call[0]==='/start');expect(JSON.parse(request[1].body).tokens).toEqual(['signed_in_1']);
});
test('saved-card counts replace the invoice-status column without requiring a separate click',async()=>{
  paymentBatchRequest.mockResolvedValueOnce({batch:null}).mockResolvedValueOnce({invoices:[invoice('in_1')],totalFetched:1,nextCursor:null});
  await act(async()=>root.render(<Dashboard/>));
  expect([...container.querySelectorAll('th')].map(th=>th.textContent)).toContain('Saved credit cards');
  expect([...container.querySelectorAll('th')].map(th=>th.textContent)).not.toContain('Invoice status');
  expect(container.querySelector('.saved-card-count').textContent).toContain('3 saved');
  expect(container.querySelector('.saved-card-count').textContent).toContain('2 eligible for retry');
  expect(paymentBatchRequest.mock.calls.some(call=>call[0]==='/ready')).toBe(true);
});
test('a confirmed successful collection turns the row green and stays visible after applying dates again',async()=>{
  paymentBatchRequest.mockResolvedValueOnce({batch:null}).mockResolvedValueOnce({invoices:[invoice('in_1')],totalFetched:1,nextCursor:null});
  await act(async()=>root.render(<Dashboard/>));
  let dates;
  paymentBatchRequest.mockImplementationOnce(async(path,options)=>{
    const body=JSON.parse(options.body);dates=body;
    return {batch:{_id:'batch_1',status:'completed',startDate:body.startDate,endDate:body.endDate,items:[{invoiceId:'in_1',state:'paid',attempts:2}]},attempts:[]};
  });
  await act(async()=>button('Retry filtered').click());
  let paidRow=container.querySelector('tr.payment-row-paid');expect(paidRow).not.toBeNull();expect(paidRow.textContent).toContain('Paid');expect(paidRow.querySelector('.amount').textContent).toContain('$0.00');
  expect(container.textContent).toContain('0 included in retry');
  paymentBatchRequest.mockResolvedValueOnce({invoices:[{...invoice('in_1'),displayStatus:'paid',selectionToken:null,amount:0}],totalFetched:1,nextCursor:null});
  await applyRange();
  expect(container.querySelector('tr.payment-row-paid')).not.toBeNull();expect(container.querySelector('.payment-row-paid').textContent).toContain('in_1');
  expect(dates.tokens).toEqual(['signed_in_1']);
});
test('an unsuccessful readiness check cannot enable real collections',async()=>{
  paymentBatchRequest.mockResolvedValueOnce({batch:null}).mockResolvedValueOnce({invoices:[invoice('in_1')],totalFetched:1,nextCursor:null}).mockRejectedValueOnce(new Error('The run is not ready.'));
  await act(async()=>root.render(<Dashboard/>));
  expect(button('Retry filtered').disabled).toBe(true);expect(container.textContent).toContain('The run is not ready.');
  expect(paymentBatchRequest.mock.calls.some(call=>call[1]?.method==='POST')).toBe(false);
});

test('design preview never reads live payment data or enables collections',async()=>{
 await act(async()=>root.render(<MemoryRouter><Dashboard preview/></MemoryRouter>));
 expect(paymentBatchRequest).not.toHaveBeenCalled();expect(button('Retry filtered').disabled).toBe(true);expect(container.textContent).toContain('Preview workspace · Live collection disabled');
 await applyRange();expect(paymentBatchRequest).not.toHaveBeenCalled();expect(button('Retry filtered').disabled).toBe(true);
});

test('opening an invoice detail drawer is read-only and closing restores the table',async()=>{
 paymentBatchRequest.mockResolvedValueOnce({batch:null}).mockResolvedValueOnce({invoices:[invoice('in_details')],totalFetched:1,nextCursor:null});
 await act(async()=>root.render(<Dashboard/>));
 await act(async()=>container.querySelector('.desk-customer-button').click());
 const dialog=document.querySelector('[role="dialog"]');expect(dialog).not.toBeNull();expect(dialog.textContent).toContain('demo@example.invalid');expect(dialog.textContent).toContain('Saved credit cards');expect(dialog.textContent).toContain('3');
 expect(paymentBatchRequest.mock.calls.some(call=>call[1]?.method==='POST')).toBe(false);
 await act(async()=>document.querySelector('[aria-label="Close invoice details"]').click());expect(document.querySelector('[role="dialog"]')).toBeNull();expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
});

test('an interrupted scan resumes at the failed page without losing rows or charging',async()=>{
 paymentBatchRequest.mockResolvedValueOnce({batch:null})
  .mockResolvedValueOnce({invoices:[invoice('in_first')],totalFetched:100,nextCursor:'ch_next',hasMore:true})
  .mockRejectedValueOnce(new Error('Connection lost'));
 await act(async()=>root.render(<Dashboard/>));
 expect(container.textContent).toContain('in_first');expect(button('Retry filtered').disabled).toBe(true);
 paymentBatchRequest.mockResolvedValueOnce({invoices:[invoice('in_second')],totalFetched:10,nextCursor:null});
 await act(async()=>button('Resume scan').click());
 expect(paymentBatchRequest.mock.calls[3][0]).toContain('cursor=ch_next');
 expect(container.textContent).toContain('in_first');expect(container.textContent).toContain('in_second');
 expect(container.textContent).toContain('110 payments checked');expect(button('Retry filtered').disabled).toBe(false);
 expect(paymentBatchRequest.mock.calls.some(call=>call[1]?.method==='POST')).toBe(false);
});

test('explains why recovery is disabled while scanning and what to do when ready',async()=>{
 let finish;
 paymentBatchRequest.mockResolvedValueOnce({batch:null}).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 await act(async()=>root.render(<Dashboard/>));
 expect(container.querySelector('.collection-next').textContent).toContain('Nothing is being charged');
 expect(button('Retry filtered').textContent).toContain('Finding payments');expect(button('Retry filtered').disabled).toBe(true);
 await act(async()=>finish({invoices:[invoice('in_guidance')],totalFetched:1,nextCursor:null}));
 expect(container.querySelector('.collection-next').textContent).toContain('click Start recovery');
 expect(button('Retry filtered').textContent).toContain('Start recovery (1)');
 expect(container.textContent).toContain('Unpaid amount available to retry');
 expect(paymentBatchRequest.mock.calls.some(call=>call[1]?.method==='POST')).toBe(false);
});

 test('expired subscription leaves reading available and blocks start with billing link',async()=>{billingRequest.mockResolvedValue({success:true,access:{allowed:false,message:'Your trial has ended.'}});paymentBatchRequest.mockResolvedValueOnce({batch:null}).mockResolvedValueOnce({invoices:[invoice('in_1')],totalFetched:1,nextCursor:null});await act(async()=>root.render(<MemoryRouter><Dashboard/></MemoryRouter>));expect(container.textContent).toContain('Your trial has ended.');expect(container.textContent).toContain('demo@example.invalid');expect(button('Retry filtered').disabled).toBe(true);expect(container.querySelector('a[href="/billing"]')).toBeTruthy();});
