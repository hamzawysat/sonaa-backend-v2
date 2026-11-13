'use strict';
const express=require('express');
const crypto=require('crypto');
function createAdminClientWalletRouter({auth,validate,Joi,mongoose,Client,ClientTopupRequest,WalletTransaction,Order,adminName,writeAdminAudit,createNotification,validId,sendBadId,MAX_LIST_LIMIT}){
 const router=express.Router();
 router.get('/client-wallet/topup-requests',auth('admin'),async(req,res,next)=>{
  try{const requests=await ClientTopupRequest.find({}).sort({createdAt:-1}).limit(MAX_LIST_LIMIT).lean();return res.json({requests,data:requests});}catch(e){next(e);}
 });
 router.post('/client-wallet/topup-requests/:id/approve',auth('admin'),async(req,res,next)=>{
  if(!validId(req.params.id))return sendBadId(res);
  let session;
  try{
   session=await mongoose.startSession();let outcome=null;
   await session.withTransaction(async()=>{
    const request=await ClientTopupRequest.findOneAndUpdate({_id:req.params.id,status:'قيد المراجعة',isCredited:false},{$set:{status:'مقبول',isCredited:true,reviewedAt:new Date(),reviewedBy:adminName(req),reviewReason:''}},{new:true,session});
    if(!request){outcome={kind:'not-pending'};return;}
    const client=await Client.findOneAndUpdate({_id:request.client,status:'نشط',walletFrozen:{$ne:true}},{$inc:{walletBalance:Number(request.amount)}},{new:true,session,runValidators:true});
    if(!client)throw new Error('CLIENT_WALLET_UNAVAILABLE');
    const after=Number(client.walletBalance),before=after-Number(request.amount);
    await new WalletTransaction({client:client._id,type:'client_topup',amount:Number(request.amount),balanceBefore:before,balanceAfter:after,description:'اعتماد شحن محفظة العميل لطلب '+String(request._id),idempotencyKey:'client-topup:'+String(request._id)}).save({session});
    outcome={kind:'approved',request,client,balance:after};
   });
   if(outcome?.kind!=='approved'){const current=await ClientTopupRequest.findById(req.params.id).lean();if(!current)return res.status(404).json({message:'طلب الشحن غير موجود.'});return res.status(409).json({message:'تمت معالجة طلب الشحن بالفعل أو أنه غير متاح للمراجعة.',status:current.status,isCredited:Boolean(current.isCredited)});}
   await writeAdminAudit(req,'اعتماد شحن محفظة عميل','client-wallet',String(outcome.client._id),'topupRequest='+String(outcome.request._id)+'; amount='+Number(outcome.request.amount)+'; balance='+outcome.balance);
   await createNotification({recipientRole:'client',recipientId:outcome.client._id,type:'client_wallet_topup_approved',title:'تم شحن محفظتك',message:'تم اعتماد التحويل وإضافة '+outcome.request.amount+' جنيه إلى محفظتك.',link:'/client.html?tab=wallet',dedupeKey:'client-topup-approved:'+String(outcome.request._id)});
   return res.json({message:'تم اعتماد الشحن وإضافة الرصيد مرة واحدة.',request:outcome.request,balance:outcome.balance});
  }catch(e){if(e.message==='CLIENT_WALLET_UNAVAILABLE')return res.status(409).json({message:'حساب العميل غير نشط أو محفظته مجمدة؛ لم يتم اعتماد الشحن.'});return next(e);}finally{if(session)await session.endSession();}
 });
 router.post('/client-wallet/topup-requests/:id/reject',auth('admin'),validate(Joi.object({reason:Joi.string().trim().max(500).allow('').default('')})),async(req,res,next)=>{
  if(!validId(req.params.id))return sendBadId(res);
  try{
   const request=await ClientTopupRequest.findOneAndUpdate({_id:req.params.id,status:'قيد المراجعة',isCredited:false},{$set:{status:'مرفوض',isCredited:false,reviewedAt:new Date(),reviewedBy:adminName(req),reviewReason:String(req.body.reason||'').trim()}},{new:true,runValidators:true});
   if(!request){const current=await ClientTopupRequest.findById(req.params.id).lean();if(!current)return res.status(404).json({message:'طلب الشحن غير موجود.'});return res.status(409).json({message:'تمت معالجة طلب الشحن بالفعل أو أنه غير متاح للمراجعة.',status:current.status});}
   await writeAdminAudit(req,'رفض شحن محفظة عميل','client-wallet',String(request.client),'topupRequest='+String(request._id)+'; amount='+Number(request.amount)+'; reason='+String(request.reviewReason||''));
   await createNotification({recipientRole:'client',recipientId:request.client,type:'client_wallet_topup_rejected',title:'طلب شحن المحفظة مرفوض',message:'تم رفض طلب الشحن. '+String(request.reviewReason||'').slice(0,180),link:'/client.html?tab=wallet',dedupeKey:'client-topup-rejected:'+String(request._id)});
   return res.json({message:'تم رفض طلب الشحن.',request});
  }catch(e){next(e);}
 });
 router.post('/clients/:id/wallet/add-balance',auth('admin'),validate(Joi.object({amount:Joi.number().strict().integer().positive().max(100000000).required(),reason:Joi.string().trim().max(500).allow('').default('')})),async(req,res,next)=>{
  if(!validId(req.params.id))return sendBadId(res);
  let session;
  try{
   session=await mongoose.startSession();let outcome=null;
   await session.withTransaction(async()=>{
    const before=await Client.findById(req.params.id).session(session);if(!before){outcome=null;return;}
    const balanceBefore=Number(before.walletBalance||0);
    const client=await Client.findByIdAndUpdate(before._id,{$inc:{walletBalance:Number(req.body.amount)}},{new:true,session,runValidators:true});
    if(!client)throw new Error('CLIENT_WALLET_CLIENT_NOT_FOUND');
    await new WalletTransaction({client:client._id,type:'client_admin_adjustment',amount:Number(req.body.amount),balanceBefore,balanceAfter:Number(client.walletBalance),description:('إضافة إدارية: '+String(req.body.reason||'بدون سبب')).slice(0,500),idempotencyKey:'client-admin-credit:'+String(client._id)+':'+crypto.randomUUID()}).save({session});
    outcome={client,balance:Number(client.walletBalance)};
   });
   if(!outcome)return res.status(404).json({message:'العميل غير موجود.'});
   await writeAdminAudit(req,'إضافة رصيد لمحفظة عميل','client-wallet',String(outcome.client._id),'amount='+Number(req.body.amount)+'; balance='+outcome.balance+'; reason='+String(req.body.reason||''));
   await createNotification({recipientRole:'client',recipientId:outcome.client._id,type:'client_wallet_credit',title:'تم إضافة رصيد لمحفظتك',message:'أضافت الإدارة '+Number(req.body.amount)+' جنيه إلى محفظتك.',link:'/client.html?tab=wallet',dedupeKey:'client-wallet-admin-credit:'+String(outcome.client._id)+':'+String(Date.now())});
   return res.json({message:'تمت إضافة الرصيد وتسجيل الحركة المالية.',balance:outcome.balance});
  }catch(e){next(e);}finally{if(session)await session.endSession();}
 });
 router.post('/client-wallet/orders/:sn/refund',auth('admin'),validate(Joi.object({reason:Joi.string().trim().min(3).max(500).required()})),async(req,res,next)=>{
  const sn=String(req.params.sn||'').trim().toUpperCase();
  if(!/^SN\\d{6}$/.test(sn))return res.status(400).json({message:'كود الطلب غير صالح.'});
  let session;
  let outcome=null;
  try{
   session=await mongoose.startSession();
   await session.withTransaction(async()=>{
    const order=await Order.findOne({sn,clientPaymentStatus:'held',status:'تم اختيار فني'}).session(session);
    if(!order){outcome={kind:'not-refundable'};return;}
    if(!order.clientAccount){outcome={kind:'missing-client'};return;}
    const amount=Number(order.clientPaymentAmount||0);
    if(!Number.isFinite(amount)||amount<=0)throw new Error('INVALID_HELD_PAYMENT_AMOUNT');
    const clientBefore=await Client.findById(order.clientAccount).session(session);
    if(!clientBefore){outcome={kind:'missing-client'};return;}
    const balanceBefore=Number(clientBefore.walletBalance||0);
    const clientAfter=await Client.findOneAndUpdate({_id:clientBefore._id},{$inc:{walletBalance:amount}},{new:true,session,runValidators:true});
    if(!clientAfter)throw new Error('CLIENT_REFUND_CREDIT_FAILED');
    order.clientPaymentStatus='refunded';
    order.status='ملغي';
    order.adminActionNote=String(req.body.reason).trim().slice(0,500);
    order.adminActionAt=new Date();
    order.adminActionBy=String(adminName(req)||'الإدارة').slice(0,120);
    await order.save({session});
    await new WalletTransaction({
     client:clientAfter._id,order:order._id,orderSN:order.sn,type:'client_refund',
     amount,balanceBefore,balanceAfter:Number(clientAfter.walletBalance),
     description:('استرداد قيمة الخدمة للطلب '+order.sn+'؛ السبب: '+String(req.body.reason)).slice(0,500),
     idempotencyKey:'client-service-refund:'+String(order._id)
    }).save({session});
    outcome={kind:'refunded',orderId:order._id,clientId:clientAfter._id,amount,balance:Number(clientAfter.walletBalance),fanniId:order.assignedFanni};
   });
   if(outcome?.kind==='not-refundable')return res.status(409).json({message:'الطلب غير قابل للاسترداد؛ يجب أن يكون المبلغ محجوزًا والطلب جاريًا، ولم يسبق استرداده.'});
   if(outcome?.kind==='missing-client')return res.status(409).json({message:'الطلب غير مرتبط بحساب عميل مسجل؛ لم يتم تنفيذ الاسترداد.'});
   await writeAdminAudit(req,'استرداد قيمة خدمة إلى محفظة العميل','client-wallet',String(outcome.clientId),'order='+sn+'; amount='+outcome.amount+'; reason='+String(req.body.reason));
   try{await createNotification({recipientRole:'client',recipientId:outcome.clientId,type:'client_service_refunded',title:'تم استرداد قيمة الخدمة',message:'تم إعادة '+outcome.amount+' جنيه إلى محفظتك عن الطلب '+sn+'.',link:'/client.html?tab=wallet',dedupeKey:'client-service-refund-notice:'+String(outcome.orderId)});}catch(_){}
   if(outcome.fanniId){try{await createNotification({recipientRole:'fanni',recipientId:outcome.fanniId,type:'client_service_refunded',title:'تم إلغاء الطلب واسترداد قيمته',message:'قامت الإدارة بإلغاء الطلب '+sn+' واسترداد قيمته للعميل.',link:'/fanni',dedupeKey:'client-service-refund-fanni:'+String(outcome.orderId)});}catch(_){}}
   return res.json({message:'تم إلغاء الطلب واسترداد المبلغ إلى محفظة العميل بنجاح.',orderSN:sn,amount:outcome.amount,balance:outcome.balance,paymentStatus:'refunded'});
  }catch(e){if(e.code===11000)return res.status(409).json({message:'تم تسجيل استرداد هذا الطلب بالفعل؛ لم يتم تكرار إضافة الرصيد.'});return next(e);}
  finally{if(session)await session.endSession();}
 });
 router.get('/client-wallet/transactions/:clientId',auth('admin'),async(req,res,next)=>{
  if(!validId(req.params.clientId))return sendBadId(res);
  try{const transactions=await WalletTransaction.find({client:req.params.clientId}).sort({createdAt:-1}).limit(100).lean();return res.json({transactions,data:transactions});}catch(e){next(e);}
 });
 return router;
}
module.exports=createAdminClientWalletRouter;
