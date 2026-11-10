const express = require('express');
const Stripe = require('stripe');
const router = express.Router();
const User = require('../models/User');
const Connection = require('../models/StripeConnection');
const Batch = require('../models/RetryBatch');
const auth = require('../middleware/auth');
const { seal } = require('../services/credentialVault');
const { service } = require('../services/stripeAppConnection');
router.use(auth);
function failure(res, e) { res.status(e.statusCode || 503).json({ success: false, error: e.statusCode ? e.message : 'Could not update workspace settings. Please try again.' }); }
router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -stripeApiKey');
    if (!user) return res.status(404).json({ error: 'Account not found.' });
    res.set('Cache-Control', 'no-store').json({ success: true, user: { id: user._id, name: user.name, email: user.email, role: user.role, plan: user.plan, planExpiry: user.planExpiry, hasConfiguredStripe: user.hasConfiguredStripe, createdAt: user.createdAt } });
  } catch (e) { failure(res, e); }
});
router.get('/stripe-status', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('hasConfiguredStripe');
    if (!user) return res.status(404).json({ error: 'Account not found.' });
    const connection = await Connection.findOne({ userId: req.user._id });
    const active = connection?.status === 'active';
    res.set('Cache-Control', 'no-store').json({ success: true, hasConfiguredStripe: active || user.hasConfiguredStripe,
      connection: connection ? { type: 'oauth', status: connection.status, accountId: connection.accountId, mode: connection.mode, connectedAt: connection.connectedAt } : { type: 'legacy', status: user.hasConfiguredStripe ? 'active' : 'disconnected' } });
  } catch (e) { failure(res, e); }
});
router.put('/stripe-key', async (req, res) => {
  try {
    const key = typeof req.body.stripeApiKey === 'string' ? req.body.stripeApiKey.trim() : '';
    if (!/^rk_(test|live)_[A-Za-z0-9]{10,500}$/.test(key)) return res.status(400).json({ error: 'Use a restricted Stripe key (rk_test_ or rk_live_), not your full secret key.' });
    if (await Connection.exists({ userId: req.user._id })) return res.status(409).json({ error: 'Reconnect using the Stripe app. This workspace already uses a Stripe app connection.' });
    if (await Batch.exists({ userId: req.user._id, status: { $in: ['running', 'stopping'] } })) return res.status(409).json({ error: 'Stop the current recovery run before changing connections.' });
    const encrypted = seal(key, `legacy-stripe:${req.user._id}`);
    try { await new Stripe(key, { timeout: 10000, maxNetworkRetries: 0 }).accounts.retrieve(); }
    catch { return res.status(400).json({ error: 'Stripe could not verify this restricted key. Check its account and permissions.' }); }
    await User.updateOne({ _id: req.user._id }, { $set: { stripeApiKey: encrypted, hasConfiguredStripe: true, 'fallbackRecovery.enabled': false } });
    res.json({ success: true, message: 'Restricted key verified and saved securely.', hasConfiguredStripe: true });
  } catch (e) { failure(res, e); }
});
router.delete('/stripe-key', async (req, res) => {
  try { res.json(await service().disconnect(req.user._id)); } catch (e) { failure(res, e); }
});
module.exports = router;
