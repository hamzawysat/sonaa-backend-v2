'use strict';
const mongoose=require('mongoose');
const schema=new mongoose.Schema({
 client:{type:mongoose.Schema.Types.ObjectId,ref:'Client',required:true,index:true},
 clientName:{type:String,trim:true,maxlength:50,default:''},
 clientPhone:{type:String,trim:true,maxlength:20,default:''},
 amount:{type:Number,required:true,min:10,max:10000,validate:{validator:Number.isInteger,message:'مبلغ الشحن يجب أن يكون عددًا صحيحًا من الجنيهات'}},
 senderNumber:{type:String,required:true,trim:true,match:/^01[0-9]{9}$/},
 method:{type:String,enum:['vodafone_cash','orange_cash','etisalat_cash','we_cash'],required:true,index:true},
 referenceNumber:{type:String,trim:true,maxlength:50,default:''},
 status:{type:String,enum:['قيد المراجعة','مقبول','مرفوض'],default:'قيد المراجعة',index:true},
 isCredited:{type:Boolean,default:false,index:true},
 reviewReason:{type:String,trim:true,maxlength:500,default:''},
 reviewedAt:{type:Date,default:null},
 reviewedBy:{type:String,trim:true,maxlength:50,default:''},
 idempotencyKey:{type:String,required:true,unique:true,index:true,maxlength:100}
},{timestamps:true});
schema.index({client:1,createdAt:-1});
module.exports=mongoose.model('ClientTopupRequest',schema);
