'use strict';

function renderWallets(){
  return `
  <section class="mt-4 space-y-4">
    <div class="rounded-[18px] bg-gradient-to-r from-slate-900 to-slate-700 p-4 text-white"><p class="text-[12px] font-black">المحافظ والأرصدة والمعاملات المالية</p><p class="text-[10px] text-slate-300 mt-1">كشف حساب • تجميد • مقارنة الأرصدة</p></div>
    <div class="grid grid-cols-2 gap-3">
      <div class="stat-card"><p class="text-[20px] font-black text-emerald-600">${state.fannis.reduce((s,f)=>s+Number(f.balance||0),0)} ج</p><p class="text-[10px] font-bold text-slate-500">إجمالي أرصدة الفنيين</p></div>
      <div class="stat-card"><p class="text-[20px] font-black text-amber-600">${state.topups.filter(t=>t.status==='pending').length}</p><p class="text-[10px] font-bold text-slate-500">معاملات معلقة</p></div>
    </div>
    <div class="premium-panel p-4">
      <h3 class="text-[11px] font-black mb-3">محفظة فني - كشف مفصل</h3>
      <div class="flex gap-2"><select id="wallet-fanni" class="field flex-1" onchange="state.walletSelectedFanniId=this.value"><option value="">اختر الفني</option>${state.fannis.map(f=>`<option value="${escHtml(f._id)}" ${String(f._id)===state.walletSelectedFanniId?'selected':''}>${escHtml(f.name)} - ${escHtml(f.phone)}</option>`).join('')}</select><button onclick="loadWalletTransactions()" class="pill-btn primary-pill">عرض</button></div>
      <div class="mt-4 space-y-2 text-[11px] font-bold">${state.walletLoading?'<p class="text-center text-slate-400 p-3">جاري تحميل المعاملات...</p>':state.walletTransactions.length?state.walletTransactions.map(t=>`<div class="flex justify-between gap-3 p-3 rounded-[10px] border ${Number(t.amount)<0?'bg-red-50':'bg-emerald-50'}"><div class="min-w-0"><p>${escHtml(({topup:'شحن محفظة',commission:'رسوم فرصة',admin_adjustment:'تسوية إدارية',refund:'استرداد'}[t.type]||t.type||'معاملة'))}${t.orderSN?' • '+escHtml(t.orderSN):''}</p><p class="text-[10px] text-slate-400 mt-1">${escHtml(t.description||'')} · ${escHtml(t.createdAt?new Date(t.createdAt).toLocaleString('ar-EG-u-ca-gregory',{calendar:'gregory',timeZone:'Africa/Cairo'}):'')}</p></div><span class="shrink-0">${Number(t.amount)>0?'+':''}${escHtml(String(t.amount??0))} ج</span></div>`).join(''):'<p class="text-center text-slate-400 p-3">اختر فنيًا واضغط عرض لقراءة سجل المعاملات الحقيقي</p>'}</div>
      <div class="mt-4 flex gap-2"><button onclick="freezeWallet()" class="pill-btn soft-btn flex-1">${state.fannis.find(f=>String(f._id)===state.walletSelectedFanniId)?.isFrozen?'إلغاء تجميد المحفظة':'تجميد مؤقت'}</button><button onclick="adjustWallet()" class="pill-btn danger-pill flex-1">تسوية الرصيد بسبب موثق</button></div>
    </div>
  </section>`;
}

function renderTopups(){
  const owner=state.topupOwnerTab==='clients'?'clients':'fannis';
  const canShowClients=canReadTab('clientWallet');
  const switcher=`
    <div class="premium-panel p-2 grid grid-cols-2 gap-2">
      <button type="button" onclick="setTopupOwnerTab('clients')" class="pill-btn ${owner==='clients'?'primary-pill':'soft-btn'}" ${!canShowClients?'disabled title="لا تملك صلاحية الاطلاع على طلبات شحن العملاء"':''}>طلبات شحن العملاء <span class="mr-1 text-[10px]">${(state.clientTopups||[]).filter(x=>x.status==='قيد المراجعة').length}</span></button>
      <button type="button" onclick="setTopupOwnerTab('fannis')" class="pill-btn ${owner==='fannis'?'primary-pill':'soft-btn'}">طلبات شحن الفنيين <span class="mr-1 text-[10px]">${(state.topups||[]).filter(x=>['pending','قيد المراجعة','جديد','جديدة'].includes(String(x.status||''))).length}</span></button>
    </div>`;
  if(owner==='clients'&&canShowClients){
    return '<section class="mt-4 space-y-4">'+switcher+renderClientWallet()+'</section>';
  }
  return `
  <section class="mt-4 space-y-4">
    ${switcher}
    <div class="premium-panel p-3 space-y-2"><div class="flex items-center justify-between"><label class="text-[11px] font-black"><input type="checkbox" onchange="toggleAllBulkSelection('topups',state.filteredTopups.map(t=>t._id),this.checked)"> تحديد طلبات الشحن الظاهرة</label><span class="text-[10px] text-slate-500">المحدد: ${(state.selectedBulkTopupIds||[]).length}</span></div><div class="flex gap-2"><button onclick="runBulkAction('topups','approve')" class="pill-btn primary-pill">قبول الشحن المحدد</button><button onclick="runBulkAction('topups','reject')" class="pill-btn danger-pill">رفض الشحن المحدد</button></div></div>
    <div class="rounded-[18px] bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white flex gap-3"><div class="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">💳</div><div><p class="text-[12px] font-black">طلبات شحن الفنيين</p><p class="text-[11px] text-blue-100">مراجعة طلبات تحويل الفنيين</p></div></div>
    ${state.errors.topups?`<div class="bg-red-50 border border-red-200 rounded-[16px] p-4 text-[12px] font-bold text-red-700">${escHtml(state.errors.topups)}</div>`:''}
    <div class="space-y-3">
      ${state.filteredTopups.length===0?`<div class="premium-panel p-10 text-center text-[12px] font-bold text-slate-400">لا توجد طلبات شحن مطابقة</div>`:''}
      ${state.filteredTopups.map(t=>{
        const id=String(t._id||''); const menuKey='topup:'+id; const pending=state.pendingActions[menuKey]; const isOpen=!!state.dropdowns[menuKey];
        return `<article class="premium-card p-4 ${isOpen?'menu-active':''}"><label class="text-[10px] font-bold"><input type="checkbox" ${((state.selectedBulkTopupIds||[]).includes(id))?'checked':''} onchange="toggleBulkSelection('topups','${id}',this.checked)"> تحديد</label><div class="flex justify-between"><div><p class="font-black text-[18px]">${escHtml(String(t.amount||''))} <span class="text-[12px] text-slate-500">ج</span></p><p class="text-[11px] font-bold mt-1" dir="ltr">📱 ${escHtml(t.fromPhone||t.phone||'')}</p><p class="text-[10px] text-blue-700 font-bold">${escHtml(({vodafone_cash:'فودافون كاش',orange_cash:'أورنج كاش',etisalat_cash:'اتصالات كاش',we_cash:'WE Pay'})[t.method]||'فودافون كاش')}</p><p class="text-[10px] text-slate-400 mt-1">${escHtml(t.createdAt?new Date(t.createdAt).toLocaleString('ar-EG-u-ca-gregory',{calendar:'gregory',timeZone:'Africa/Cairo'}):'')}</p></div><div class="flex flex-col items-end gap-2"><span class="text-[10px] px-3 py-1.5 rounded-full border font-black ${statusClass(t.status)}">${escHtml(statusLabel(t.status))}</span><div class="action-wrap"><button onclick="event.stopPropagation();toggleMenu('${menuKey}')" class="pill-btn soft-btn">إجراء ▾</button>${isOpen?`<div class="dropdown-menu"><button onclick="event.stopPropagation();setPendingAction('${menuKey}','approve','قبول الشحن')" class="dropdown-item">✓ قبول وإضافة رصيد</button><button onclick="event.stopPropagation();setPendingAction('${menuKey}','reject','رفض الشحن')" class="dropdown-item text-red-600">✕ رفض</button></div>`:''}</div></div></div>${pending?`<div class="confirm-bar"><span>تأكيد ${pending.label}؟</span><div class="flex gap-2"><button onclick="clearPending('${menuKey}')" class="h-7 px-3 rounded-full bg-white/20 text-[10px]">إلغاء</button><button onclick="confirmPending('${menuKey}')" class="h-7 px-4 rounded-full bg-white text-slate-900 text-[10px] font-black">تأكيد</button></div></div>`:''}</article>`;
      }).join('')}
    </div>
  </section>`;
}