const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(auth);

// @route   GET /api/profile
// @desc    Obtener información del perfil del usuario
// @access  Private
router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -stripeApiKey');

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        plan: user.plan,
        planExpiry: user.planExpiry,
        hasConfiguredStripe: user.hasConfiguredStripe,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({ error: 'Error al obtener información del perfil' });
  }
});

// @route   GET /api/profile/stripe-status
// @desc    Verificar si el usuario ha configurado su API key de Stripe
// @access  Private
router.get('/stripe-status', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('hasConfiguredStripe');

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({
      success: true,
      hasConfiguredStripe: user.hasConfiguredStripe
    });
  } catch (error) {
    console.error('Error verificando estado de Stripe:', error);
    res.status(500).json({ error: 'Error al verificar configuración de Stripe' });
  }
});

// @route   PUT /api/profile/stripe-key
// @desc    Guardar o actualizar la API key de Stripe del usuario
// @access  Private
router.put('/stripe-key', async (req, res) => {
  try {
    const { stripeApiKey } = req.body;

    if (!stripeApiKey || !stripeApiKey.trim()) {
      return res.status(400).json({ error: 'La API key de Stripe es requerida' });
    }

    // Validar formato básico de la API key de Stripe
    if (!stripeApiKey.startsWith('sk_')) {
      return res.status(400).json({
        error: 'API key inválida. Debe comenzar con "sk_test_" o "sk_live_"'
      });
    }

    // Actualizar usuario con la nueva API key
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    user.stripeApiKey = stripeApiKey.trim();
    user.hasConfiguredStripe = true;
    await user.save();

    res.json({
      success: true,
      message: 'API key de Stripe configurada exitosamente',
      hasConfiguredStripe: true
    });
  } catch (error) {
    console.error('Error guardando API key:', error);
    res.status(500).json({ error: 'Error al guardar la API key de Stripe' });
  }
});

// @route   DELETE /api/profile/stripe-key
// @desc    Eliminar la API key de Stripe del usuario
// @access  Private
router.delete('/stripe-key', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    user.stripeApiKey = null;
    user.hasConfiguredStripe = false;
    await user.save();

    res.json({
      success: true,
      message: 'API key de Stripe eliminada exitosamente',
      hasConfiguredStripe: false
    });
  } catch (error) {
    console.error('Error eliminando API key:', error);
    res.status(500).json({ error: 'Error al eliminar la API key de Stripe' });
  }
});

module.exports = router;
