import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import Dashboard from './Dashboard';
import { getFailedTransactions } from '../services/api';
import { mergePaymentPages } from '../services/recoveryQueue';

jest.mock('../components/Sidebar', () => () => null);
jest.mock('../services/api', () => ({ ...jest.requireActual('../services/api'), getFailedTransactions: jest.fn() }));

const row = (id, amount = 1500, currency = 'usd') => ({ customer: 'cus_demo', currency, email: 'demo@example.invalid', country: 'US', paymentMethodsCount: null, transactions: [{ id, amount, currency, created: 1793952000 }], totalAmount: amount, failedCount: 1, latestDate: 1793952000 });
const page = (customers, nextCursor) => ({ success: true, customers, totalFetched: 100, hasMore: Boolean(nextCursor), nextCursor });
let container, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  getFailedTransactions.mockReset();
  container = document.createElement('div'); document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const button = text => [...container.querySelectorAll('button')].find(element => element.textContent.includes(text));

test('shows the first batch before the scan finishes; pause/resume ignores late responses', async () => {
  let finishOldPage;
  getFailedTransactions.mockResolvedValueOnce(page([row('pi_first')], 'pi_cursor'))
    .mockImplementationOnce(() => new Promise(resolve => { finishOldPage = resolve; }))
    .mockResolvedValueOnce(page([row('pi_second', 500)], null));
  await act(async () => { root.render(<Dashboard />); });
  await act(async () => { button('Load Failed').click(); });
  expect(container.textContent).toContain('demo@example.invalid');
  expect(container.textContent).toContain('Scanning Stripe');
  expect(container.textContent).toContain('$15.00');
  expect(getFailedTransactions.mock.calls[1][3]).toBe('pi_cursor');
  await act(async () => { button('Pause scan').click(); });
  expect(container.textContent).toContain('Scan incomplete');
  await act(async () => { button('Continue scan').click(); });
  expect(container.textContent).toContain('Scan complete.');
  expect(container.textContent).toContain('$20.00');
  expect(container.textContent).toContain('2 failed');
  await act(async () => { finishOldPage(page([row('pi_stale', 90000)], null)); });
  expect(container.textContent).toContain('$20.00');
  expect(container.textContent).not.toContain('$920.00');
});

test('a later batch error keeps results and allows continuation', async () => {
  getFailedTransactions.mockResolvedValueOnce(page([row('pi_first')], 'pi_cursor'))
    .mockResolvedValueOnce({ success: false, error: 'Temporary Stripe problem' });
  await act(async () => { root.render(<Dashboard />); });
  await act(async () => { button('Load Failed').click(); });
  expect(container.textContent).toContain('demo@example.invalid');
  expect(container.textContent).toContain('Temporary Stripe problem');
  expect(container.textContent).toContain('Scan incomplete');
  expect(button('Continue scan')).toBeDefined();
});

test('merges repeated customers without duplicate payments or mixed currencies', () => {
  const previous = [{ ...row('pi_a'), paymentMethodsCount: 2 }];
  const merged = mergePaymentPages(previous, [row('pi_a'), row('pi_b', 500), row('pi_eur', 200, 'eur')]);
  expect(merged).toHaveLength(2);
  const usd = merged.find(customer => customer.currency === 'usd');
  expect(usd.totalAmount).toBe(2000);
  expect(usd.failedCount).toBe(2);
  expect(usd.paymentMethodsCount).toBe(2);
});
