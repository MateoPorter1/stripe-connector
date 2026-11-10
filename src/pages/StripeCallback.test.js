import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import StripeCallback from './StripeCallback';
import { useAuth } from '../context/AuthContext';
import { stripeAppRequest } from '../services/stripeApp';
jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../services/stripeApp', () => ({ stripeAppRequest: jest.fn() }));
let container, root;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  window.history.replaceState(null, '', '/stripe/callback?code=ac_test&state=bound_test_state');
  useAuth.mockReturnValue({ loading: false, isAuthenticated: true });
  stripeAppRequest.mockReset();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
async function render() { await act(async () => { root.render(<React.StrictMode><MemoryRouter><StripeCallback /></MemoryRouter></React.StrictMode>); }); }
test('callback exchanges once under StrictMode, clears the code URL and never starts a payment run', async () => {
  stripeAppRequest.mockResolvedValue({ success: true, accountId: 'acct_fixture', mode: 'test' });
  await render();
  expect(stripeAppRequest).toHaveBeenCalledTimes(1);
  expect(stripeAppRequest.mock.calls[0][0]).toBe('/stripe-app/complete');
  expect(window.location.search).toBe('');
  expect(container.textContent).toContain('No collection has started');
  expect(container.querySelector('a[href="/dashboard"]')).not.toBeNull();
});
test('a signed-out callback requires a fresh connection instead of claiming another workspace', async () => {
  useAuth.mockReturnValue({ loading: false, isAuthenticated: false });
  await render();
  expect(stripeAppRequest).not.toHaveBeenCalled();
  expect(container.textContent).toContain('start a fresh Stripe connection');
});
test('a failed exchange does not claim success or automatically retry the code', async () => {
  stripeAppRequest.mockRejectedValue(new Error('Connection expired.'));
  await render();
  expect(stripeAppRequest).toHaveBeenCalledTimes(1);
  expect(container.querySelector('[role="alert"]').textContent).toBe('Connection expired.');
  expect(container.textContent).not.toContain('Stripe connected.');
});
