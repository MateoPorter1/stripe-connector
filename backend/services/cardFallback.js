const crypto = require('crypto');
const idOf = value => typeof value === 'string' ? value : value?.id;
const invoiceExpand = ['payment_intent.payment_method', 'subscription'];

function eligibility(invoice, now = Date.now()) {
  const subscription = invoice.subscription || invoice.parent?.subscription_details?.subscription;
  if (!subscription) return 'not_subscription';
  if (invoice.status !== 'open' || invoice.amount_remaining <= 0) return 'not_unpaid';
  if (!invoice.attempted || invoice.attempt_count < 1) return 'not_failed';
  if (invoice.collection_method !== 'charge_automatically' || !invoice.auto_advance) return 'collection_paused';
  if (typeof subscription !== 'object' || !['active', 'past_due', 'unpaid'].includes(subscription.status)) return 'subscription_not_active';
  const payment = invoice.payment_intent;
  if (!payment || typeof payment !== 'object') return 'payment_state_unknown';
  if (payment.status === 'processing' || payment.status === 'succeeded' || payment.status === 'requires_capture') return 'payment_pending';
  if (payment.status === 'requires_action') return 'customer_action';
  if (!['requires_payment_method', 'requires_confirmation'].includes(payment.status)) return 'payment_state_unknown';
  if (invoice.next_payment_attempt && Math.abs(invoice.next_payment_attempt * 1000 - now) < 10 * 60000) return 'stripe_retry_imminent';
  if (!invoice.customer) return 'no_customer';
  return null;
}

async function savedCards(stripe, customer, now = Date.now()) {
  const cards = []; let cursor;
  do {
    const page = await stripe.paymentMethods.list({ customer, type: 'card', limit: 100, ...(cursor ? { starting_after: cursor } : {}) }, { timeout: 15000, maxNetworkRetries: 0 });
    cards.push(...page.data);
    const next = page.has_more ? page.data[page.data.length - 1]?.id : null;
    if (page.has_more && (!next || next === cursor)) throw new Error('Card pagination did not advance.');
    cursor = next;
  } while (cursor);
  const today = new Date(now); const year = today.getUTCFullYear(), month = today.getUTCMonth() + 1;
  return cards.filter(method => idOf(method.customer) === customer && method.type === 'card' && method.card &&
    (method.card.exp_year > year || (method.card.exp_year === year && method.card.exp_month >= month)));
}

function alternateCards(invoice, cards) {
  const failed = invoice.payment_intent?.payment_method || invoice.payment_intent?.last_payment_error?.payment_method;
  const failedId = idOf(failed);
  const failedFingerprint = (typeof failed === 'object' ? failed?.card?.fingerprint : null) || cards.find(card => card.id === failedId)?.card?.fingerprint;
  const seen = new Set(failedFingerprint ? [failedFingerprint] : []);
  return cards.filter(method => {
    const fingerprint = method.card.fingerprint;
    if (method.id === failedId || (fingerprint && seen.has(fingerprint))) return false;
    if (fingerprint) seen.add(fingerprint);
    return true;
  });
}

// Dependencies separate real Stripe/DB writes from deterministic, non-charging tests.
async function recoverInvoice({ stripe, invoiceId, accountId, ledger, allowed, recordPaid, now = Date.now }) {
  let invoice = await stripe.invoices.retrieve(invoiceId, { expand: invoiceExpand }, { timeout: 15000, maxNetworkRetries: 0 });
  let reason = eligibility(invoice, now());
  if (reason) return { state: 'skipped', reason, attempts: 0 };
  const customer = idOf(invoice.customer);
  const cards = await savedCards(stripe, customer, now());
  const failed = invoice.payment_intent?.payment_method || invoice.payment_intent?.last_payment_error?.payment_method;
  const priorMethod = cards.find(card => card.id === idOf(failed));
  if (priorMethod && ledger.rememberFailed) await ledger.rememberFailed(accountId, invoiceId, priorMethod, invoice);
  const methods = alternateCards(invoice, cards);
  if (await ledger.blocked(accountId, invoiceId)) return { state: 'blocked', reason: 'previous_attempt_needs_review', attempts: 0 };
  let attempts = 0;
  for (const method of methods) {
    if (!await allowed()) return { state: 'paused', attempts };
    if (await ledger.seen(accountId, invoiceId, method)) continue;
    // Recheck debt and in-flight state immediately before each individual charge.
    invoice = await stripe.invoices.retrieve(invoiceId, { expand: invoiceExpand }, { timeout: 15000, maxNetworkRetries: 0 });
    reason = eligibility(invoice, now());
    if (reason) return { state: 'stopped', reason, attempts };
    if (idOf(invoice.customer) !== customer) return { state: 'stopped', reason: 'customer_changed', attempts };
    if (!alternateCards(invoice, [method]).length) continue;
    if (!await allowed()) return { state: 'paused', attempts };
    const key = { accountId, invoiceId, methodId: method.id };
    if (!await ledger.claim({ ...key, fingerprint: method.card.fingerprint, brand: method.card.brand, last4: method.card.last4, amount: invoice.amount_remaining, currency: invoice.currency, status: 'pending' })) return { state: 'blocked', reason: 'concurrent_attempt', attempts };
    attempts++;
    const idempotencyKey = 'fallback-v1-' + crypto.createHash('sha256').update(`${accountId}:${invoiceId}:${method.id}`).digest('hex');
    let paid;
    try {
      paid = await stripe.invoices.pay(invoiceId, { payment_method: method.id, off_session: true, expand: ['payment_intent'] }, { idempotencyKey, timeout: 20000, maxNetworkRetries: 0 });
    } catch (error) {
      // Only an explicit card decline permits moving to a different card.
      let payment = error.payment_intent || error.raw?.payment_intent;
      if (error.type === 'StripeCardError' && (!payment || typeof payment !== 'object')) {
        const fresh = await stripe.invoices.retrieve(invoiceId, { expand: ['payment_intent'] }, { timeout: 15000, maxNetworkRetries: 0 });
        payment = fresh.payment_intent;
      }
      const code = error.decline_code || error.code || error.raw?.decline_code || 'unknown';
      let status = 'uncertain';
      if (payment?.status === 'processing' || payment?.status === 'succeeded') status = 'processing';
      else if (payment?.status === 'requires_action' || code === 'authentication_required') status = 'action_required';
      else if (error.type === 'StripeCardError' && payment?.status === 'requires_payment_method' && !['highest_risk_level', 'fraudulent', 'merchant_blacklist'].includes(code)) status = 'declined';
      await ledger.finish(key, { status, code, paymentIntentId: idOf(payment) });
      if (status !== 'declined') return { state: status, attempts };
      continue;
    }
    const payment = paid.payment_intent;
    if (paid.status === 'paid' && paid.amount_remaining === 0) {
      await ledger.finish(key, { status: 'paid', paymentIntentId: idOf(payment) });
      await recordPaid({ invoice: paid, method, amount: invoice.amount_remaining });
      return { state: 'paid', attempts };
    }
    const status = payment?.status === 'requires_action' ? 'action_required' : payment?.status === 'processing' ? 'processing' : 'uncertain';
    await ledger.finish(key, { status, paymentIntentId: idOf(payment) });
    return { state: status, attempts };
  }
  return { state: 'exhausted', reason: methods.length ? 'all_alternates_tried' : 'no_alternate_cards', attempts };
}
module.exports = { recoverInvoice, eligibility, alternateCards, savedCards, invoiceExpand, idOf };
