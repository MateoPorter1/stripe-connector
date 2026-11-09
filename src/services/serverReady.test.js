import { waitForServer } from './serverReady';
import { authFetch } from './authFetch';
jest.mock('./authFetch', () => ({ authFetch: jest.fn() }));
beforeEach(() => { jest.useFakeTimers(); authFetch.mockReset(); });
afterEach(() => jest.useRealTimers());
async function advance(ms) { for(let elapsed=0;elapsed<ms;elapsed+=2000) { await Promise.resolve(); await Promise.resolve(); jest.advanceTimersByTime(Math.min(2000,ms-elapsed)); await Promise.resolve(); } }
test('waits through an unavailable server and only calls the readiness endpoint', async () => {
  authFetch.mockResolvedValueOnce({ok:false,status:503}).mockResolvedValueOnce({ok:true,status:200});
  const first=waitForServer('/api');
  expect(waitForServer('/api')).toBe(first);
  await advance(4000);
  await first;
  expect(authFetch.mock.calls.map(call=>call[0])).toEqual(['/api/ready','/api/ready']);
  expect(jest.getTimerCount()).toBe(0);
});
test('stops waiting after a minute and allows a later retry', async () => {
  authFetch.mockRejectedValue(new Error('offline'));
  const result=waitForServer('/offline');
  const assertion=expect(result).rejects.toThrow('unavailable');
  await advance(60000);
  await assertion;
  authFetch.mockResolvedValue({ok:true});
  await expect(waitForServer('/offline')).resolves.toBeUndefined();
});
