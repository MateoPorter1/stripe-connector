require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Fail promptly instead of buffering database requests during outages.
mongoose.set('bufferCommands', false);

// Database connection
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000
  })
  .then(() => console.log('✅ Conectado a MongoDB'))
  .catch(err => console.error('❌ Error conectando a MongoDB:', err));
} else {
  console.log('⚠️  Ejecutando sin MongoDB (solo desarrollo local)');
}

// The app cannot authenticate or load account data without the database.
app.use('/api', (req, res, next) => {
  if (['/health', '/ready'].includes(req.path)) return next();
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Service temporarily unavailable. Please try again shortly.' });
  }
  next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/stripe', require('./routes/stripe'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/stats', require('./routes/stats'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'unavailable' });
});

app.get('/api/ready', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ status: ready ? 'ok' : 'unavailable' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
