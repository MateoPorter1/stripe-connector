const mongoose=require('mongoose');
module.exports=mongoose.model('BillingAudit',new mongoose.Schema({actorId:{type:mongoose.Schema.Types.ObjectId,required:true},userId:{type:mongoose.Schema.Types.ObjectId,required:true},scope:String,action:String,reason:String,status:{type:String,default:'pending'},requestId:String},{timestamps:true}));
