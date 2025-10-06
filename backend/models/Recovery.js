const mongoose = require('mongoose');

const recoverySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  paymentIntentId: {
    type: String,
    required: true,
    index: true
  },
  customerId: {
    type: String,
    required: true
  },
  customerEmail: {
    type: String,
    default: ''
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    uppercase: true,
    default: 'USD'
  },
  paymentMethodUsed: {
    type: String,
    default: ''
  },
  paymentMethodDetails: {
    brand: String,
    last4: String
  },
  recoveredAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  originalFailedDate: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Índice compuesto para búsquedas por usuario y fecha
recoverySchema.index({ userId: 1, recoveredAt: -1 });

// Índice para evitar duplicados
recoverySchema.index({ userId: 1, paymentIntentId: 1 }, { unique: true });

module.exports = mongoose.model('Recovery', recoverySchema);
