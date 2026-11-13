'use strict';
function walletMethodLabel(method){return ({vodafone_cash:'فودافون كاش',orange_cash:'أورنج كاش',etisalat_cash:'اتصالات كاش',we_cash:'WE Pay'})[method]||'تحويل محفظة';}
function walletTransactionLabel(type){return ({client_topup:'شحن محفظة',client_admin_adjustment:'إضافة رصيد من الإدارة',client_service_payment:'دفع خدمة',client_subscription_payment:'شراء أو تجديد اشتراك',client_refund:'استرداد مبلغ',client_escrow_hold:'حجز مبلغ لطلب',client_escrow_release:'تحرير مبلغ',technician_settlement:'تسوية مستحقات'})[type]||'حركة مالية';}
async function loadClientWallet(){
 if(!state.accountToken||!state.account||state.walletLoading)return;
 state.walletLoading=true;state.walletError='';render();
 try{
  const [wallet,settings]=await Promise.all([API.getClientWallet(),API.getWalletSettings().catch(()=>({}))]);
  state.walletBalance=Number(wallet.balance??wallet.walletBalance??0);state.walletFrozen=Boolean(wallet.frozen);
  state.walletTransactions=Array.isArray(wallet.transactions)?wallet.transactions:[];
  state.walletTopupRequests=Array.isArray(wallet.topupRequests)?wallet.topupRequests:[];
  state.walletTransferNumbers=[String(settings.walletPhone1||'').trim(),String(settings.walletPhone2||'').trim()].filter(x=>/^01[0-9]{9}$/.test(x));
 }catch(error){state.walletError=error.message||'تعذر تحميل المحفظة.';}
 finally{state.walletLoading=false;render();}
}
async function submitClientWalletTopup(){
 if(state.walletSubmitting)return;
 const phone=String(state.walletFromPhone||'').replace(/\D/g,'');const amount=Number(state.walletAmount);const reference=String(state.walletReference||'').trim().slice(0,50);
 if(!VALIDATORS.phone(phone)){state.walletError='اكتب رقم الهاتف المحوّل منه بشكل صحيح.';render();return;}
 if(!Number.isInteger(amount)||amount<10||amount>10000){state.walletError='مبلغ الشحن يجب أن يكون من 10 إلى 10000 جنيه.';render();return;}
 if(state.walletFrozen){state.walletError='المحفظة مجمدة حاليًا. تواصل مع خدمة العملاء.';render();return;}
 state.walletSubmitting=true;state.walletError='';state.walletSuccess='';render();
 try{
  if(!state.walletIdempotencyKey)state.walletIdempotencyKey=(window.crypto&&typeof window.crypto.randomUUID==='function')?window.crypto.randomUUID():'client-wallet-'+Date.now()+'-'+Math.random().toString(36).slice(2);
  const result=await API.createClientWalletTopup({fromPhone:phone,amount,method:state.walletMethod,reference,idempotencyKey:state.walletIdempotencyKey});
  state.walletIdempotencyKey='';state.walletSuccess=result.message||'تم إرسال طلب الشحن للمراجعة.';state.walletFromPhone='';state.walletAmount='';state.walletReference='';
  await loadClientWallet();showToast(state.walletSuccess,'success');
 }catch(error){state.walletError=error.message||'تعذر إرسال طلب الشحن.';showToast(state.walletError);}
 finally{state.walletSubmitting=false;render();}
}
async function copyClientWalletNumber(number){
 const value=String(number||'');if(!/^01[0-9]{9}$/.test(value))return showToast('رقم التحويل غير صالح.');
 try{await navigator.clipboard.writeText(value);showToast('تم نسخ رقم التحويل.','success');}
 catch(error){showToast('تعذر النسخ تلقائيًا. اضغط مطولًا على الرقم لنسخه.');}
}
function renderClientWallet(){
 const balance=Number(state.walletBalance||0),numbers=state.walletTransferNumbers||[],requests=state.walletTopupRequests||[],transactions=state.walletTransactions||[];
 return `<section class="mt-4 space-y-4 animate-fade">
 <div class="panel overflow-hidden"><div class="bg-gradient-to-l from-[#123c72] to-[#2876c9] p-5 text-white"><div class="flex items-center justify-between gap-3"><div><p class="text-[12px] text-blue-100 font-bold">رصيد محفظتك</p><p class="mt-2 text-[30px] font-black tabular-nums">${escHtml(balance.toLocaleString('ar-EG'))} <span class="text-[15px]">جنيه</span></p></div><span class="text-4xl">💳</span></div><p class="mt-2 text-[10px] text-blue-100">تقدر تدفع قيمة الخدمة من محفظتك بعد تعيين الفني، وتشترك في الباقات وتجددها مباشرة من رصيدك.</p></div><div class="p-4 space-y-3">${state.walletFrozen?'<div class="rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] font-bold text-red-800">المحفظة مجمدة مؤقتًا. لا يمكن إرسال طلب شحن جديد حاليًا.</div>':''}${state.walletLoading?'<p class="py-3 text-center text-[12px] text-slate-500">جاري تحديث بيانات المحفظة...</p>':''}${state.walletError?'<p class="rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] font-bold text-red-700">'+escHtml(state.walletError)+'</p>':''}<button type="button" onclick="loadClientWallet()" class="w-full h-10 rounded-xl border border-blue-200 bg-blue-50 text-blue-800 text-[11px] font-extrabold">تحديث الرصيد والسجل</button></div></div>
 <div class="panel p-4 space-y-3"><div><h3 class="font-extrabold text-[14px]">شحن المحفظة</h3><p class="mt-1 text-[10px] text-slate-500">حوّل المبلغ إلى أحد الأرقام المعتمدة، ثم سجّل بيانات التحويل. الرصيد لا يُضاف إلا بعد مراجعة الإدارة.</p></div><div class="rounded-xl border border-blue-100 bg-blue-50 p-3 space-y-2"><p class="text-[11px] font-extrabold text-blue-900">أرقام التحويل المعتمدة</p>${numbers.length?numbers.map((n,i)=>'<div class="flex items-center justify-between gap-2 rounded-lg bg-white border border-blue-100 p-3"><span class="font-mono font-black text-[16px] text-blue-800" dir="ltr">'+escHtml(n)+'</span><button type="button" onclick="copyClientWalletNumber(\''+escHtml(n)+'\')" class="rounded-lg bg-blue-50 px-3 py-2 text-[10px] font-extrabold text-blue-800">نسخ</button></div>').join(''):'<p class="text-[11px] text-amber-800">أرقام التحويل غير متاحة حاليًا. تواصل مع خدمة العملاء قبل التحويل.</p>'}</div>
 <div><label class="block mb-1 text-[11px] font-extrabold">رقم الهاتف المحوّل منه</label><input class="field h-11" inputmode="numeric" maxlength="11" value="${escHtml(state.walletFromPhone)}" oninput="state.walletFromPhone=this.value.replace(/\\D/g,'').slice(0,11)" placeholder="01xxxxxxxxx"></div>
 <div><label class="block mb-1 text-[11px] font-extrabold">المبلغ بالجنيه</label><input class="field h-11" type="number" min="10" max="10000" step="1" value="${escHtml(state.walletAmount)}" oninput="state.walletAmount=this.value.slice(0,5)" placeholder="100"></div>
 <div><label class="block mb-1 text-[11px] font-extrabold">طريقة التحويل</label><select class="field h-11" onchange="state.walletMethod=this.value"><option value="vodafone_cash" ${state.walletMethod==='vodafone_cash'?'selected':''}>فودافون كاش</option><option value="orange_cash" ${state.walletMethod==='orange_cash'?'selected':''}>أورنج كاش</option><option value="etisalat_cash" ${state.walletMethod==='etisalat_cash'?'selected':''}>اتصالات كاش</option><option value="we_cash" ${state.walletMethod==='we_cash'?'selected':''}>WE Pay</option></select></div>
 <div><label class="block mb-1 text-[11px] font-extrabold">رقم العملية المرجعي (اختياري)</label><input class="field h-11" maxlength="50" value="${escHtml(state.walletReference)}" oninput="state.walletReference=this.value.slice(0,50)" placeholder="رقم العملية إن وجد"></div>
 <button type="button" onclick="submitClientWalletTopup()" ${state.walletSubmitting||state.walletFrozen||!numbers.length?'disabled':''} class="w-full h-12 rounded-xl blue-btn text-[12px] font-extrabold">${state.walletSubmitting?'جاري إرسال الطلب...':'إرسال طلب الشحن'}</button>${state.walletSuccess?'<p class="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] font-bold text-emerald-800">'+escHtml(state.walletSuccess)+'</p>':''}</div>
 <div class="panel p-4"><h3 class="font-extrabold text-[14px]">طلبات الشحن</h3><div class="mt-3 space-y-2">${requests.length?requests.map(x=>'<div class="rounded-xl border border-slate-200 bg-slate-50 p-3"><div class="flex justify-between gap-2"><b class="text-[12px]">'+escHtml(String(x.amount))+' جنيه</b><span class="text-[10px] font-bold '+(x.status==='مقبول'?'text-emerald-700':x.status==='مرفوض'?'text-red-700':'text-amber-700')+'">'+escHtml(x.status||'قيد المراجعة')+'</span></div><p class="mt-1 text-[10px] text-slate-500">'+escHtml(walletMethodLabel(x.method))+' • '+escHtml(x.senderNumber||'')+'</p>'+(x.reviewReason?'<p class="mt-1 text-[10px] text-red-700">'+escHtml(x.reviewReason)+'</p>':'')+'<p class="mt-1 text-[9px] text-slate-400">'+(x.createdAt?escHtml(new Date(x.createdAt).toLocaleString('ar-EG')):'')+'</p></div>').join(''):'<p class="rounded-xl bg-slate-50 p-4 text-center text-[11px] text-slate-500">لا توجد طلبات شحن حتى الآن.</p>'}</div></div>
 <div class="panel p-4"><h3 class="font-extrabold text-[14px]">سجل الحركات المالية</h3><div class="mt-3 space-y-2">${transactions.length?transactions.map(x=>'<div class="rounded-xl border border-slate-200 p-3"><div class="flex items-center justify-between gap-2"><b class="text-[11px]">'+escHtml(walletTransactionLabel(x.type))+'</b><span class="text-[12px] font-black '+(Number(x.amount)>=0?'text-emerald-700':'text-red-700')+'">'+(Number(x.amount)>0?'+':'')+escHtml(String(x.amount))+' ج</span></div><p class="mt-1 text-[10px] text-slate-500">'+escHtml(x.description||'')+'</p><p class="mt-1 text-[9px] text-slate-400">'+(x.createdAt?escHtml(new Date(x.createdAt).toLocaleString('ar-EG')):'')+'</p></div>').join(''):'<p class="rounded-xl bg-slate-50 p-4 text-center text-[11px] text-slate-500">لا توجد حركات مالية مسجلة.</p>'}</div></div>
 </section>`;
}
