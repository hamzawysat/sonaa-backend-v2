'use strict';

async function loadOrders(page=1,append=false){
 if(!getToken())return false;
 if(state.loading)return null;

 state.loading=true;
 render();

 try{
  const data=await API.available(page);
  const incoming=extractList(data,['orders','requests','items']);
  state.orders=append?[...(state.orders||[]),...incoming]:incoming;
  state.ordersPagination=data.pagination||{page,limit:20,total:state.orders.length,pages:1};
  applyFilter();
  state.loading=false;
  render();
  return true;
 }catch(e){
  state.loading=false;
  if(!append){state.orders=[];state.filteredOrders=[];}
  render();
  toast(e.message,'error');
  return false;
 }
}

function toggleFanniRatingBlock(sn){
 const select=document.getElementById('rating-stars-'+sn);
 const wrap=document.getElementById('rating-block-wrap-'+sn);
 if(wrap)wrap.style.display=Number(select?.value)===1?'flex':'none';
 if(Number(select?.value)!==1){
  const checkbox=document.getElementById('rating-block-'+sn);
  if(checkbox)checkbox.checked=false;
 }
}
async function submitFanniRating(sn){
 const stars=Number(document.getElementById('rating-stars-'+sn)?.value);
 const comment=String(document.getElementById('rating-comment-'+sn)?.value||'').trim().slice(0,500);
 const blockFuture=Boolean(document.getElementById('rating-block-'+sn)?.checked);
 if(!Number.isInteger(stars)||stars<1||stars>5){toast('اختار عدد النجوم','error');return;}
 if(blockFuture&&stars!==1){toast('إيقاف التعامل متاح مع تقييم نجمة واحدة فقط','error');return;}
 try{await API.rateOrder(sn,{stars,comment,blockFuture});toast('تم حفظ تقييمك بنجاح');await loadMyOffers();}
 catch(e){toast(e.message||'تعذر حفظ التقييم','error');}
}
async function completeOrder(sn){
 const code=String(sn||'').trim().toUpperCase();
 if(!code){
  toast('كود الطلب غير موجود','error');
  return;
 }

 if(!confirm('هل تؤكد إنك أنهيت تنفيذ المهمة؟')) return;

 try{
  const result=await API.complete(code);
  toast(result?.message||'تم إكمال المهمة بنجاح');
  state.tab='completed';
  await loadMyOffers();
  setTimeout(()=>focusRatingPrompt(code),120);
 }catch(e){
  toast(e?.message||'تعذر إكمال المهمة','error');
 }
 }
 