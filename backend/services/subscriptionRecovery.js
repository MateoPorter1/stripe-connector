const HARD_DECLINES = new Set(['incorrect_number', 'lost_card', 'pickup_card', 'stolen_card', 'revocation_of_authorization', 'revocation_of_all_authorizations', 'authentication_required', 'highest_risk_level', 'transaction_not_allowed']);
function invoiceRow(invoice) {
  const subscription = invoice.subscription || invoice.parent?.subscription_details?.subscription;
  if (!subscription || !invoice.attempted || invoice.attempt_count < 1) return null;
  const payment = typeof invoice.payment_intent === 'object' ? invoice.payment_intent : null;
  const decline = payment?.last_payment_error?.decline_code || payment?.last_payment_error?.code;
  let state, explanation;
  if (invoice.status === 'paid') {
    if (invoice.attempt_count < 2 || invoice.amount_paid <= 0 || invoice.paid_out_of_band) return null;
    state = 'paid_after_retries'; explanation = 'Paid after more than one collection attempt.';
  } else if (invoice.status === 'uncollectible') {
    state = 'ended'; explanation = 'Stripe marked this invoice uncollectible. Automatic recovery has ended.';
  } else if (invoice.status !== 'open' || invoice.amount_remaining <= 0) {
    return null;
  } else if (payment?.status === 'processing') {
    state = 'processing'; explanation = 'A payment is already processing. Stripe is waiting for the result.';
  } else if (payment?.status === 'requires_action' || HARD_DECLINES.has(decline)) {
    state = 'customer_action'; explanation = 'The customer must authenticate or provide a usable payment method before Stripe can collect.';
  } else if (invoice.collection_method !== 'charge_automatically') {
    state = 'manual_collection'; explanation = 'This invoice is configured for customer payment, rather than automatic collection.';
  } else if (!invoice.auto_advance) {
    state = 'paused'; explanation = 'Automatic collection is paused for this invoice.';
  } else if (invoice.next_payment_attempt) {
    state = 'scheduled'; explanation = 'Stripe has scheduled the next automatic collection attempt.';
  } else {
    state = 'no_schedule'; explanation = 'Stripe reports no next attempt. The retry policy may be exhausted or require attention.';
  }
  return {
    id: invoice.id, number: invoice.number || invoice.id,
    customer: typeof invoice.customer === 'object' ? invoice.customer?.id : invoice.customer,
    email: invoice.customer_email || 'No email',
    subscription: typeof subscription === 'object' ? subscription.id : subscription,
    currency: invoice.currency,
    amount: invoice.status === 'paid' ? invoice.amount_paid : invoice.amount_remaining,
    attempts: invoice.attempt_count, state, explanation,
    nextAttempt: state === 'scheduled' ? invoice.next_payment_attempt : null,
    created: invoice.created,
    paidAt: invoice.status_transitions?.paid_at || null,
    stripeUrl: `https://dashboard.stripe.com/${invoice.livemode ? '' : 'test/'}invoices/${encodeURIComponent(invoice.id)}`
  };
}

async function getSubscriptionRecoveryPage(stripe, query = {}, now = Date.now()) {
  const view = query.view || 'open';
  if (!['open', 'paid', 'uncollectible'].includes(view)) throw Object.assign(new Error('Unknown invoice view.'), { statusCode: 400 });
  const params = { limit: 100, status: view, expand: ['data.payment_intent'] };
  if (query.cursor) {
    if (typeof query.cursor !== 'string' || !/^in_[a-zA-Z0-9]+$/.test(query.cursor)) throw Object.assign(new Error('Invalid invoice cursor.'), { statusCode: 400 });
    params.starting_after = query.cursor;
  }
  // Open debt has no age cutoff. History is explicitly limited to invoices created in 90 days.
  if (view !== 'open') params.created = { gte: Math.floor(now / 1000) - 90 * 86400 };
  const page = await stripe.invoices.list(params, { timeout: 20000, maxNetworkRetries: 0 });
  const nextCursor = page.has_more ? page.data[page.data.length - 1]?.id : null;
  if (page.has_more && (!nextCursor || nextCursor === query.cursor)) throw new Error('Invoice scan could not advance.');
  return { success: true, invoices: page.data.map(invoiceRow).filter(Boolean), totalFetched: page.data.length, nextCursor: nextCursor || null, hasMore: Boolean(page.has_more), view };
}
module.exports = { invoiceRow, getSubscriptionRecoveryPage };
