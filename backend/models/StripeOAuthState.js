const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  _id: String,
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  mode: { type: String, enum: ['live', 'test', 'sandbox'], required: true },
  expiresAt: { type: Date, required: true }
});
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('StripeOAuthState', schema);
