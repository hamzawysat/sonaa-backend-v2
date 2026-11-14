'use strict';

async function loadMyOffers(){
 if(!getToken())return false;

 try{
  const data=await API.myOffers();
  const allOffers=extractList(data,['offers','items','requests']);
state.completedOffers=allOffers.filter(o=>o.completed===true||o.orderStatus==='تم الانتهاء');
state.myOffers=allOffers.filter(o=>!(o.completed===true||o.orderStatus==='تم الانتهاء'));
  applyFilter();
  render();
  return true;
 }catch(e){
  log('my offers',e);

  if(e.status===401){
   toast('انتهت جلسة الدخول. سجل دخولك مرة أخرى.','error');
  }
  return false;
 }
}
 
function openOffer(sn){
 if(!isApproved()){toast('لا يمكن إرسال عرض قبل اعتماد الحساب','error');return}
 if(!V.sn(sn)){toast('كود الطلب غير صحيح','error');return}

 state.offerModal={sn};
 state.offerPrice='';
 state.offerMessage='';
 state.offerError='';
 state.error='';
 render();
}

function closeOffer(){
 if(state.offerSubmitting)return;

 state.offerModal=null;
 state.offerError='';
 render();
}

async function submitOffer(){
 if(!state.offerModal||state.offerSubmitting)return;

 if(!isApproved()){
  state.offerError='لا يمكن إرسال عرض قبل اعتماد الحساب.';
  render();
  return;
 }

 const sn=state.offerModal.sn;
 const price=Number(state.offerPrice);
 const message=clean(state.offerMessage,500);

 if(state.myOffers.some(o=>o?.accepted===true&&o?.orderStatus==='تم اختيار فني')){toast('لديك مهمة جارية حاليًا. برجاء إنهاء المهمة الحالية أولًا قبل التقدم لأي طلب جديد.','error');return;}

 if(!V.money(price,10,1000000)){
  state.offerError='السعر يجب أن يكون عددًا صحيحًا من 10 إلى مليون جنيه.';
  render();
  return;
 }

 if(!V.text(message,5,500)){
  state.offerError='اكتب رسالة من 5 إلى 500 حرف.';
  render();
  return;
 }

 state.offerSubmitting=true;
 state.offerError='';
 render();

 try{
  const result=await API.offer(sn,{price,message});

  state.offerSubmitting=false;
  state.offerModal=null;
  state.offerPrice='';
  state.offerMessage='';
  state.offerError='';

  render();
  toast(result?.message||'تم إرسال العرض بنجاح');

  await Promise.allSettled([loadMyOffers(),loadOrders()]);
 }catch(e){
  state.offerSubmitting=false;
  state.offerError=e?.message||'تعذر إرسال العرض. حاول مرة أخرى.';
  render();
  toast(state.offerError,'error');
 }
}

async function requestFanniPriceChange(sn){const price=Number(document.getElementById('price-change-'+sn)?.value);const reason=String(document.getElementById('price-reason-'+sn)?.value||'').trim();const offer=[...state.myOffers,...state.completedOffers].find(o=>String(o.orderSn||o.sn||o.order?.sn||'').toUpperCase()===String(sn||'').toUpperCase());const currentPrice=Number(offer?.client?.acceptedOfferPrice??offer?.acceptedOfferPrice??offer?.priceNum??offer?.price);if(!Number.isFinite(currentPrice))return toast('تعذر تحديد السعر الحالي؛ حدّث البيانات وحاول مرة أخرى.','error');if(!Number.isFinite(price)||price<=currentPrice||price<=0)return toast('السعر الجديد لازم يكون أعلى من السعر الحالي ('+currentPrice+' جنيه).','error');if(reason.length<5)return toast('اكتب سببًا واضحًا للتعديل.','error');try{const r=await API.requestPriceChange(sn,price,reason);toast(r.message||'تم إرسال طلب تعديل السعر.');await loadMyOffers();}catch(e){toast(e.message||'تعذر طلب تعديل السعر.','error');}}

