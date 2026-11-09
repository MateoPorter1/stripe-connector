import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import PrivateRoute from '../components/PrivateRoute';
import { authFetch } from '../services/authFetch';

jest.mock('../services/serverReady', () => ({ waitForServer: jest.fn().mockResolvedValue() }));
jest.mock('../services/authFetch', () => ({ authFetch: jest.fn() }));
let root, container;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.setItem('token', 'saved-test-session');
  authFetch.mockReset();
  container = document.createElement('div'); document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); localStorage.clear(); });
async function render() {
  await act(async () => { root.render(<MemoryRouter initialEntries={['/dashboard']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AuthProvider><Routes><Route path="/dashboard" element={<PrivateRoute><h1>Payment queue</h1></PrivateRoute>} /><Route path="/login" element={<h1>Sign in</h1>} /></Routes></AuthProvider></MemoryRouter>); });
}

test('a server outage preserves login and retry opens the workspace', async () => {
  authFetch.mockResolvedValueOnce({ ok: false, status: 503 })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ user: { id: 'demo' } }) });
  await render();
  expect(container.textContent).toContain('Couldn’t reach your workspace');
  expect(container.textContent).not.toContain('Payment queue');
  expect(localStorage.getItem('token')).toBe('saved-test-session');
  expect(authFetch.mock.calls[0][1].timeoutMs).toBe(6000);
  await act(async () => { [...container.querySelectorAll('button')].find(button => button.textContent === 'Try again').click(); });
  expect(container.textContent).toContain('Payment queue');
});

test('an expired login redirects to sign in and clears the invalid token', async () => {
  authFetch.mockResolvedValue({ ok: false, status: 401 });
  await render();
  expect(container.textContent).toBe('Sign in');
  expect(localStorage.getItem('token')).toBe(null);
});

test('a timeout offers recovery rather than silently returning to login', async () => {
  authFetch.mockRejectedValue(new Error('The server took too long to respond. Please try again.'));
  await render();
  expect(container.querySelector('[role="alert"]').textContent).toContain('too long');
  expect(container.textContent).toContain('Try again');
  expect(localStorage.getItem('token')).toBe('saved-test-session');
});
