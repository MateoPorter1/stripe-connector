const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const auth = require('../middleware/auth');
const User = require('../models/User');

// Helper function para obtener el cliente Stripe del usuario
const getUserStripeClient = async (userId) => {
  const user = await User.findById(userId).select('+stripeApiKey');

  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  if (!user.stripeApiKey) {
    throw new Error('API key de Stripe no configurada. Por favor configura tu API key en tu perfil.');
  }

  return new Stripe(user.stripeApiKey);
};

// @route   GET /api/stripe/failed-transactions
// @desc    Obtener transacciones fallidas usando la API key del usuario
// @access  Private
router.get('/failed-transactions', auth, async (req, res) => {
  try {
    // Obtener cliente Stripe del usuario
    const stripe = await getUserStripeClient(req.user._id);

    const { limit = 100, startDate, endDate } = req.query;

    // Construir parámetros para la consulta
    const params = {
      limit: parseInt(limit)
    };

    // Agregar filtros de fecha
    if (!startDate && !endDate) {
      // Por defecto: últimos 7 días
      const sevenDaysAgo = Math.floor((Date.now() - (7 * 24 * 60 * 60 * 1000)) / 1000);
      params.created = { gte: sevenDaysAgo };
    } else {
      params.created = {};
      if (startDate) {
        const startTimestamp = Math.floor(new Date(startDate + 'T00:00:00Z').getTime() / 1000);
        params.created.gte = startTimestamp;
      }
      if (endDate) {
        const endTimestamp = Math.floor(new Date(endDate + 'T23:59:59Z').getTime() / 1000);
        params.created.lte = endTimestamp;
      }
    }

    // Obtener payment intents de Stripe
    const paymentIntents = await stripe.paymentIntents.list(params);

    // Filtrar solo transacciones fallidas
    const failedTransactions = paymentIntents.data.filter(transaction =>
      transaction.status === 'requires_payment_method' ||
      transaction.status === 'failed' ||
      transaction.status === 'canceled'
    );

    // Ordenar por fecha más reciente
    const sortedTransactions = failedTransactions.sort((a, b) => b.created - a.created);

    res.json({
      success: true,
      transactions: sortedTransactions,
      total: sortedTransactions.length
    });
  } catch (error) {
    console.error('Error obteniendo transacciones:', error);
    res.status(500).json({
      success: false,
      error: error.message
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

    // Intentar con cada método de pago
    for (const method of paymentMethods.data) {
      try {
        // Actualizar payment intent con el método de pago
        await stripe.paymentIntents.update(paymentIntentId, {
          payment_method: method.id
        });

        // Confirmar el pago
        const result = await stripe.paymentIntents.confirm(paymentIntentId);

        const attempt = {
          paymentMethodId: method.id,
          brand: method.card?.brand,
          last4: method.card?.last4,
          result: {
            success: result.status === 'succeeded',
            status: result.status,
            error: result.status !== 'succeeded' ? result.last_payment_error?.message : null
          }
        };

        attempts.push(attempt);

        // Si tuvo éxito, devolver inmediatamente
        if (result.status === 'succeeded') {
          return res.json({
            success: true,
            message: `Pago exitoso con ${method.card?.brand} terminada en ${method.card?.last4}`,
            attempts,
            successfulMethod: method
          });
        }
      } catch (error) {
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
