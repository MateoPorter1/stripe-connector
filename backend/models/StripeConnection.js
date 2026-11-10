const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  accountId: { type: String, required: true },
  mode: { type: String, enum: ['live', 'test', 'sandbox'], required: true },
  status: { type: String, enum: ['active', 'disconnected', 'reconnect_required'], required: true },
  connectionVersion: { type: String, required: true },
  accessToken: { type: String, select: false },
  refreshToken: { type: String, select: false },
  accessExpiresAt: Date,
  refreshLeaseId: String,
  refreshLeaseUntil: Date,
  generation: { type: Number, default: 0 },
  connectedAt: Date,
  disconnectedAt: Date,
  installId: String
}, { timestamps: true });
// Prevent one Stripe account being silently claimed by two unrelated workspaces.
schema.index({ accountId: 1, mode: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });
module.exports = mongoose.model('StripeConnection', schema);
