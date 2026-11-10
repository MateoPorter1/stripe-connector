const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const adminCheck = require('../middleware/admin');

// Aplicar autenticación y verificación de admin a todas las rutas
router.use(auth);
router.use(adminCheck);

// @route   GET /api/admin/users
// @desc    Obtener todos los usuarios
// @access  Admin
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });

    res.json({
      success: true,
      users: users.map(user => ({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        plan: user.plan,
        planExpiry: user.planExpiry,
        createdAt: user.createdAt
      }))
    });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// @route   PUT /api/admin/users/:id/plan
// @desc    Actualizar plan de usuario
// @access  Admin
router.put('/users/:id/plan', (req,res)=>res.status(410).json({error:'Legacy plans are retired. Manage the Stripe subscription in Subscribers.'}));

// @route   PUT /api/admin/users/:id/role
// @desc    Actualizar rol de usuario
// @access  Admin
router.put('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    const userId = req.params.id;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Rol inválido. Debe ser "user" o "admin"' });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    user.role = role;
    await user.save();

    res.json({
      success: true,
      message: `Rol actualizado a ${role}`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error al actualizar rol:', error);
    res.status(500).json({ error: 'Error al actualizar rol' });
  }
});

// @route   GET /api/admin/stats
// @desc    Obtener estadísticas del sistema
// @access  Admin
router.get('/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const freeUsers = await User.countDocuments({ plan: 'free' });
    const premiumUsers = await User.countDocuments({ plan: 'premium' });
    const adminUsers = await User.countDocuments({ role: 'admin' });

    res.json({
      success: true,
      stats: {
        totalUsers,
        freeUsers,
        premiumUsers,
        adminUsers,
        regularUsers: totalUsers - adminUsers
      }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

module.exports = router;
