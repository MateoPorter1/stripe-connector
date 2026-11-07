const express = require('express');
const Stripe = require('stripe');
const User = require('../models/User');
const Attempt = require('../models/FallbackAttempt');
const auth = require('../middleware/auth');
const { eligibility, alternateCards, savedCards, invoiceExpand, idOf } = require('../services/cardFallback');
const router = express.Router();
router.use(auth);
async function userClient(userId) {
  const user = await User.findById(userId).select('+stripeApiKey');
  if (!user?.stripeApiKey) throw new Error('Connect Stripe in My Profile first.');
  return { user, stripe: new Stripe(user.stripeApiKey) };
}
router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const attempts = await Attempt.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50)
      .select('invoiceId brand last4 amount currency status code createdAt updatedAt');
    res.set('Cache-Control', 'no-store').json({ success: true, settings: user.fallbackRecovery || { enabled: false }, attempts });
  } catch { res.status(500).json({ error: 'Could not read fallback status.' }); }
});
router.get('/preview', async (req, res) => {
  try {
    const { stripe } = await userClient(req.user._id);
    const account = await stripe.accounts.retrieve();
    const page = await stripe.invoices.list({ status: 'open', limit: 5 }, { timeout: 15000, maxNetworkRetries: 0 });
    const invoices = [];
    for (const item of page.data) {
      const invoice = await stripe.invoices.retrieve(item.id, { expand: invoiceExpand }, { timeout: 15000, maxNetworkRetries: 0 });
      const reason = eligibility(invoice);
      const methods = reason ? [] : alternateCards(invoice, await savedCards(stripe, idOf(invoice.customer)));
      invoices.push({ id: invoice.id, number: invoice.number, amount: invoice.amount_remaining, currency: invoice.currency,
        reason: reason || (methods.length ? null : 'no_alternate_cards'), alternateCards: methods.map(method => ({ brand: method.card.brand, last4: method.card.last4 })) });
    }
    res.json({ success: true, account: { id: account.id, name: account.business_profile?.name || account.settings?.dashboard?.display_name || account.id }, invoices,
      sample: true, hasMore: page.has_more });
  } catch { res.status(502).json({ error: 'Could not preview eligible invoices. Check the connected Stripe key and try again.' }); }
});
router.put('/', async (req, res) => {
  try {
    if (typeof req.body.enabled !== 'boolean') return res.status(400).json({ error: 'Choose enable or pause.' });
    if (!req.body.enabled) {
      await User.updateOne({ _id: req.user._id }, { $set: { 'fallbackRecovery.enabled': false } });
      return res.json({ success: true, enabled: false });
    }
    if (req.body.authorizeSavedCards !== true) return res.status(400).json({ error: 'Authorize automatic collection on eligible saved cards before enabling.' });
    const { stripe } = await userClient(req.user._id);
    const account = await stripe.accounts.retrieve();
    if (req.body.accountId !== account.id) return res.status(400).json({ error: 'Preview and confirm the connected account before enabling.' });
    await User.updateOne({ _id: req.user._id }, { $set: { 'fallbackRecovery.enabled': true, 'fallbackRecovery.accountId': account.id,
      'fallbackRecovery.authorizedAt': new Date(), 'fallbackRecovery.cursor': null, 'fallbackRecovery.lastError': '' } });
    res.json({ success: true, enabled: true });
  } catch { res.status(502).json({ error: 'Could not enable fallback. Check the connected Stripe key and try again.' }); }
});
module.exports = router;
