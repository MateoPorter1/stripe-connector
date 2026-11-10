const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').trim().replace(/\/$/, '');
export async function stripeAppRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, { ...options, signal: AbortSignal.timeout(20000),
    headers: { 'Content-Type': 'application/json', ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}) } });
  const data = await response.json();
  if (!response.ok || data.success === false) throw new Error(data.error || 'Could not update the Stripe connection. Please try again.');
  return data;
}
export async function beginStripeInstall(mode) {
  const { url } = await stripeAppRequest('/stripe-app/start', { method: 'POST', body: JSON.stringify({ mode }) });
  const destination = new URL(url);
  if (destination.origin !== 'https://marketplace.stripe.com' || !/^\/oauth\/v2\/(?:chnlink_[A-Za-z0-9]+\/)?authorize$/.test(destination.pathname)) throw new Error('Invalid Stripe installation destination.');
  window.location.assign(destination.toString());
}
