const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Recovery = require('../models/Recovery');
const { getFailedPaymentsPage } = require('../services/failedPayments');

// Helper function para obtener el cliente Stripe del usuario
const getUserStripeClient = async (userId) => {
  const user = await User.findById(userId).select('+stripeApiKey');

  if (!user) {
    throw Object.assign(new Error('Account not found. Please sign in again.'), { statusCode: 400 });
  }

  if (!user.stripeApiKey) {
    throw Object.assign(new Error('Connect Stripe in My Profile before loading payments.'), { statusCode: 400 });
  }

  return new Stripe(user.stripeApiKey);
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
router.post('/retry-payment', auth, async (req, res) => {
  try {
    // Obtener cliente Stripe del usuario
    const stripe = await getUserStripeClient(req.user._id);

    const { paymentIntentId, customerId } = req.body;

    if (!paymentIntentId || !customerId) {
      return res.status(400).json({
        error: 'ID de pago y cliente requeridos'
      });
    }

    // Obtener el payment intent original para conocer el monto
    const originalPaymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Obtener métodos de pago del cliente
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card'
    });

    if (paymentMethods.data.length === 0) {
      return res.json({
        success: false,
        message: 'No se encontraron métodos de pago para este cliente',
        attempts: []
      });
    }

    const attempts = [];

    console.log(`🔄 Intentando cobrar ${paymentMethods.data.length} métodos de pago...`);

    // Intentar con cada método de pago
    for (const method of paymentMethods.data) {
      try {
        console.log(`  💳 Intentando con ${method.card?.brand} •••• ${method.card?.last4}...`);

        // Crear un NUEVO payment intent para cada tarjeta
        const newPaymentIntent = await stripe.paymentIntents.create({
          amount: originalPaymentIntent.amount,
          currency: originalPaymentIntent.currency,
          customer: customerId,
          payment_method: method.id,
          confirm: true,
          description: `Retry of ${paymentIntentId}`,
          metadata: {
            original_payment_intent: paymentIntentId
          },
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: 'never'
          }
        });

        const attempt = {
          paymentMethodId: method.id,
          brand: method.card?.brand,
          last4: method.card?.last4,
          result: {
            success: newPaymentIntent.status === 'succeeded',
            status: newPaymentIntent.status,
            error: newPaymentIntent.status !== 'succeeded' ? newPaymentIntent.last_payment_error?.message : null
          }
        };

        attempts.push(attempt);

        // Si tuvo éxito, guardar recuperación y devolver
        if (newPaymentIntent.status === 'succeeded') {
          console.log(`  ✅ Pago exitoso con ${method.card?.brand} •••• ${method.card?.last4}`);

          // Obtener información del cliente para guardar en recovery
          try {
            const customer = await stripe.customers.retrieve(customerId);

            // Guardar recuperación en la base de datos
            const recovery = new Recovery({
              userId: req.user._id,
              paymentIntentId: newPaymentIntent.id,
              customerId: customerId,
              customerEmail: customer.email || '',
              amount: newPaymentIntent.amount,
              currency: newPaymentIntent.currency,
              paymentMethodUsed: method.id,
              paymentMethodDetails: {
                brand: method.card?.brand,
                last4: method.card?.last4
              },
              recoveredAt: new Date()
            });

            await recovery.save();
          } catch (saveError) {
            console.error('Error guardando recuperación:', saveError);
            // No fallar el request si falla guardar, el pago ya se procesó
          }

          return res.json({
            success: true,
            message: `Pago exitoso con ${method.card?.brand} terminada en ${method.card?.last4}`,
            attempts,
            successfulMethod: method,
            newPaymentIntentId: newPaymentIntent.id
          });
        } else {
          console.log(`  ❌ Falló con ${method.card?.brand} •••• ${method.card?.last4}: ${newPaymentIntent.last_payment_error?.message}`);
        }
      } catch (error) {
        console.log(`  ❌ Error con ${method.card?.brand} •••• ${method.card?.last4}: ${error.message}`);

        attempts.push({
          paymentMethodId: method.id,
          brand: method.card?.brand,
          last4: method.card?.last4,
          result: {
            success: false,
            status: 'failed',
            error: error.message
          }
        });
      }
    }

    // Si ningún método funcionó
    console.log(`❌ Todos los ${paymentMethods.data.length} métodos fallaron`);

    res.json({
      success: false,
      message: `Todos los ${paymentMethods.data.length} métodos de pago fallaron`,
      attempts
    });
  } catch (error) {
    console.error('Error reintentando pago:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
