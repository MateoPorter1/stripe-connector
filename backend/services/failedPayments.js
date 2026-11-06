function invalid(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function dateTimestamp(value, endOfDay = false) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw invalid('Choose a valid date range.');
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw invalid('Choose a valid date range.');
  }
  return Math.floor(date.getTime() / 1000) + (endOfDay ? 86399 : 0);
}

function buildParams(query, now = Date.now()) {
  const limit = query.limit === undefined ? 100 : Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw invalid('Page size must be between 1 and 100.');
  const params = { limit, expand: ['data.customer'] };
  if (query.cursor !== undefined) {
    if (typeof query.cursor !== 'string' || !/^pi_[a-zA-Z0-9]+$/.test(query.cursor)) throw invalid('Invalid payment cursor. Reload the queue.');
    params.starting_after = query.cursor;
  }
  const created = {};
  if (query.startDate !== undefined) created.gte = dateTimestamp(query.startDate);
  if (query.endDate !== undefined) created.lte = dateTimestamp(query.endDate, true);
  if (!query.startDate && !query.endDate) created.gte = Math.floor(now / 1000) - 7 * 86400;
  if (created.gte !== undefined && created.lte !== undefined && created.gte > created.lte) throw invalid('The start date must come before the end date.');
  params.created = created;
  return params;
}

async function getFailedPaymentsPage(stripe, query) {
  // A single Stripe page returns immediately; the browser continues the scan.
  // Expanded customers replace the previous separate lookup for every customer.
  const page = await stripe.paymentIntents.list(buildParams(query), { timeout: 20000, maxNetworkRetries: 0 });
  const groups = new Map();
  let failedCount = 0;
  for (const payment of page.data) {
    if (!['requires_payment_method', 'failed', 'canceled'].includes(payment.status)) continue;
    const details = typeof payment.customer === 'object' ? payment.customer : null;
    const customerId = details?.id || payment.customer;
    if (!customerId || typeof customerId !== 'string') continue;
    const key = `${customerId}:${payment.currency}`;
    if (!groups.has(key)) {
      groups.set(key, {
        customer: customerId,
        currency: payment.currency,
        email: details?.email || payment.receipt_email || 'No email',
        country: details?.address?.country || 'Unknown',
        // Unknown is different from no saved cards. Check only when requested.
        paymentMethodsCount: null,
        transactions: [], totalAmount: 0, failedCount: 0, latestDate: payment.created
      });
    }
    const group = groups.get(key);
    group.transactions.push({ id: payment.id, amount: payment.amount, currency: payment.currency, created: payment.created, status: payment.status });
    group.totalAmount += payment.amount;
    group.failedCount += 1;
    group.latestDate = Math.max(group.latestDate, payment.created);
    failedCount += 1;
  }
  const nextCursor = page.has_more ? page.data[page.data.length - 1]?.id : null;
  if (page.has_more && (!nextCursor || nextCursor === query.cursor)) {
    throw new Error('Stripe could not advance the payment scan. Please try again.');
  }
  return {
    success: true,
    customers: [...groups.values()].sort((a, b) => b.latestDate - a.latestDate),
    totalCustomers: groups.size,
    totalFailedTransactions: failedCount,
    totalFetched: page.data.length,
    hasMore: Boolean(page.has_more), nextCursor: nextCursor || null
  };
}

module.exports = { getFailedPaymentsPage, buildParams };
