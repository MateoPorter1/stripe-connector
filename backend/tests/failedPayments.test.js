const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getFailedPaymentsPage, buildParams } = require('../services/failedPayments');

const payment = (id, options = {}) => ({ id, status: 'requires_payment_method', amount: 1200, currency: 'usd', created: 1793952000, customer: { id: 'cus_alpha', email: 'demo@example.invalid', address: { country: 'US' } }, ...options });

test('returns a single page with customer details using exactly one Stripe request', async () => {
  let calls = 0;
  const stripe = { paymentIntents: { list: async params => {
    calls++; assert.deepEqual(params.expand, ['data.customer']);
    return { data: [payment('pi_a'), payment('pi_b', { status: 'succeeded' })], has_more: true };
  } } };
  const result = await getFailedPaymentsPage(stripe, { startDate: '2026-11-01', endDate: '2026-11-06' });
  assert.equal(calls, 1);
  assert.equal(result.totalFetched, 2);
  assert.equal(result.nextCursor, 'pi_b'); // Cursor follows all payments, including successes.
  assert.equal(result.customers[0].email, 'demo@example.invalid');
  assert.equal(result.customers[0].paymentMethodsCount, null);
  assert.equal(result.customers[0].transactions[0].client_secret, undefined);
});

test('keeps currencies separate and handles deleted, unexpanded, or missing customers', async () => {
  const data = [payment('pi_a'), payment('pi_b', { currency: 'eur', amount: 700 }), payment('pi_c', { customer: null }), payment('pi_d', { customer: { id: 'cus_deleted', deleted: true } }), payment('pi_e', { customer: 'cus_string' })];
  const result = await getFailedPaymentsPage({ paymentIntents: { list: async () => ({ data, has_more: false }) } }, {});
  assert.equal(result.customers.length, 4);
  assert.deepEqual(result.customers.slice(0, 2).map(row => row.totalAmount), [1200, 700]);
  assert.equal(result.nextCursor, null);
});

test('an all-success page still advances to older payments', async () => {
  const result = await getFailedPaymentsPage({ paymentIntents: { list: async () => ({ data: [payment('pi_new', { status: 'succeeded' })], has_more: true }) } }, { cursor: 'pi_prior' });
  assert.deepEqual(result.customers, []);
  assert.equal(result.nextCursor, 'pi_new');
});

test('validates dates, page bounds, and cursors; includes the complete final day', () => {
  const params = buildParams({ startDate: '2026-11-01', endDate: '2026-11-06', cursor: 'pi_a', limit: '50' });
  assert.equal(params.created.lte, Date.parse('2026-11-06T23:59:59Z') / 1000);
  assert.equal(params.starting_after, 'pi_a');
  assert.equal(params.limit, 50);
  for (const query of [{ startDate: '2026-02-30' }, { startDate: '2026-11-06', endDate: '2026-11-01' }, { limit: 101 }, { cursor: 'bad' }]) {
    assert.throws(() => buildParams(query), error => error.statusCode === 400);
  }
});

test('stops an upstream cursor loop instead of scanning forever', async () => {
  await assert.rejects(getFailedPaymentsPage({ paymentIntents: { list: async () => ({ data: [payment('pi_same')], has_more: true }) } }, { cursor: 'pi_same' }), /could not advance/);
});
