'use strict';

function clientCommerceKey(){
  return (window.crypto&&typeof window.crypto.randomUUID==='function')
    ? window.crypto.randomUUID()
    : 'commerce-'+Date.now()+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);
}

async function loadClientCommerce(){
  if(!state.accountToken||!state.account||state.commerceLoading)return;
  state.commerceLoading=true;state.commerceError='';render();
  try{
    const [catalog,subscriptions]=await Promise.all([API.getClientCommerce(),API.getClientSubscriptions()]);
    state.commerceItems=Array.isArray(catalog.items)?catalog.items:[];
    state.commerceSubscriptions=Array.isArray(subscriptions.subscriptions)?subscriptions.subscriptions:[];
  }catch(error){state.commerceError=error.message||'تعذر تحميل الاشتراكات.';}
  finally{state.commerceLoading=false;render();}
}

async function purchaseClientSubscription(itemId){
  if(state.commerceSubmitting)return;
  const item=(state.commerceItems||[]).find(x=>String(x._id)===String(itemId));
  if(!item)return showToast('الباقة غير متاحة حاليًا.');
  const price=Number(item.price||0);
  if(!Number.isFinite(price)||price<0)return showToast('سعر الباقة غير صحيح.');
  if(!window.confirm('إرسال طلب الاشتراك في '+item.name+' بقيمة '+price+' جنيه؟ لن يتم خصم أي مبلغ الآن. سيتم إشعار الإدارة، والخصم يتم فقط بعد الموافقة والتفعيل.'))return;
  state.commerceSubmitting=String(itemId);state.commerceError='';render();
  try{
    const result=await API.purchaseClientSubscription({itemId:String(itemId),idempotencyKey:clientCommerceKey()});
    state.walletBalance=Number(result.balance??state.walletBalance);
    state.commerceSuccess=result.message||'تم إرسال طلب الاشتراك للمراجعة.';
    await Promise.all([loadClientCommerce(),loadClientWallet()]);
    showToast(result.message||'تم إرسال طلب الاشتراك للمراجعة.','success');
  }catch(error){state.commerceError=error.message||'تعذر شراء الاشتراك.';showToast(state.commerceError);}
  finally{state.commerceSubmitting='';render();}
}

async function renewClientSubscription(subscriptionId){
  if(state.commerceSubmitting)return;
  const sub=(state.commerceSubscriptions||[]).find(x=>String(x._id)===String(subscriptionId));
  if(!sub)return showToast('الاشتراك غير موجود.');
  const amount=Number(sub.amount||0);
  if(Number(state.walletBalance||0)<amount){showToast('رصيد محفظتك غير كافٍ. اشحن المحفظة أولًا.');setTab('wallet');return;}
  if(!window.confirm('تأكيد تجديد '+sub.itemName+' بمبلغ '+amount+' جنيه من محفظتك؟'))return;
  state.commerceSubmitting=String(subscriptionId);state.commerceError='';render();
  try{
    const result=await API.renewClientSubscription(subscriptionId,{idempotencyKey:clientCommerceKey()});
    state.walletBalance=Number(result.balance??state.walletBalance);
    await Promise.all([loadClientCommerce(),loadClientWallet()]);
    showToast(result.message||'تم تجديد الاشتراك.','success');
  }catch(error){state.commerceError=error.message||'تعذر تجديد الاشتراك.';showToast(state.commerceError);}
  finally{state.commerceSubmitting='';render();}
}

function setClientCommerceView(view){
  state.commerceView=view==='available'?'available':'current';
  render();
}

function renderClientSubscriptions(){
  const items=state.commerceItems||[],subs=state.commerceSubscriptions||[];
  const statusLabel={active:'نشط',pending:'قيد المراجعة',paused:'موقوف مؤقتًا',cancelled:'ملغي',expired:'منتهي'};
  const activeView=state.commerceView||'current';
  return \`<section class="mt-4 space-y-4 animate-fade">
    <div class="panel p-4"><div class="flex items-center justify-between gap-3"><div><h3 class="font-extrabold text-[15px]">اشتراكاتي</h3><p class="mt-1 text-[11px] text-slate-500">تابع اشتراكاتك أو استعرض الباقات المتاحة.</p></div><div class="text-left"><span class="text-[10px] text-slate-500">رصيد المحفظة</span><p class="font-black text-[16px]">\${escHtml(Number(state.walletBalance||0).toLocaleString('ar-EG'))} ج</p></div></div>
    <button type="button" onclick="loadClientCommerce()" class="mt-3 w-full h-10 rounded-xl border border-slate-200 bg-slate-50 text-[11px] font-extrabold">تحديث الاشتراكات والباقات</button>
    \${state.commerceLoading?'<p class="py-4 text-center text-[12px] text-slate-500">جاري تحميل البيانات...</p>':''}
    \${state.commerceError?'<p class="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-[11px] font-bold text-red-700">'+escHtml(state.commerceError)+'</p>':''}</div>
    <div class="client-commerce-tabs flex gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2" role="tablist" aria-label="أقسام الاشتراكات">
      <button type="button" role="tab" aria-selected="\${activeView==='current'}" onclick="setClientCommerceView('current')" class="flex-1 rounded-xl px-3 py-3 text-[11px] font-extrabold transition \${activeView==='current'?'tab-active':'tab-idle bg-white border border-slate-200'}">اشتراكاتي الحالية <span class="mr-1 text-[10px] opacity-80">(\${subs.length})</span></button>
      <button type="button" role="tab" aria-selected="\${activeView==='available'}" onclick="setClientCommerceView('available')" class="flex-1 rounded-xl px-3 py-3 text-[11px] font-extrabold transition \${activeView==='available'?'tab-active':'tab-idle bg-white border border-slate-200'}">الاشتراكات المتاحة <span class="mr-1 text-[10px] opacity-80">(\${items.length})</span></button>
    </div>
    \${activeView==='available'?\`<div class="panel p-4"><h3 class="font-extrabold text-[14px]">الاشتراكات المتاحة</h3><div class="mt-3 space-y-3">
    \${items.length?items.map(item=>'<article class="rounded-xl border border-slate-200 p-3"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><h4 class="font-extrabold text-[13px]">'+escHtml(item.name)+'</h4><p class="mt-1 text-[11px] text-slate-500">'+escHtml(item.description||'')+'</p><p class="mt-1 text-[10px] text-slate-500">المدة: '+escHtml(String(item.durationDays||30))+' يوم</p></div><strong class="shrink-0 text-[14px]">'+escHtml(String(item.price))+' ج</strong></div>'+(Array.isArray(item.features)&&item.features.length?'<ul class="mt-2 list-disc pr-5 text-[10px] text-slate-600">'+item.features.map(x=>'<li>'+escHtml(x)+'</li>').join('')+'</ul>':'')+'<button type="button" onclick="purchaseClientSubscription(\\''+escAttr(item._id)+'\\')" '+(state.commerceSubmitting?'disabled':'')+' class="mt-3 w-full h-10 rounded-xl blue-btn text-[11px] font-extrabold">'+(state.commerceSubmitting===String(item._id)?'جاري إرسال الطلب...':'إرسال طلب الاشتراك')+'</button></article>').join(''):'<p class="rounded-xl bg-slate-50 p-4 text-center text-[11px] text-slate-500">لا توجد باقات متاحة حاليًا.</p>'}
    </div></div>\`:\`<div class="panel p-4"><h3 class="font-extrabold text-[14px]">اشتراكاتي الحالية</h3><div class="mt-3 space-y-2">
    \${subs.length?subs.map(sub=>'<article class="rounded-xl border border-slate-200 p-3"><div class="flex items-start justify-between gap-2"><div><b class="text-[12px]">'+escHtml(sub.itemName||'اشتراك')+'</b><p class="mt-1 text-[10px] text-slate-500">'+(sub.startsAt?'من '+escHtml(new Date(sub.startsAt).toLocaleDateString('ar-EG')):'')+(sub.endsAt?' إلى '+escHtml(new Date(sub.endsAt).toLocaleDateString('ar-EG')):'')+'</p></div><span class="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold">'+escHtml(statusLabel[sub.status]||sub.status)+'</span></div><div class="mt-2 flex items-center justify-between text-[11px]"><span>قيمة التجديد</span><b>'+escHtml(String(sub.amount||0))+' جنيه</b></div>'+(['active','expired'].includes(sub.status)?'<button type="button" onclick="renewClientSubscription(\\''+escAttr(sub._id)+'\\')" '+(state.commerceSubmitting?'disabled':'')+' class="mt-3 w-full h-10 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-[11px] font-extrabold">تجديد الاشتراك</button>':'')+'</article>').join(''):'<p class="rounded-xl bg-slate-50 p-4 text-center text-[11px] text-slate-500">لم تشترك في أي باقة حتى الآن.</p>'}
    </div></div>\`}
  </section>\`;
}

async function payForClientOrder(sn){
  if(!state.accountToken)return showToast('سجّل الدخول بحساب العميل للدفع من المحفظة.');
  if(!window.confirm('تأكيد حجز قيمة الخدمة من محفظتك؟ سيتم تحويل المبلغ للفني بعد إتمام المهمة.'))return;
  try{
    const result=await API.payForClientOrder(sn);
    if(state.tracked&&String(state.tracked.sn)===String(sn)){
      state.tracked.clientPaymentStatus=result.paymentStatus||'held';
      state.tracked.clientPaymentAmount=Number(result.amount||state.tracked.acceptedOfferPrice||0);
    }
    if(result.balance!==undefined)state.walletBalance=Number(result.balance);
    await loadClientWallet();
    render();
    showToast(result.message||'تم حجز قيمة الخدمة بنجاح.','success');
  }catch(error){showToast(error.message||'تعذر تنفيذ الدفع.');}
}
