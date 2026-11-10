const mongoose = require('mongoose');
// Rebound merchant billing is deliberately separate from a user's recovery API key.
const schema = new mongoose.Schema({
  userId: {type: mongoose.Schema.Types.ObjectId, required:true},
  scope: {type:String,required:true},
  customerId: String,
  checkoutId: String,
  checkoutUrl: String,
  checkoutExpiresAt: Date,
  subscriptionId: String,
  status: {type:String,default:'none'},
  cancelAtPeriodEnd: {type:Boolean,default:false},
  currentPeriodEnd: Date,
  syncedAt: Date,
  trialStartedAt: Date,
  trialEndsAt: Date,
  paidThrough: Date,
  collectionBlocked: {type:Boolean,default:false},
  blockReason: String,
  leaseUntil: Date,
}, {timestamps:true});
schema.index({userId:1,scope:1},{unique:true});
schema.index({scope:1,customerId:1},{unique:true,partialFilterExpression:{customerId:{$type:'string'}}});
module.exports=mongoose.model('BillingAccount',schema);
