export async function authFetch(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The server took too long to respond. Please try again.');
    throw new Error('Cannot reach the server. Please try again shortly.');
  } finally { clearTimeout(timer); }
}
