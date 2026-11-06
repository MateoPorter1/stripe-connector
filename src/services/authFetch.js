// Bound the entire authentication request, including reading the response body.
export async function authFetch(url, { timeoutMs = 15000, ...options } = {}) {
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('The server took too long to respond. Please try again.'));
    }, timeoutMs);
  });
  const request = (async () => {
    const response = await fetch(url, { ...options, signal: controller.signal });
    let data;
    try {
      data = await response.json();
    } catch (error) {
      if (response.ok) throw new Error('The server returned an unreadable response. Please try again.');
      data = {};
    }
    return { ok: response.ok, status: response.status, json: async () => data };
  })();
  try {
    return await Promise.race([request, deadline]);
  } catch (error) {
    if (controller.signal.aborted) throw new Error('The server took too long to respond. Please try again.');
    if (error instanceof TypeError) throw new Error('Cannot reach the server. Please try again shortly.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
