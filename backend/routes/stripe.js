const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Recovery = require('../models/Recovery');

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

    const { startDate, endDate } = req.query;

    // Construir parámetros para la consulta
    const params = {
      limit: 100 // Máximo por petición de Stripe
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

    // Obtener TODAS las transacciones usando paginación
    let allPaymentIntents = [];
    let hasMore = true;
    let startingAfter = null;

    console.log('🔍 Obteniendo transacciones fallidas...');

    while (hasMore) {
      const queryParams = { ...params };
      if (startingAfter) {
        queryParams.starting_after = startingAfter;
      }

      const response = await stripe.paymentIntents.list(queryParams);
      allPaymentIntents = allPaymentIntents.concat(response.data);

      hasMore = response.has_more;
      if (hasMore && response.data.length > 0) {
        startingAfter = response.data[response.data.length - 1].id;
      }

      console.log(`  ✓ Obtenidas ${allPaymentIntents.length} transacciones hasta ahora...`);
    }

    console.log(`✅ Total de transacciones obtenidas: ${allPaymentIntents.length}`);

    // Filtrar solo transacciones fallidas
    const failedTransactions = allPaymentIntents.filter(transaction =>
      transaction.status === 'requires_payment_method' ||
      transaction.status === 'failed' ||
      transaction.status === 'canceled'
    );

    console.log(`❌ Transacciones fallidas encontradas: ${failedTransactions.length}`);

    // Agrupar por cliente (customer)
    const groupedByCustomer = {};

    failedTransactions.forEach(transaction => {
      const customerId = transaction.customer;

      if (!customerId) return; // Saltar transacciones sin cliente

      if (!groupedByCustomer[customerId]) {
        groupedByCustomer[customerId] = {
          customer: customerId,
          transactions: [],
          totalAmount: 0,
          failedCount: 0,
          latestDate: transaction.created,
          currency: transaction.currency
        };
      }

      groupedByCustomer[customerId].transactions.push(transaction);
      groupedByCustomer[customerId].totalAmount += transaction.amount;
      groupedByCustomer[customerId].failedCount += 1;

      // Mantener la fecha más reciente
      if (transaction.created > groupedByCustomer[customerId].latestDate) {
        groupedByCustomer[customerId].latestDate = transaction.created;
      }
    });

    // Convertir a array y ordenar por fecha más reciente
    const customerList = Object.values(groupedByCustomer).sort((a, b) => b.latestDate - a.latestDate);

    console.log(`👥 Clientes únicos con transacciones fallidas: ${customerList.length}`);

    // Enriquecer datos de clientes (email, país, métodos de pago)
    console.log(`🔄 Enriching customer data...`);
    const enrichedCustomers = await Promise.all(
      customerList.map(async (customerData) => {
        try {
          // Obtener info del cliente y métodos de pago en paralelo
          const [customerInfo, paymentMethods] = await Promise.all([
            stripe.customers.retrieve(customerData.customer),
            stripe.paymentMethods.list({
              customer: customerData.customer,
              type: 'card'
            })
          ]);

          return {
            ...customerData,
            email: customerInfo.email || 'No email',
            country: customerInfo.address?.country || 'Unknown',
            paymentMethodsCount: paymentMethods.data.length
          };
        } catch (error) {
          console.error(`❌ Error enriching customer ${customerData.customer}:`, error.message);
          // Devolver datos básicos si falla el enriquecimiento
          return {
            ...customerData,
            email: 'Error loading',
            country: 'Unknown',
            paymentMethodsCount: 0
          };
        }
      })
    );

    console.log(`✅ Customer data enriched successfully`);

    res.json({
      success: true,
      customers: enrichedCustomers,
      totalCustomers: enrichedCustomers.length,
      totalFailedTransactions: failedTransactions.length,
      totalFetched: allPaymentIntents.length
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
