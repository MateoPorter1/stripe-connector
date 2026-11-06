export const queueKey = customer => `${customer.customer}:${customer.currency}`;

export function mergePaymentPages(previous, incoming) {
  const groups = new Map(previous.map(customer => [queueKey(customer), customer]));
  for (const customer of incoming) {
    const key = queueKey(customer);
    const existing = groups.get(key);
    const transactions = [...new Map([
      ...(existing?.transactions || []), ...customer.transactions
    ].map(payment => [payment.id, payment])).values()];
    groups.set(key, {
      ...customer,
      paymentMethodsCount: existing?.paymentMethodsCount ?? customer.paymentMethodsCount ?? null,
      transactions,
      totalAmount: transactions.reduce((sum, payment) => sum + payment.amount, 0),
      failedCount: transactions.length,
      latestDate: Math.max(...transactions.map(payment => payment.created))
    });
  }
  return [...groups.values()].sort((a, b) => b.latestDate - a.latestDate);
}
