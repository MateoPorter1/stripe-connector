const mongoose = require('mongoose');
const schema = new mongoose.Schema({ _id: String, owner: String, until: Date }, { autoCreate: false, autoIndex: false });
module.exports = mongoose.model('FallbackLease', schema);
