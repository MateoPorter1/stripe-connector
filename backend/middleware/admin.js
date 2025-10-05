const adminCheck = (req, res, next) => {
  try {
    // El middleware de autenticación ya agregó el usuario a req.user
    if (!req.user) {
      return res.status(401).json({ error: 'No tienes autorización. Por favor inicia sesión.' });
    }

    // Verificar si el usuario es admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Solo administradores pueden acceder.' });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Error al verificar permisos de administrador.' });
  }
};

module.exports = adminCheck;
