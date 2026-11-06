import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Dashboard from './Dashboard';
import { getSubscriptionRecovery } from '../services/api';
jest.mock('../components/Sidebar', () => () => null);
jest.mock('../services/api', () => ({ ...jest.requireActual('../services/api'), getSubscriptionRecovery: jest.fn() }));
const invoice = id => ({ id, number: id, email: 'demo@example.invalid', currency: 'usd', amount: 1500, state: 'scheduled', explanation: 'Stripe has scheduled the next attempt.', nextAttempt: 1800000000, attempts: 2, stripeUrl: 'https://dashboard.stripe.com/invoices/'+id });
let root, container;
beforeEach(() => { global.IS_REACT_ACT_ENVIRONMENT = true; getSubscriptionRecovery.mockReset(); container=document.createElement('div');document.body.appendChild(container);root=createRoot(container); });
afterEach(() => { act(()=>root.unmount());container.remove(); });
test('loads automatically without card checks or per-row charge buttons', async()=>{
  getSubscriptionRecovery.mockResolvedValue({ success:true,invoices:[invoice('in_demo')],totalFetched:1,nextCursor:null });
  await act(async()=>{ root.render(<Dashboard/>); });
  expect(getSubscriptionRecovery.mock.calls[0][0]).toBe('open');
  expect(container.textContent).toContain('demo@example.invalid');
  expect(container.textContent).toContain('Retry scheduled');
  expect([...container.querySelectorAll('button')].some(button=>/Check cards|Retry Payment/.test(button.textContent))).toBe(false);
});
test('shows partial batches while the rest loads',async()=>{
  let finish;
  getSubscriptionRecovery.mockResolvedValueOnce({invoices:[invoice('in_a')],totalFetched:100,nextCursor:'in_cursor',hasMore:true})
    .mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  await act(async()=>{root.render(<Dashboard/>);});
  expect(container.textContent).toContain('in_a');expect(container.textContent).toContain('Totals may change');
  await act(async()=>{finish({invoices:[invoice('in_b')],totalFetched:1,nextCursor:null});});
  expect(container.textContent).toContain('101 invoices checked');
});
test('keeps visible invoices if a refresh fails',async()=>{
  getSubscriptionRecovery.mockResolvedValueOnce({invoices:[invoice('in_demo')],totalFetched:1,nextCursor:null}).mockRejectedValueOnce(new Error('Stripe unavailable'));
  await act(async()=>{root.render(<Dashboard/>);});
  await act(async()=>{[...container.querySelectorAll('button')].find(button=>button.textContent.includes('Refresh status')).click();});
  expect(container.textContent).toContain('demo@example.invalid');expect(container.textContent).toContain('Stripe unavailable');
});
