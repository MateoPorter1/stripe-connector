import { authFetch } from './authFetch';

beforeEach(() => { jest.useFakeTimers(); global.fetch = jest.fn(); });
afterEach(() => { jest.useRealTimers(); delete global.fetch; });

test('times out even when headers arrive but the response body never finishes', async () => {
  fetch.mockResolvedValue({ ok: true, status: 200, json: () => new Promise(() => {}) });
  const result = authFetch('/auth/me', { timeoutMs: 6000 });
  const assertion = expect(result).rejects.toThrow('too long');
  await Promise.resolve();
  jest.advanceTimersByTime(6000);
  await assertion;
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
});

test('times out a request that does not honor cancellation', async () => {
  fetch.mockImplementation(() => new Promise(() => {}));
  const result = authFetch('/auth/me', { timeoutMs: 6000 });
  const assertion = expect(result).rejects.toThrow('too long');
  jest.advanceTimersByTime(6000);
  await assertion;
});

test('returns parsed authentication data and clears the deadline', async () => {
  fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ user: { id: 'demo' } }) });
  const response = await authFetch('/auth/me');
  expect(await response.json()).toEqual({ user: { id: 'demo' } });
  expect(jest.getTimerCount()).toBe(0);
});
