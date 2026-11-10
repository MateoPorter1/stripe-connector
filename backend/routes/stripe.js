const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const auth = require('../middleware/auth');
const User = require('../models/User');
const { getSubscriptionRecoveryPage } = require('../services/subscriptionRecovery');
const { getFailedPaymentsPage } = require('../services/failedPayments');
const { connectedStripe } = require('../services/stripeAppConnection');

// Helper function para obtener el cliente Stripe del usuario
const getUserStripeClient = async (userId) => {
  return (await connectedStripe(userId)).stripe;
};

// @route   GET /api/stripe/failed-transactions
// @desc    Obtener transacciones fallidas usando la API key del usuario
// @access  Private
router.get('/failed-transactions', auth, async (req, res) => {
  try {
    const stripe = await getUserStripeClient(req.user._id);
    res.set('Cache-Control', 'no-store');
    res.json(await getFailedPaymentsPage(stripe, req.query));
  } catch (error) {
    console.error('Failed payment scan:', error.type || error.name);
    res.status(error.statusCode === 400 ? 400 : 502).json({
      success: false,
      error: error.statusCode === 400 ? error.message : 'Could not load this batch from Stripe. Please try again.'
    });
  }
});

// @route   GET /api/stripe/customer/:customerId
// @desc    Obtener información del cliente usando la API key del usuario
// @access  Private
router.get('/customer/:customerId', auth, async (req, res) => {
  try {
    // Obtener cliente Stripe del usuario
    const stripe = await getUserStripeClient(req.user._id);

    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({ error: 'ID de cliente requerido' });
    }

    const customer = await stripe.customers.retrieve(customerId);

    res.json({
      success: true,
      customer
    });
  } catch (error) {
    console.error('Error obteniendo cliente:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   GET /api/stripe/payment-methods/:customerId
// @desc    Obtener métodos de pago del cliente usando la API key del usuario
// @access  Private
router.get('/payment-methods/:customerId', auth, async (req, res) => {
  try {
    // Obtener cliente Stripe del usuario
    const stripe = await getUserStripeClient(req.user._id);

    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({ error: 'ID de cliente requerido' });
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card'
    });

    res.json({
      success: true,
      count: paymentMethods.data.length,
      methods: paymentMethods.data
    });
  } catch (error) {
    console.error('Error obteniendo métodos de pago:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// @route   POST /api/stripe/retry-payment
// @desc    Reintentar pago usando la API key del usuario
// @access  Private
// The former endpoint created unrelated new charges. Collection now stays with Stripe Billing.
router.post('/retry-payment', auth, (req, res) => {
  res.status(410).json({ success: false, error: 'Subscription collection is handled automatically by Stripe Billing. Open the recovery monitor to see its status.' });
});

router.get('/subscription-recovery', auth, async (req, res) => {
  try {
    const stripe = await getUserStripeClient(req.user._id);
    res.set('Cache-Control', 'no-store');
    res.json(await getSubscriptionRecoveryPage(stripe, req.query));
  } catch (error) {
    console.error('Invoice monitor:', error.type || error.name);
    res.status(error.statusCode === 400 ? 400 : 502).json({ success: false,
      error: error.statusCode === 400 ? error.message : 'Could not refresh invoice status from Stripe. Please try again.' });
  }
});

module.exports = router;
