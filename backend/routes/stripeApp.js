const express = require('express');
const Stripe = require('stripe');
const auth = require('../middleware/auth');
const { service, oauthConfig } = require('../services/stripeAppConnection');
function createStripeAppRoutes({ connection = service(), env = process.env } = {}) {
  const router = express.Router();
  function error(res, e) { return res.status(e.statusCode || 503).json({ success: false, error: e.statusCode ? e.message : 'Stripe connection is temporarily unavailable. Please try again.' }); }
  router.get('/availability', (req, res) => {
    const modes = ['live', 'test', 'sandbox'].filter(mode => { try { if(mode === 'live' && env.STRIPE_APP_LIVE_INSTALL_ENABLED !== 'true')return false; oauthConfig(mode, env); return true; } catch { return false; } });
    res.set('Cache-Control', 'no-store').json({ success: true, available: modes.length > 0, modes });
  });
  router.post('/start', auth, async (req, res) => { try { res.set('Cache-Control', 'no-store').json(await connection.start(req.user._id, req.body.mode || 'live')); } catch (e) { error(res, e); } });
  router.post('/complete', auth, async (req, res) => { try { res.set('Cache-Control', 'no-store').json(await connection.complete(req.user._id, req.body)); } catch (e) { error(res, e); } });
  router.delete('/connection', auth, async (req, res) => { try { res.json(await connection.disconnect(req.user._id)); } catch (e) { error(res, e); } });
  async function webhook(req, res) {
    const mode = req.params.mode;
    if (!['live', 'test', 'sandbox'].includes(mode)) return res.sendStatus(404);
    const secret = env[`STRIPE_APP_WEBHOOK_SECRET_${mode.toUpperCase()}`];
    if (!secret || env.STRIPE_APP_ENABLED !== 'true') return res.sendStatus(503);
    let event;
    try { event = Stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], secret); }
    catch { return res.status(400).json({ error: 'Invalid Stripe signature.' }); }
    try { await connection.receive(event, mode); res.json({ received: true }); }
    catch (e) { res.status(e.statusCode === 400 ? 400 : 503).json({ error: 'Could not process app notification.' }); }
  }
  return { router, webhook };
}
module.exports = { createStripeAppRoutes };
