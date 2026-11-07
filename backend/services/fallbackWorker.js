const mongoose = require('mongoose');
const crypto = require('crypto');
const Stripe = require('stripe');
const User = require('../models/User');
const Attempt = require('../models/FallbackAttempt');
const Lease = require('../models/FallbackLease');
const Recovery = require('../models/Recovery');
const { recoverInvoice, idOf } = require('./cardFallback');
const { prepareFallbackStorage } = require('./fallbackStorage');
let running = false;
let storageReady = false;

async function runUser(user) {
  const stripe = new Stripe(user.stripeApiKey);
  const account = await stripe.accounts.retrieve();
  if (account.id !== user.fallbackRecovery.accountId) throw new Error('Stripe account changed. Pause and re-enable fallback.');
  const owner = crypto.randomUUID();
  let lease;
  try {
    lease = await Lease.findOneAndUpdate({ _id: account.id, $or: [{ until: { $lt: new Date() } }, { owner }] }, { $set: { owner, until: new Date(Date.now() + 120000) } }, { upsert: true, new: true });
  } catch (error) { if (error.code === 11000) return; throw error; }
  if (!lease) return;
  try {
    const allowed = async () => {
      const current = await User.exists({ _id: user._id, 'fallbackRecovery.enabled': true, 'fallbackRecovery.accountId': account.id });
      if (!current) return false;
      const renewed = await Lease.updateOne({ _id: account.id, owner, until: { $gt: new Date() } }, { $set: { until: new Date(Date.now() + 120000) } });
      return renewed.matchedCount === 1;
    };
    const ledger = {
      rememberFailed: async (accountId, invoiceId, method, invoice) => {
        try { await Attempt.create({ userId: user._id, accountId, invoiceId, methodId: method.id,
          fingerprint: method.card.fingerprint, brand: method.card.brand, last4: method.card.last4,
          amount: invoice.amount_remaining, currency: invoice.currency, status: 'skipped', code: 'already_failed_in_stripe' }); }
        catch (error) { if (error.code !== 11000) throw error; }
      },
      blocked: (accountId, invoiceId) => Attempt.exists({ accountId, invoiceId, status: { $in: ['pending', 'uncertain', 'processing', 'action_required', 'paid'] } }),
      seen: (accountId, invoiceId, method) => Attempt.exists({ accountId, invoiceId, $or: [{ methodId: method.id }, ...(method.card.fingerprint ? [{ fingerprint: method.card.fingerprint }] : [])] }),
      claim: async data => { try { await Attempt.create({ ...data, userId: user._id }); return true; } catch (error) { if (error.code === 11000) return false; throw error; } },
      finish: (key, values) => Attempt.updateOne(key, { $set: values })
    };
    const params = { limit: 5, status: 'open', ...(user.fallbackRecovery.cursor ? { starting_after: user.fallbackRecovery.cursor } : {}) };
    const page = await stripe.invoices.list(params, { timeout: 15000, maxNetworkRetries: 0 });
    const summary = { invoicesChecked: 0, attempts: 0, paid: 0, needsAttention: 0, noAlternates: 0 };
    for (const invoice of page.data) {
      if (!await allowed()) break;
      const result = await recoverInvoice({ stripe, invoiceId: invoice.id, accountId: account.id, ledger, allowed,
        recordPaid: async ({ invoice: paid, method, amount }) => {
          const paymentIntentId = idOf(paid.payment_intent);
          if (!paymentIntentId) throw new Error('Payment succeeded but its payment reference needs review.');
          const record = { userId: user._id, paymentIntentId, customerId: idOf(paid.customer), customerEmail: paid.customer_email || '',
            amount, currency: paid.currency, paymentMethodUsed: method.id,
            paymentMethodDetails: { brand: method.card.brand, last4: method.card.last4 }, recoveredAt: new Date(), originalFailedDate: new Date(paid.created * 1000) };
          await Recovery.updateOne({ userId: user._id, paymentIntentId }, { $setOnInsert: record }, { upsert: true });
        }
      });
      summary.invoicesChecked++; summary.attempts += result.attempts;
      if (result.state === 'paid') summary.paid++;
      if (['blocked', 'uncertain', 'action_required', 'processing'].includes(result.state)) summary.needsAttention++;
      if (result.reason === 'no_alternate_cards') summary.noAlternates++;
    }
    await User.updateOne({ _id: user._id, 'fallbackRecovery.enabled': true }, { $set: {
      'fallbackRecovery.cursor': page.has_more ? page.data[page.data.length - 1]?.id || null : null,
      'fallbackRecovery.lastRunAt': new Date(), 'fallbackRecovery.lastError': '', 'fallbackRecovery.lastSummary': summary
    } });
  } finally { await Lease.deleteOne({ _id: account.id, owner }); }
}

async function runFallbackTick() {
  if (running || mongoose.connection.readyState !== 1) return;
  running = true;
  try {
    // Unique indexes must exist before the first possible collection attempt.
    if (!storageReady) {
      await prepareFallbackStorage(Attempt, Lease, Recovery);
      storageReady = true;
    }
    const users = await User.find({ 'fallbackRecovery.enabled': true, 'fallbackRecovery.authorizedAt': { $ne: null }, hasConfiguredStripe: true })
      .select('+stripeApiKey').sort({ 'fallbackRecovery.lastRunAt': 1 }).limit(10);
    for (const user of users) {
      try { await runUser(user); }
      catch (error) {
        console.error('Fallback worker:', error.type || error.name);
        await User.updateOne({ _id: user._id }, { $set: { 'fallbackRecovery.lastRunAt': new Date(),
          'fallbackRecovery.lastError': 'Fallback paused this run because Stripe or the database could not confirm a safe next step. Review the attempt log.' } });
      }
    }
  } catch (error) {
    console.error('Fallback storage error:', error.name, error.code || 'no_code');
    await User.updateMany({ 'fallbackRecovery.enabled': true }, { $set: {
      'fallbackRecovery.lastError': 'The background worker could not initialize its safety records. No new card attempts will be submitted until storage is ready.'
    } });
  } finally { running = false; }
}
function startFallbackWorker() {
  setTimeout(() => runFallbackTick().catch(() => console.error('Fallback startup failed')), 5000).unref();
  setInterval(() => runFallbackTick().catch(() => console.error('Fallback tick failed')), 60000).unref();
}
module.exports = { runFallbackTick, startFallbackWorker };
