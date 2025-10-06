const express = require('express');
const router = express.Router();
const Recovery = require('../models/Recovery');
const auth = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(auth);

// @route   GET /api/stats/summary
// @desc    Obtener resumen de recaudación del usuario
// @access  Private
router.get('/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const userId = req.user._id;

    // Construir filtro de fecha
    const dateFilter = { userId };
    if (startDate || endDate) {
      dateFilter.recoveredAt = {};
      if (startDate) {
        dateFilter.recoveredAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.recoveredAt.$lte = end;
      }
    }

    // Obtener todas las recuperaciones del periodo
    const recoveries = await Recovery.find(dateFilter);

    // Calcular totales por moneda
    const totalsByCurrency = {};
    recoveries.forEach(recovery => {
      const currency = recovery.currency;
      if (!totalsByCurrency[currency]) {
        totalsByCurrency[currency] = {
          totalAmount: 0,
          count: 0
        };
      }
      totalsByCurrency[currency].totalAmount += recovery.amount;
      totalsByCurrency[currency].count++;
    });

    // Obtener última recuperación
    const lastRecovery = await Recovery.findOne(dateFilter)
      .sort({ recoveredAt: -1 });

    // Calcular promedio general (en la moneda principal)
    const mainCurrency = Object.keys(totalsByCurrency)[0] || 'USD';
    const mainCurrencyData = totalsByCurrency[mainCurrency] || { totalAmount: 0, count: 0 };
    const averageAmount = mainCurrencyData.count > 0
      ? mainCurrencyData.totalAmount / mainCurrencyData.count
      : 0;

    res.json({
      success: true,
      summary: {
        totalsByCurrency,
        totalRecoveries: recoveries.length,
        averageAmount,
        mainCurrency,
        lastRecovery: lastRecovery ? {
          amount: lastRecovery.amount,
          currency: lastRecovery.currency,
          date: lastRecovery.recoveredAt,
          customerEmail: lastRecovery.customerEmail
        } : null
      }
    });
  } catch (error) {
    console.error('Error obteniendo resumen:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener resumen de recaudación'
    });
  }
});

// @route   GET /api/stats/by-month
// @desc    Obtener datos de recaudación agrupados por mes
// @access  Private
router.get('/by-month', async (req, res) => {
  try {
    const { startDate, endDate, currency = 'USD' } = req.query;
    const userId = req.user._id;

    // Construir filtro de fecha
    const matchFilter = { userId, currency: currency.toUpperCase() };
    if (startDate || endDate) {
      matchFilter.recoveredAt = {};
      if (startDate) {
        matchFilter.recoveredAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchFilter.recoveredAt.$lte = end;
      }
    }

    // Agregación por mes
    const monthlyData = await Recovery.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: {
            year: { $year: '$recoveredAt' },
            month: { $month: '$recoveredAt' }
          },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Formatear datos para el gráfico
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const formattedData = monthlyData.map(item => ({
      month: `${monthNames[item._id.month - 1]} ${item._id.year}`,
      year: item._id.year,
      monthNumber: item._id.month,
      amount: item.totalAmount / 100, // Convertir de centavos a dólares
      count: item.count,
      currency: currency.toUpperCase()
    }));

    res.json({
      success: true,
      data: formattedData,
      currency: currency.toUpperCase()
    });
  } catch (error) {
    console.error('Error obteniendo datos por mes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener datos mensuales'
    });
  }
});

// @route   POST /api/stats/record-recovery
// @desc    Registrar una recuperación exitosa (uso interno)
// @access  Private
router.post('/record-recovery', async (req, res) => {
  try {
    const {
      paymentIntentId,
      customerId,
      customerEmail,
      amount,
      currency,
      paymentMethodUsed,
      paymentMethodDetails,
      originalFailedDate
    } = req.body;

    const userId = req.user._id;

    // Verificar que no exista ya (evitar duplicados)
    const existing = await Recovery.findOne({ userId, paymentIntentId });
    if (existing) {
      return res.json({
        success: true,
        message: 'Recuperación ya registrada',
        recovery: existing
      });
    }

    // Crear nueva recuperación
    const recovery = new Recovery({
      userId,
      paymentIntentId,
      customerId,
      customerEmail: customerEmail || '',
      amount,
      currency: currency.toUpperCase(),
      paymentMethodUsed: paymentMethodUsed || '',
      paymentMethodDetails,
      originalFailedDate: originalFailedDate ? new Date(originalFailedDate) : null,
      recoveredAt: new Date()
    });

    await recovery.save();

    res.json({
      success: true,
      message: 'Recuperación registrada exitosamente',
      recovery
    });
  } catch (error) {
    console.error('Error registrando recuperación:', error);
    res.status(500).json({
      success: false,
      error: 'Error al registrar recuperación'
    });
  }
});

// @route   GET /api/stats/recent-recoveries
// @desc    Obtener últimas recuperaciones
// @access  Private
router.get('/recent-recoveries', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const userId = req.user._id;

    const recoveries = await Recovery.find({ userId })
      .sort({ recoveredAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      recoveries
    });
  } catch (error) {
    console.error('Error obteniendo recuperaciones recientes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener recuperaciones recientes'
    });
  }
});

module.exports = router;
