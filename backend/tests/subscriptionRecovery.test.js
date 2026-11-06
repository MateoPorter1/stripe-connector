const { test } = require('node:test');
const assert = require('node:assert/strict');
const { invoiceRow, getSubscriptionRecoveryPage } = require('../services/subscriptionRecovery');
const invoice = changes => ({ id: 'in_demo', number: 'DEMO-01', subscription: 'sub_demo', customer: 'cus_demo', customer_email: 'demo@example.invalid', attempted: true, attempt_count: 2, status: 'open', amount_remaining: 1500, currency: 'usd', auto_advance: true, collection_method: 'charge_automatically', next_payment_attempt: 1800000000, created: 1793952000, livemode: true, ...changes });
test('shows an existing scheduled retry without issuing a charge', () => { const row = invoiceRow(invoice()); assert.equal(row.state, 'scheduled'); assert.equal(row.nextAttempt, 1800000000); });
test('does not label a blocked or paused invoice scheduled', () => {
  assert.equal(invoiceRow(invoice({ payment_intent: { status: 'requires_action' } })).state, 'customer_action');
  assert.equal(invoiceRow(invoice({ payment_intent: { last_payment_error: { decline_code: 'stolen_card' } } })).state, 'customer_action');
  assert.equal(invoiceRow(invoice({ auto_advance: false })).state, 'paused');
  assert.equal(invoiceRow(invoice({ next_payment_attempt: null })).state, 'no_schedule');
  assert.equal(invoiceRow(invoice({ payment_intent: { status: 'processing' } })).state, 'processing');
});
test('includes only subscription invoices and genuine multi-attempt paid history', () => {
  assert.equal(invoiceRow(invoice({ subscription: null })), null);
  assert.equal(invoiceRow(invoice({ attempted: false })), null);
  assert.equal(invoiceRow(invoice({ status: 'paid', amount_paid: 1500, attempt_count: 1 })), null);
  assert.equal(invoiceRow(invoice({ status: 'paid', amount_paid: 1500, paid_out_of_band: true })), null);
  assert.equal(invoiceRow(invoice({ status: 'paid', amount_paid: 1500 })).state, 'paid_after_retries');
  assert.equal(invoiceRow(invoice({ subscription: null, parent: { subscription_details: { subscription: 'sub_new' } } })).subscription, 'sub_new');
});
test('open invoices have no age cutoff and require only one read request per page', async () => {
  let calls = 0;
  const stripe = { invoices: { list: async params => { calls++; assert.equal(params.created, undefined); assert.equal(params.status, 'open'); return { data: [invoice()], has_more: true }; } } };
  const result = await getSubscriptionRecoveryPage(stripe);
  assert.equal(calls, 1); assert.equal(result.nextCursor, 'in_demo'); assert.equal(result.invoices.length, 1);
});
test('validates views, bounds history, and stops repeated cursors', async () => {
  const stripe = { invoices: { list: async params => { assert.ok(params.created.gte); return { data: [], has_more: false }; } } };
  await getSubscriptionRecoveryPage(stripe, { view: 'paid' });
  await assert.rejects(getSubscriptionRecoveryPage(stripe, { view: 'wrong' }));
  await assert.rejects(getSubscriptionRecoveryPage(stripe, { cursor: 'pi_wrong' }));
  await assert.rejects(getSubscriptionRecoveryPage({ invoices: { list: async () => ({ data: [invoice()], has_more: true }) } }, { cursor: 'in_demo' }), /advance/);
});
