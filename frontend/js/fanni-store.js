'use strict';
state.storeProducts=state.storeProducts||[];
state.storeOrders=state.storeOrders||[];
state.storeLoading=false;
state.storeSubmitting=false;
async function loadFanniStore(){
  if(!getToken()||state.storeLoading)return;
  state.storeLoading=true;render();
  try{
    const [catalog,orders]=await Promise.all([apiGet('/api/fanni/commerce/products'),apiGet('/api/fanni/commerce/product-orders')]);
    state.storeProducts=Array.isArray(catalog.items)?catalog.items:[];
    state.storeOrders=Array.isArray(orders.orders)?orders.orders:[];
  }catch(error){toast(error.message||'تعذر تحميل المتجر.','error');}
  finally{state.storeLoading=false;render();}
}
async function buyFanniStoreProduct(itemId){
  if(state.storeSubmitting)return;
  const item=state.storeProducts.find(x=>String(x._id)===String(itemId));
  if(!item)return toast('الصنف غير متاح حاليًا.','error');
  const quantity=Number(prompt('اكتب الكمية المطلوبة:','1'));
  if(!Number.isInteger(quantity)||quantity<1||quantity>100)return toast('الكمية يجب أن تكون من 1 إلى 100.','error');
  const note=prompt('أي تفاصيل إضافية للطلب؟ (اختياري)','')||'';
  if(!confirm('تأكيد طلب '+quantity+' من '+item.name+' بإجمالي '+(Number(item.price)*quantity)+' جنيه؟ لن يتم خصم أي مبلغ الآن.'))return;
  state.storeSubmitting=true;render();
  try{const result=await apiPost('/api/fanni/commerce/product-orders',{itemId:String(itemId),quantity,note});toast(result.message||'تم تسجيل الطلب وإشعار الإدارة.');await loadFanniStore();}
  catch(error){toast(error.message||'تعذر تسجيل الطلب.','error');}
  finally{state.storeSubmitting=false;render();}
}
function renderFanniStore(){
  const rows=state.storeProducts||[],orders=state.storeOrders||[];
  const labels={pending:'قيد المراجعة',contacted:'تم التواصل',confirmed:'تم التأكيد',completed:'مكتمل',cancelled:'ملغي'};
  return '<section class="mt-4 space-y-3"><div class="panel p-4"><h3 class="section-title">المتجر</h3><p class="mt-1 text-[11px] text-slate-500">اطلب البضاعة المتاحة، والإدارة هتتواصل معاك لتأكيد الطلب وطريقة الدفع.</p><button type="button" onclick="loadFanniStore()" class="secondary-btn mt-3 w-full py-2">تحديث المتجر</button></div>'+(state.storeLoading?'<div class="panel p-4 text-center">جاري تحميل المتجر...</div>':'')+(rows.filter(item=>!(Number(item.originalPrice)>Number(item.price))).map(item=>'<article class="panel p-4"><div class="flex justify-between gap-3"><div><b class="text-sm">'+esc(item.name)+'</b><p class="mt-1 text-[11px] text-slate-500">'+esc(item.description||'')+'</p></div><b>'+Number(item.price).toLocaleString('ar-EG')+' ج</b></div><button type="button" onclick="buyFanniStoreProduct(\''+esc(item._id)+'\')" '+(state.storeSubmitting?'disabled':'')+' class="primary-btn mt-3 w-full h-10 text-[11px]">طلب شراء</button></article>').join('')||'<div class="panel p-5 text-center text-xs text-slate-500">لا توجد أصناف متاحة حاليًا.</div>')+'<div class="panel p-4"><h4 class="font-extrabold text-sm">العروض</h4><div class="mt-3 space-y-2">'+(rows.filter(item=>Number(item.originalPrice)>Number(item.price)).map(item=>'<article class="rounded-xl border border-amber-200 bg-amber-50 p-3"><div class="flex justify-between gap-3"><b>'+esc(item.name)+'</b><b>'+Number(item.price).toLocaleString('ar-EG')+' ج <del>'+Number(item.originalPrice).toLocaleString('ar-EG')+'</del></b></div><p class="mt-1 text-[11px]">'+esc(item.description||'')+'</p><button type="button" onclick="buyFanniStoreProduct(\''+esc(item._id)+'\')" class="primary-btn mt-3 w-full h-10">طلب العرض</button></article>').join('')||'<p class="text-xs text-slate-500">لا توجد عروض حاليًا.</p>')+'</div></div><div class="panel p-4"><h4 class="font-extrabold text-sm">طلباتي من المتجر</h4><div class="mt-3 space-y-2">'+(orders.map(o=>'<article class="rounded-xl border p-3 text-[11px]"><b>'+esc(o.itemName)+'</b> · '+Number(o.total).toLocaleString('ar-EG')+' جنيه<p class="mt-1 text-slate-500">'+esc(o.orderNumber)+' · '+esc(labels[o.status]||o.status)+'</p></article>').join('')||'<p class="text-slate-500">لا توجد طلبات شراء حتى الآن.</p>')+'</div></div></section>';
}
