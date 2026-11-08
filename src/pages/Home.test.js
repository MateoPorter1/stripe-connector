import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {Simulate} from 'react-dom/test-utils';
import Home from './Home';
import {statsRequest} from '../services/api';
jest.mock('../components/Sidebar',()=>()=>null);
jest.mock('../services/api',()=>({statsRequest:jest.fn()}));
jest.mock('recharts',()=>{
  const React=require('react');
  return {ResponsiveContainer:({children})=><div>{children}</div>,BarChart:({children,data})=><div>{React.Children.map(children,child=>React.isValidElement(child)?React.cloneElement(child,{data}):child)}</div>,
    Bar:({onClick,data})=><button onClick={()=>onClick(data[0],0)}>Chart bar</button>,XAxis:()=>null,YAxis:()=>null,CartesianGrid:()=>null,Tooltip:()=>null,Legend:()=>null};
});
const months=[{month:'Nov 2026',year:2026,monthNumber:11,amount:40,count:3},{month:'Oct 2026',year:2026,monthNumber:10,amount:15,count:1}];
const payment=(id,email='person@example.invalid')=>({_id:id,customerId:'cus_'+id,customerEmail:email,amount:1000,currency:'USD',recoveredAt:'2026-11-08T19:00:00.000Z',paymentIntentId:'pi_'+id,paymentMethodDetails:{brand:'visa',last4:'4242'},invoiceId:'in_'+id,subscriptionId:'sub_'+id,retryBatchId:'batch_'+id});
const result=(recoveries,extra={})=>({success:true,recoveries,totalCount:recoveries.length,customerCount:recoveries.length,totalAmount:recoveries.length*1000,currency:'USD',nextCursor:null,hasMore:false,...extra});
let root,container,historyHandler;
const button=label=>[...container.querySelectorAll('button')].find(item=>item.textContent.includes(label));
beforeEach(()=>{
  global.IS_REACT_ACT_ENVIRONMENT=true;historyHandler=jest.fn(async()=>result([payment('one')]));
  statsRequest.mockReset();statsRequest.mockImplementation(async(path,options)=>{
    if(path.startsWith('/summary'))return {success:true,summary:{totalsByCurrency:{USD:{totalAmount:5500,count:4}}}};
    if(path.startsWith('/by-month'))return {success:true,data:months};
    return historyHandler(path,options);
  });
  container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);
});
afterEach(()=>{act(()=>root.unmount());container.remove();});
test('clicking a month reveals people, amounts, dates, cards and original Stripe references',async()=>{
  await act(async()=>root.render(<Home/>));expect(historyHandler).not.toHaveBeenCalled();
  await act(async()=>button('Nov 2026').click());
  expect(historyHandler.mock.calls[0][0]).toContain('month=2026-11');expect(container.textContent).toContain('People charged — Nov 2026');expect(container.textContent).toContain('person@example.invalid');expect(container.textContent).toContain('visa •••• 4242');expect(container.textContent).toContain('$10.00');
  expect(container.querySelector('a[href="https://dashboard.stripe.com/payments/pi_one"]')).not.toBeNull();
  expect(container.querySelector('a[href="https://dashboard.stripe.com/invoices/in_one"]')).not.toBeNull();expect(container.textContent).toContain('batch_one');
  expect(statsRequest.mock.calls.every(call=>!call[1]?.method||call[1].method==='GET')).toBe(true);
});
test('chart bars use the same drill-down and history uses the applied filter, not unsubmitted edits',async()=>{
  await act(async()=>root.render(<Home/>));await act(async()=>button('This Month').click());
  const monthlyCall=statsRequest.mock.calls.filter(call=>call[0].startsWith('/by-month')).at(-1)[0];const applied=new URLSearchParams(monthlyCall.split('?')[1]);
  await act(async()=>Simulate.change(container.querySelector('#recoveryFrom'),{target:{value:'2020-01-01'}}));
  await act(async()=>button('Chart bar').click());const detail=new URLSearchParams(historyHandler.mock.calls[0][0].split('?')[1]);
  expect(detail.get('month')).toBe('2026-11');expect(detail.get('currency')).toBe('USD');expect(detail.get('startDate')).toBe(applied.get('startDate'));expect(detail.get('startDate')).not.toBe('2020-01-01');expect(detail.get('endDate')).toBe(applied.get('endDate'));
});
test('loads every page without dropping existing rows or duplicating payments',async()=>{
  historyHandler.mockResolvedValueOnce(result([payment('one'),payment('two')],{totalCount:3,hasMore:true,nextCursor:'next-page'})).mockResolvedValueOnce(result([payment('two'),payment('three')],{totalCount:3}));
  await act(async()=>root.render(<Home/>));await act(async()=>button('Nov 2026').click());await act(async()=>button('Load more payments').click());
  expect(historyHandler.mock.calls[1][0]).toContain('cursor=next-page');expect(container.querySelectorAll('tbody tr')).toHaveLength(3);expect(container.textContent).toContain('Showing 3 of 3 payments');
});
test('a slow response from an earlier month cannot replace the newly selected month',async()=>{
  let resolveOld;historyHandler.mockImplementationOnce(()=>new Promise(resolve=>{resolveOld=resolve;})).mockResolvedValueOnce(result([payment('oct','october@example.invalid')]));
  await act(async()=>root.render(<Home/>));await act(async()=>button('Nov 2026').click());await act(async()=>button('Oct 2026').click());await act(async()=>resolveOld(result([payment('nov','november@example.invalid')])));
  expect(container.textContent).toContain('People charged — Oct 2026');expect(container.textContent).toContain('october@example.invalid');expect(container.textContent).not.toContain('november@example.invalid');
});
test('historical gaps and request failures are explicit instead of invented details',async()=>{
  historyHandler.mockResolvedValueOnce(result([{...payment('old'),invoiceId:null,subscriptionId:null,retryBatchId:null,paymentMethodDetails:null}])).mockRejectedValueOnce(new Error('History unavailable'));
  await act(async()=>root.render(<Home/>));await act(async()=>button('Nov 2026').click());expect(container.textContent).toContain('Not recorded for this earlier payment');expect(container.textContent).toContain('Not recorded');
  await act(async()=>button('Oct 2026').click());expect(container.textContent).toContain('History unavailable');expect(container.querySelectorAll('tbody tr')).toHaveLength(0);
});
