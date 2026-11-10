function loadAnalytics() {
  jest.resetModules();
  process.env.REACT_APP_GA4_MEASUREMENT_ID = 'G-C44RTQ0FSM';
  delete window.gtag; delete window.dataLayer;
  return require('./analytics');
}
afterEach(() => { document.head.innerHTML = ''; window.history.replaceState({}, '', '/'); });
test('auth measurement removes query strings and ignores unknown events and private pages', () => {
  window.history.replaceState({}, '', '/signup?email=private@example.com&token=secret');
  const { trackAuthEvent, trackAuthPage } = loadAnalytics();
  trackAuthPage('/signup'); trackAuthPage('/signup');
  trackAuthEvent('sign_up', '/signup');
  trackAuthEvent('sign_up', '/dashboard/customer_123');
  trackAuthEvent('customer_email', '/signup');
  const commands = window.dataLayer.map(args => [...args]);
  expect(commands.filter(args => args[0] === 'event').map(args => args[1])).toEqual(['page_view', 'sign_up']);
  expect(JSON.stringify(commands)).not.toMatch(/private@example|secret|customer_123/);
  expect(document.querySelectorAll('script[src*="googletagmanager.com"]').length).toBe(1);
});
test('an analytics failure cannot interrupt account creation', () => {
  const { trackAuthEvent } = loadAnalytics();
  window.gtag = () => { throw new Error('blocked'); };
  expect(() => trackAuthEvent('sign_up', '/signup')).not.toThrow();
});
test('missing tracking configuration leaves Analytics disabled', () => {
  jest.resetModules(); delete process.env.REACT_APP_GA4_MEASUREMENT_ID;
  delete window.gtag; delete window.dataLayer;
  const { trackAuthEvent } = require('./analytics');
  trackAuthEvent('sign_up', '/signup');
  expect(window.dataLayer).toBeUndefined();
});
