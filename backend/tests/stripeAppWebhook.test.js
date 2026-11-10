const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Stripe = require('stripe');
const { createStripeAppRoutes } = require('../routes/stripeApp');
test('app webhook requires original signed bytes and the correct environment endpoint', async () => {
  const events = [], secret = 'whsec_marketplace_fixture';
  const env = { STRIPE_APP_ENABLED: 'true', STRIPE_APP_WEBHOOK_SECRET_TEST: secret };
  const routes = createStripeAppRoutes({ env, connection: { receive: async (event, mode) => events.push({ event, mode }) } });
  const app = express(); app.post('/webhook/:mode', express.raw({ type: 'application/json' }), routes.webhook);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const payload = JSON.stringify({ id: 'evt_app_fixture', type: 'account.application.deauthorized', account: 'acct_fixture', livemode: false, data: { object: { id: 'ca_app' } } });
    const headers = { 'Content-Type': 'application/json', 'Stripe-Signature': Stripe.webhooks.generateTestHeaderString({ payload, secret }) };
    assert.equal((await fetch(base + '/webhook/test', { method: 'POST', headers, body: payload + ' ' })).status, 400);
    assert.equal((await fetch(base + '/webhook/test', { method: 'POST', headers: { ...headers, 'Stripe-Signature': 'forged' }, body: payload })).status, 400);
    assert.equal(events.length, 0);
    assert.equal((await fetch(base + '/webhook/live', { method: 'POST', headers, body: payload })).status, 503);
    assert.equal((await fetch(base + '/webhook/test', { method: 'POST', headers, body: payload })).status, 200);
    assert.equal(events.length, 1); assert.equal(events[0].mode, 'test');
  } finally { await new Promise(resolve => server.close(resolve)); }
});
