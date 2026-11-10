// Marketing events contain only public paths and fixed labels, never form values.
(() => {
  const track = (name, params = {}) => {
    try {
      if (typeof window.gtag === 'function') window.gtag('event', name, {
        ...params, page_location: location.origin + location.pathname,
        page_path: location.pathname, transport_type: 'beacon'
      });
    } catch (_) { /* Analytics must never interrupt the website. */ }
  };
  const placement = element => element.closest('header') ? 'header'
    : element.closest('footer') ? 'footer'
    : element.closest('[id]')?.id || 'page';
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    let url;
    try { url = new URL(link.href, location.origin); } catch (_) { return; }
    const params = { cta_location: placement(link), destination_path: url.pathname };
    if (url.hostname === 'app.reboundmrr.com') {
      if (url.pathname === '/signup') track('signup_click', params);
      if (url.pathname === '/login') track('login_click', params);
    } else if (url.origin === location.origin && /^\/(resources\/[^/]+|customers\/[^/]+)$/.test(url.pathname)) {
      track('select_content', { content_type: url.pathname.startsWith('/customers/') ? 'customer_story' : 'guide', item_id: url.pathname });
    }
  });
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    track('resource_filter', { topic: button.dataset.filter });
  }));
  const calculator = document.querySelector('#churn-calculator');
  if (calculator) {
    let started = false, lastResult = '';
    calculator.addEventListener('input', () => {
      if (!started) { started = true; track('calculator_start', { tool_name: 'churn_calculator' }); }
    });
    calculator.addEventListener('change', () => {
      const inputs = [...calculator.querySelectorAll('input')];
      if (!inputs.every(input => input.value.trim() !== '' && input.checkValidity())) return;
      const result = inputs.map(input => input.value).join('|');
      if (result === lastResult) return;
      lastResult = result;
      track('calculator_result', { tool_name: 'churn_calculator' });
    });
  }
  let demoStarted = false;
  document.querySelector('[data-play-example]')?.addEventListener('click', () => {
    track(demoStarted ? 'recovery_demo_replay' : 'recovery_demo_start');
    demoStarted = true;
  });
})();
