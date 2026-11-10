const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  _id: String,
  accountId: String,
  mode: String,
  created: Number,
  deleted: { type: Boolean, default: false }
});
schema.index({ accountId: 1, mode: 1, created: -1 });
module.exports = mongoose.model('StripeAppInstall', schema);
