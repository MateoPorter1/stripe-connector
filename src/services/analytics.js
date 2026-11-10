// Only public authentication steps are measured. Never send account/customer data.
const measurementId = process.env.REACT_APP_GA4_MEASUREMENT_ID;
let initialized = false;
let lastPage = '';
function safeReferrer() {
  try { return document.referrer ? new URL(document.referrer).origin + '/' : ''; } catch (_) { return ''; }
}
function initialize() {
  if (!/^G-[A-Z0-9]+$/.test(measurementId || '')) return false;
  if (!initialized) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      send_page_view: false,
      page_location: window.location.origin + window.location.pathname,
      page_referrer: safeReferrer()
    });
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);
    initialized = true;
  }
  return true;
}
export function trackAuthEvent(name, page) {
  try {
    if (!['signup_start', 'sign_up', 'login'].includes(name) || !['/signup', '/login'].includes(page) || !initialize()) return;
    window.gtag('event', name, { method: 'email', send_to: measurementId,
      page_location: window.location.origin + page, page_referrer: safeReferrer(),
      transport_type: 'beacon' });
  } catch (_) { /* Analytics must never prevent authentication. */ }
}
export function trackAuthPage(page) {
  try {
    if (!['/signup', '/login'].includes(page) || lastPage === page || !initialize()) return;
    lastPage = page;
    window.gtag('event', 'page_view', { send_to: measurementId,
      page_location: window.location.origin + page, page_title: page === '/signup' ? 'Create your account' : 'Sign in',
      page_referrer: safeReferrer() });
  } catch (_) { /* Optional measurement. */ }
}
