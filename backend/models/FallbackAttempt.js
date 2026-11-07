const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  accountId: { type: String, required: true }, userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  invoiceId: { type: String, required: true }, methodId: { type: String, required: true },
  fingerprint: String, brand: String, last4: String, amount: Number, currency: String,
  status: { type: String, enum: ['pending', 'declined', 'paid', 'processing', 'action_required', 'uncertain', 'skipped'], required: true },
  code: String, paymentIntentId: String
}, { timestamps: true });
schema.index({ accountId: 1, invoiceId: 1, methodId: 1 }, { unique: true });
schema.index({ accountId: 1, invoiceId: 1, status: 1 });
module.exports = mongoose.model('FallbackAttempt', schema);
