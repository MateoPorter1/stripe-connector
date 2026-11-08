const mongoose=require('mongoose');
const schema=new mongoose.Schema({batchId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},accountId:String,invoiceId:String,methodId:String,cardKey:String,
 brand:String,last4:String,amount:Number,currency:String,status:String,code:String,paymentIntentId:String},{timestamps:true,autoCreate:false,autoIndex:false});
schema.index({batchId:1,invoiceId:1,cardKey:1},{unique:true});
schema.index({accountId:1,invoiceId:1,status:1});
module.exports=mongoose.model('BatchCardAttempt',schema);
