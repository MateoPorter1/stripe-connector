const mongoose=require('mongoose');
const item=new mongoose.Schema({invoiceId:String,maxAmount:Number,currency:String,state:String,attempts:Number,reason:String},{_id:false});
const schema=new mongoose.Schema({userId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},accountId:String,keyHash:String,requestId:String,
 startDate:String,endDate:String,runnerId:String,status:{type:String,enum:['running','stopping','completed','cancelled','interrupted','failed']},items:[item],lastError:String,finishedAt:Date},
 {timestamps:true,autoCreate:false,autoIndex:false});
schema.index({userId:1,requestId:1},{unique:true});
module.exports=mongoose.model('RetryBatch',schema);
