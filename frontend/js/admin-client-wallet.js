'use strict';
function applyClientTopupFilter(){
 const rows=Array.isArray(state.clientTopups)?state.clientTopups:[];
 const query=String(state.search||'').trim().toLowerCase(),filter=String(state.clientWalletFilter||'الكل');
 state.filteredClientTopups=rows.filter(item=>{
  if(filter!=='الكل'&&String(item.status||'')!==filter)return false;
  if(!query)return true;
  return [item.clientName,item.clientPhone,item.senderNumber,item.referenceNumber,item.amount].some(value=>String(value||'').toLowerCase().includes(query));
 });
 if(state.tab==='clientWallet')render();
}
async function loadClientTopups(){
 if(!getToken())return;state.clientTopupsLoading=true;render();
 try{const data=await tryApi(['/api/admin/client-wallet/topup-requests'],{method:'GET'});state.clientTopups=extractList(data,['requests','items']);applyClientTopupFilter();}
 catch(error){state.clientTopups=[];state.filteredClientTopups=[];showToast(error.message||'تعذر تحميل محافظ العملاء','error');}
 finally{state.clientTopupsLoading=false;if(state.tab==='clientWallet')render();}
}
async function approveClientTopup(id){
 if(!id||!confirm('تأكيد اعتماد التحويل وإضافة المبلغ إلى محفظة العميل؟'))return;
 try{const data=await tryApi(['/api/admin/client-wallet/topup-requests/'+encodeURIComponent(id)+'/approve'],{method:'POST',body:JSON.stringify({})});showToast(data.message||'تم اعتماد الشحن وإضافة الرصيد','success');await loadClientTopups();}
 catch(error){showToast(error.message||'تعذر اعتماد الشحن','error');}
}
async function rejectClientTopup(id){
 if(!id)return;const reason=prompt('سبب رفض طلب الشحن (اختياري):','تعذر تأكيد التحويل');if(reason===null)return;
 if(!confirm('تأكيد رفض طلب الشحن؟'))return;
 try{const data=await tryApi(['/api/admin/client-wallet/topup-requests/'+encodeURIComponent(id)+'/reject'],{method:'POST',body:JSON.stringify({reason:reason.trim()})});showToast(data.message||'تم رفض طلب الشحن','success');await loadClientTopups();}
 catch(error){showToast(error.message||'تعذر رفض طلب الشحن','error');}
}
async function addClientWalletBalance(id){
 if(!id)return;const raw=prompt('اكتب مبلغ الإضافة بالجنيه (عدد صحيح):','100');if(raw===null)return;
 const amount=Number(raw);if(!Number.isInteger(amount)||amount<=0)return showToast('اكتب مبلغًا صحيحًا أكبر من صفر','error');
 const reason=prompt('سبب الإضافة الإدارية للتوثيق:','تسوية إدارية');if(reason===null)return;if(reason.trim().length<2)return showToast('اكتب سببًا واضحًا','error');
 if(!confirm('تأكيد إضافة '+amount+' جنيه إلى محفظة العميل؟'))return;
 try{const data=await tryApi(['/api/admin/clients/'+encodeURIComponent(id)+'/wallet/add-balance'],{method:'POST',body:JSON.stringify({amount,reason:reason.trim()})});showToast(data.message||'تمت إضافة الرصيد','success');if(state.tab==='clients')await loadClients(state.clientSearch||'');else await loadClientTopups();}
 catch(error){showToast(error.message||'تعذرت إضافة الرصيد','error');}
}

async function deductClientWalletBalance(id){
 if(!id)return;const raw=prompt('اكتب مبلغ الخصم بالجنيه (عدد صحيح):','100');if(raw===null)return;
 const amount=Number(raw);if(!Number.isInteger(amount)||amount<=0)return showToast('اكتب مبلغًا صحيحًا أكبر من صفر','error');
 const reason=prompt('سبب الخصم الإداري للتوثيق:','تسوية إدارية');if(reason===null)return;if(reason.trim().length<2)return showToast('اكتب سببًا واضحًا','error');
 if(!confirm('تأكيد خصم '+amount+' جنيه من محفظة العميل؟ لن يتم الخصم إذا كان الرصيد غير كافٍ.'))return;
 try{const data=await tryApi(['/api/admin/clients/'+encodeURIComponent(id)+'/wallet/deduct-balance'],{method:'POST',body:JSON.stringify({amount,reason:reason.trim()})});showToast(data.message||'تم خصم الرصيد','success');if(state.tab==='clients')await loadClients(state.clientSearch||'');else await loadClientTopups();}
 catch(error){showToast(error.message||'تعذر خصم الرصيد','error');}
}
async function settleClientWalletBalance(id,currentBalance){
 if(!id)return;const raw=prompt('اكتب الرصيد النهائي المطلوب بالجنيه (يمكن أن يكون صفرًا):',String(Number(currentBalance||0)));if(raw===null)return;
 const balance=Number(raw);if(!Number.isInteger(balance)||balance<0||balance>100000000)return showToast('اكتب رصيدًا نهائيًا صحيحًا من صفر إلى 100 مليون','error');
 const reason=prompt('سبب تسوية الرصيد للتوثيق:','تسوية إدارية');if(reason===null)return;if(reason.trim().length<2)return showToast('اكتب سببًا واضحًا','error');
 if(!confirm('تأكيد تسوية رصيد العميل إلى '+balance+' جنيه؟ سيتم تسجيل فرق التسوية في كشف الحساب.'))return;
 try{const data=await tryApi(['/api/admin/clients/'+encodeURIComponent(id)+'/wallet/set-balance'],{method:'POST',body:JSON.stringify({balance,reason:reason.trim()})});showToast(data.message||'تمت التسوية','success');if(state.tab==='clients')await loadClients(state.clientSearch||'');else await loadClientTopups();}
 catch(error){showToast(error.message||'تعذرت تسوية الرصيد','error');}
}
function renderClientWalletLedger(){
 const selected=String(state.clientWalletSelectedId||'');if(!selected)return '';
 const esc=v=>escHtml(String(v??''));
 return '<div class="premium-panel p-4 mt-4"><div class="flex justify-between items-center gap-2"><h3 class="font-black text-[12px]">كشف محفظة العميل</h3><button type="button" onclick="state.clientWalletSelectedId=\'\';state.clientWalletTransactions=[];render()" class="pill-btn soft-btn">إغلاق</button></div>'+(state.clientWalletLoading?'<p class="py-4 text-center text-[11px]">جاري تحميل الحركات...</p>':(state.clientWalletTransactions||[]).length?state.clientWalletTransactions.map(x=>'<div class="border-b py-2 text-[11px]"><div class="flex justify-between gap-2"><b>'+esc(({client_topup:'شحن محفظة',client_admin_adjustment:'إضافة إدارية',client_admin_deduction:'خصم إداري',client_admin_settlement:'تسوية رصيد',client_refund:'استرداد خدمة',client_service_payment:'دفع خدمة',client_subscription_payment:'اشتراك'}[x.type]||x.type))+'</b><strong>'+Number(x.amount||0).toLocaleString('ar-EG')+' ج</strong></div><p class="text-slate-500 mt-1">'+esc(x.description||'')+'</p><p class="text-slate-400 mt-1">الرصيد بعد الحركة: '+Number(x.balanceAfter||0).toLocaleString('ar-EG')+' ج</p></div>').join(''):'<p class="py-4 text-center text-[11px] text-slate-500">لا توجد حركات مالية.</p>')+'</div>';
}
async function loadClientWalletTransactions(id){
 if(!id)return;state.clientWalletSelectedId=String(id);state.clientWalletLoading=true;state.clientWalletTransactions=[];render();
 try{const data=await tryApi(['/api/admin/client-wallet/transactions/'+encodeURIComponent(id)],{method:'GET'});state.clientWalletTransactions=extractList(data,['transactions','data','items']);}
 catch(error){showToast(error.message||'تعذر تحميل كشف المحفظة','error');}
 finally{state.clientWalletLoading=false;if(['clientWallet','clients'].includes(state.tab))render();}
}
function renderClientWallet(){
 const rows=state.filteredClientTopups||[],pending=(state.clientTopups||[]).filter(x=>x.status==='قيد المراجعة').length;
 const accepted=(state.clientTopups||[]).filter(x=>x.status==='مقبول').reduce((sum,x)=>sum+Number(x.amount||0),0);
 const selected=String(state.clientWalletSelectedId||''),esc=v=>escHtml(String(v??''));
 return `<section class="mt-4 space-y-4">
 <div class="grid grid-cols-2 gap-2"><div class="premium-panel p-4"><p class="text-[10px] text-slate-500 font-bold">طلبات تحتاج مراجعة</p><p class="mt-2 text-2xl font-black text-amber-600">${pending}</p></div><div class="premium-panel p-4"><p class="text-[10px] text-slate-500 font-bold">إجمالي الشحن المعتمد</p><p class="mt-2 text-2xl font-black text-emerald-700">${accepted.toLocaleString('ar-EG')} ج</p></div></div>
 <div class="premium-panel p-4 space-y-3"><div class="flex items-center justify-between gap-2"><div><h2 class="font-black text-sm">محافظ العملاء</h2><p class="text-[10px] text-slate-500 mt-1">مراجعة التحويلات وإدارة الأرصدة</p></div><button type="button" onclick="loadClientTopups()" class="pill-btn soft-btn">تحديث</button></div>
 <input class="field" value="${esc(state.search)}" oninput="state.search=this.value;applyClientTopupFilter()" placeholder="بحث بالاسم أو الهاتف أو رقم العملية">
 <select class="field" onchange="state.clientWalletFilter=this.value;applyClientTopupFilter()"><option value="الكل" ${state.clientWalletFilter==='الكل'?'selected':''}>كل الحالات</option><option value="قيد المراجعة" ${state.clientWalletFilter==='قيد المراجعة'?'selected':''}>قيد المراجعة</option><option value="مقبول" ${state.clientWalletFilter==='مقبول'?'selected':''}>مقبول</option><option value="مرفوض" ${state.clientWalletFilter==='مرفوض'?'selected':''}>مرفوض</option></select>
 ${state.clientTopupsLoading?'<p class="py-6 text-center text-[12px] text-slate-500">جاري تحميل الطلبات...</p>':''}
 ${!state.clientTopupsLoading&&!rows.length?'<p class="py-8 text-center text-[12px] text-slate-500">لا توجد طلبات شحن مطابقة.</p>':''}
 <div class="space-y-3">${rows.map(item=>{
  const id=String(item._id||item.id||''),status=String(item.status||'قيد المراجعة');
  const method=({vodafone_cash:'فودافون كاش',orange_cash:'أورنج كاش',etisalat_cash:'اتصالات كاش',we_cash:'WE Pay'})[item.method]||'محفظة إلكترونية',pendingItem=status==='قيد المراجعة';
  return '<article class="premium-card p-4 space-y-3"><div class="flex items-start justify-between gap-2"><div><h3 class="font-black text-[13px]">'+esc(item.clientName||'عميل')+'</h3><p class="mt-1 text-[10px] text-slate-500" dir="ltr">'+esc(item.clientPhone||'')+'</p></div><span class="rounded-full border px-3 py-1 text-[10px] font-black '+(status==='مقبول'?'bg-emerald-50 border-emerald-200 text-emerald-700':status==='مرفوض'?'bg-red-50 border-red-200 text-red-700':'bg-amber-50 border-amber-200 text-amber-800')+'">'+esc(status)+'</span></div><div class="grid grid-cols-2 gap-2"><div class="rounded-xl bg-slate-50 p-3"><p class="text-[9px] text-slate-500">المبلغ</p><p class="mt-1 text-lg font-black">'+Number(item.amount||0).toLocaleString('ar-EG')+' ج</p></div><div class="rounded-xl bg-slate-50 p-3"><p class="text-[9px] text-slate-500">طريقة التحويل</p><p class="mt-1 text-[11px] font-black">'+esc(method)+'</p></div></div><p class="text-[11px]">رقم التحويل: <b dir="ltr">'+esc(item.senderNumber||'—')+'</b></p><p class="text-[10px] text-slate-500">المرجع: '+esc(item.referenceNumber||'غير مرفق')+'</p><p class="text-[9px] text-slate-400">'+(item.createdAt?esc(new Date(item.createdAt).toLocaleString('ar-EG',{timeZone:'Africa/Cairo'})):'')+'</p>'+(item.reviewReason?'<p class="rounded-lg bg-red-50 p-2 text-[10px] text-red-700">'+esc(item.reviewReason)+'</p>':'')+'<div class="grid grid-cols-2 gap-2">'+(pendingItem?'<button type="button" onclick="approveClientTopup(\''+esc(id)+'\')" class="pill-btn primary-pill">اعتماد وإضافة الرصيد</button><button type="button" onclick="rejectClientTopup(\''+esc(id)+'\')" class="pill-btn danger-pill">رفض الطلب</button>':'<button type="button" onclick="addClientWalletBalance(\''+esc(String(item.client||''))+'\')" class="pill-btn soft-btn">إضافة رصيد يدوي</button><button type="button" onclick="loadClientWalletTransactions(\''+esc(String(item.client||''))+'\')" class="pill-btn soft-btn">كشف الحركات</button>')+'</div></article>';
 }).join('')}</div></div>
 ${selected?'<div class="premium-panel p-4"><div class="flex justify-between items-center gap-2"><h3 class="font-black text-[12px]">كشف محفظة العميل</h3><button type="button" onclick="state.clientWalletSelectedId=\'\';state.clientWalletTransactions=[];render()" class="pill-btn soft-btn">إغلاق</button></div>'+(state.clientWalletLoading?'<p class="py-4 text-center text-[11px]">جاري تحميل الحركات...</p>':(state.clientWalletTransactions||[]).length?state.clientWalletTransactions.map(x=>'<div class="border-b py-2 text-[11px]"><div class="flex justify-between gap-2"><b>'+esc(({client_topup:'شحن محفظة',client_admin_adjustment:'إضافة إدارية',client_admin_deduction:'خصم إداري',client_admin_settlement:'تسوية رصيد',client_refund:'استرداد خدمة',client_service_payment:'دفع خدمة',client_subscription_payment:'اشتراك'}[x.type]||x.type))+'</b><strong>'+Number(x.amount||0)+' ج</strong></div><p class="text-slate-500 mt-1">'+esc(x.description||'')+'</p></div>').join(''):'<p class="py-4 text-center text-[11px] text-slate-500">لا توجد حركات مالية.</p>')+'</div>':''}
 </section>`;
}
