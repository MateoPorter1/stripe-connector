const mongoose = require('mongoose');
const schema = new mongoose.Schema({ _id: String, owner: String, until: Date });
module.exports = mongoose.model('FallbackLease', schema);
