import { authFetch } from './authFetch';

const pending = new Map();
// Only retry this read-only check. Never replay a login or payment request.
export function waitForServer(apiUrl) {
  if (pending.has(apiUrl)) return pending.get(apiUrl);
  const request = (async () => {
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      try {
        const response = await authFetch(`${apiUrl}/ready`, {
          timeoutMs: Math.min(10000, deadline - Date.now()), cache: 'no-store'
        });
        if (response.ok) return;
        if (response.status !== 503 && response.status !== 502 && response.status !== 504) {
          throw new Error('Unexpected readiness response');
        }
      } catch (_) {
        // A sleeping host may not respond until its process has started.
      }
      const remaining = deadline - Date.now();
      if (remaining > 0) await new Promise(resolve => setTimeout(resolve, Math.min(2000, remaining)));
    }
    throw new Error('The server is unavailable right now. Please try again shortly.');
  })();
  pending.set(apiUrl, request);
  request.finally(() => pending.delete(apiUrl)).catch(() => {});
  return request;
}
