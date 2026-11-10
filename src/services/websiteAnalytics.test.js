import fs from 'fs';
import path from 'path';
const source = fs.readFileSync(path.join(process.cwd(), 'website/assets/analytics.js'), 'utf8');
beforeEach(() => {
  window.gtag = jest.fn();
  document.body.innerHTML = `<header><a href="https://app.reboundmrr.com/signup?secret=never-send"><span id="cta">Start free trial</span></a></header><a id="guide" href="/resources/involuntary-churn">Guide</a><form id="churn-calculator"><input type="number" min="0" required value="1000"><input type="number" min="0" max="100" required value="5"></form><button data-play-example>Demo</button>`;
  // Bind document listeners to a fresh element so test runs do not accumulate listeners.
  const scope = document.body;
  new Function('document', source)({
    addEventListener: (...args) => scope.addEventListener(...args),
    querySelector: selector => scope.querySelector(selector),
    querySelectorAll: selector => scope.querySelectorAll(selector)
  });
});
afterEach(() => { document.body.innerHTML = ''; delete window.gtag; });
test('nested trial buttons record intent without claiming a signup or sharing query strings', () => {
  document.querySelector('#cta').click();
  expect(window.gtag).toHaveBeenCalledTimes(1);
  expect(window.gtag).toHaveBeenCalledWith('event', 'signup_click', expect.objectContaining({ cta_location: 'header', destination_path: '/signup' }));
  expect(JSON.stringify(window.gtag.mock.calls)).not.toContain('secret');
});
test('calculator ignores defaults, invalid results and repeated unchanged results', () => {
  expect(window.gtag).not.toHaveBeenCalled();
  const input = document.querySelector('input');
  input.value = '-1';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.value = '7654321';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  expect(window.gtag.mock.calls.map(call => call[1])).toEqual(['calculator_start', 'calculator_result']);
  expect(JSON.stringify(window.gtag.mock.calls)).not.toContain('7654321');
});
test('demo replay is separate from first interaction', () => {
  document.querySelector('[data-play-example]').click();
  document.querySelector('[data-play-example]').click();
  expect(window.gtag.mock.calls.map(call => call[1])).toEqual(['recovery_demo_start', 'recovery_demo_replay']);
});
