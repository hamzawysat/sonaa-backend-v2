'use strict';

function renderOrders(){
  return `
  <section class="mt-4 space-y-4">
    <div class="rounded-[18px] bg-gradient-to-r from-slate-900 to-slate-800 p-4 text-white flex gap-3"><div class="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">📦</div><div><p class="text-[12px] font-black">إدارة الطلبات والشغلانات</p><p class="text-[10px] text-slate-300 mt-1 font-bold">نشر • تعيين فني • إلغاء • أرشفة</p></div></div>
    <div class="premium-panel p-4 space-y-3">
      <div class="flex gap-2"><input id="delete-client-phone" type="tel" placeholder="01xxxxxxxxx" class="field flex-1" dir="ltr"><button onclick="deleteClient()" class="pill-btn danger-pill">حذف طلبات العميل</button></div>
      <div class="border-t pt-3 flex flex-wrap items-center justify-between gap-3">
        <label class="flex items-center gap-2 text-[11px] font-black"><input type="checkbox" onchange="toggleAllVisibleOrders(this.checked)" ${(state.filteredOrders||[]).length>0&&(state.filteredOrders||[]).every(o=>(state.selectedOrderSNs||[]).includes(String(o.sn||'').toUpperCase()))?'checked':''}> تحديد كل الطلبات المعروضة</label>
        <div class="flex items-center gap-2 flex-wrap"><span class="text-[10px] font-bold text-slate-500">المحدد: ${(state.selectedOrderSNs||[]).length}</span>${canPublishOrders()?'<button onclick="bulkPublishOrders()" class="pill-btn primary-pill">🚀 نشر المحدد</button>':''}<button onclick="bulkDeleteOrders()" ${(state.selectedOrderSNs||[]).length?'':'disabled'} class="pill-btn danger-pill">🗑️ حذف المحدد</button></div>
      </div>
      <p class="text-[10px] text-slate-500">الحذف الجماعي يقبل الطلبات غير المنشورة فقط. الطلبات النشطة أو المرتبطة بعروض أو فنيين أو حركات مالية تُتجاوز تلقائيًا.</p>
    </div>
    ${state.errors.orders?`<div class="bg-red-50 border border-red-200 rounded-[16px] p-4 text-[12px] font-bold text-red-700">${escHtml(state.errors.orders)}</div>`:''}
    ${state.loadingOrders?`<div class="premium-panel p-10 text-center"><div class="h-8 w-8 rounded-full border-[3px] border-slate-200 border-t-blue-600 animate-spin mx-auto"></div></div>`:''}
    ${state.filteredOrders.length===0&&!state.loadingOrders?`<div class="premium-panel p-10 text-center text-[12px] font-bold text-slate-400">لا توجد طلبات</div>`:''}
    ${state.filteredOrders.map(o=>{
      const sn=String(o.sn||''); const menuKey='order:'+sn; const pending=state.pendingActions[menuKey]; const isMenuOpen=!!state.dropdowns[menuKey];
      const offers=Array.isArray(o.offers)?o.offers:[];
      return `
        <article class="premium-card p-4 ${isMenuOpen?'menu-active':''}">
          <div class="flex items-start gap-2 mb-3"><input type="checkbox" aria-label="تحديد الطلب ${escHtml(sn)}" onchange="toggleOrderSelection('${escHtml(sn)}',this.checked)" ${(state.selectedOrderSNs||[]).includes(sn.toUpperCase())?'checked':''} class="mt-1"><span class="text-[10px] text-slate-500 font-bold">تحديد للإجراء الجماعي</span></div>
          <div class="flex justify-between items-start gap-3">
            <div class="min-w-0 flex-1"><p class="font-black text-[14px]">${escHtml(o.service||'طلب')}</p><p class="text-[11px] font-bold text-slate-500 mt-1">كود: <span class="font-mono bg-blue-50 px-2 py-0.5 rounded-full text-blue-800">${escHtml(sn)}</span></p></div>
            <div class="flex items-center gap-2">
              <span class="text-[10px] px-3 py-1.5 rounded-full border font-black ${statusClass(o.status)}">${escHtml(statusLabel(o.status))}</span>
              <div class="action-wrap">
                <button onclick="event.stopPropagation();toggleMenu('${menuKey}')" class="pill-btn soft-btn">إجراء ▾</button>
                ${isMenuOpen?`<div class="dropdown-menu">
                  ${o.status==='قيد المراجعة'&&canPublishOrders()?`<button onclick="event.stopPropagation();setPendingAction('${menuKey}','publish','نشر الطلب')" class="dropdown-item">🚀 نشر للفنيين</button>`:''}
                  ${canAssignOrders()?`<button onclick="event.stopPropagation();setPendingAction('${menuKey}','assign','تعيين فني')" class="dropdown-item">👷 تعيين فني</button>`:''}
                  ${o.status==='قيد المراجعة'&&!offers.length&&!o.assignedFanni?`<button onclick="event.stopPropagation();setPendingAction('${menuKey}','edit','تصحيح البيانات')" class="dropdown-item">✏️ تصحيح</button>`:''}
                  ${o.clientPaymentStatus==='held'?'<button onclick="event.stopPropagation();setPendingAction(\''+menuKey+'\',\'refund\',\'استرداد قيمة الخدمة\')" class="dropdown-item text-red-700">↩️ استرداد المبلغ للعميل</button>':''}
                  <button onclick="event.stopPropagation();setPendingAction('${menuKey}','cancel','إلغاء الطلب')" class="dropdown-item">❌ إلغاء</button>
                  <button onclick="event.stopPropagation();setPendingAction('${menuKey}','archive','أرشفة')" class="dropdown-item">📦 أرشفة</button>
                  <div class="h-px bg-slate-100 my-1"></div>
                  <button onclick="event.stopPropagation();setPendingAction('${menuKey}','delete','حذف نهائي')" class="dropdown-item text-red-600">🗑️ حذف</button>
                </div>`:''}
              </div>
            </div>
          </div>
          ${pending?.action==='edit'?`<div class="mt-4 rounded-[16px] border border-blue-200 bg-blue-50/60 p-3 space-y-3">
            <p class="text-[12px] font-black text-blue-900">تصحيح بيانات الطلب قبل النشر</p>
            <div><label class="block text-[10px] font-bold mb-1">اسم العميل</label><input id="edit-order-name-${escHtml(sn)}" maxlength="50" value="${escHtml(o.clientName||'')}" class="field w-full"></div>
            <div><label class="block text-[10px] font-bold mb-1">رقم تليفون العميل</label><input id="edit-order-phone-${escHtml(sn)}" type="tel" inputmode="tel" maxlength="20" value="${escHtml(o.clientPhone||'')}" class="field w-full" dir="ltr"></div>
            <div><label class="block text-[10px] font-bold mb-1">الخدمة</label><input id="edit-order-service-${escHtml(sn)}" maxlength="100" value="${escHtml(o.service||'')}" class="field w-full"></div>
            <div><label class="block text-[10px] font-bold mb-1">المنطقة / الحي</label><input id="edit-order-area-${escHtml(sn)}" maxlength="250" value="${escHtml(o.area||o.city||'')}" class="field w-full"></div>
            <div><label class="block text-[10px] font-bold mb-1">العنوان التفصيلي</label><input id="edit-order-address-${escHtml(sn)}" maxlength="250" value="${escHtml(o.address||'')}" class="field w-full"></div>
            <div><label class="block text-[10px] font-bold mb-1">وصف الطلب</label><textarea id="edit-order-description-${escHtml(sn)}" maxlength="1000" rows="3" class="field w-full">${escHtml(o.description||'')}</textarea></div>
            <div><label class="block text-[10px] font-bold mb-1">الميزانية</label><input id="edit-order-budget-${escHtml(sn)}" maxlength="50" value="${escHtml(o.budget||'')}" class="field w-full"></div>
            <div class="flex gap-2"><button onclick="saveOrderCorrection('${escHtml(sn)}')" class="pill-btn primary-pill flex-1">حفظ التصحيح</button><button onclick="clearPending('${menuKey}')" class="pill-btn soft-btn">إلغاء</button></div>
            <p class="text-[10px] text-slate-500">لن يتم نشر الطلب تلقائيًا بعد الحفظ؛ راجع البيانات ثم اضغط «نشر للفنيين».</p>
          </div>`:pending?`<div class="confirm-bar"><span>تأكيد ${escHtml(pending.label)}؟</span><div class="flex gap-2"><button onclick="clearPending('${menuKey}')" class="h-7 px-3 rounded-full bg-white/20 text-[10px]">إلغاء</button><button onclick="confirmPending('${menuKey}')" class="h-7 px-4 rounded-full bg-white text-slate-900 text-[10px] font-black">تأكيد</button></div></div>`:''}
          <div class="grid grid-cols-2 gap-2.5 mt-4"><div class="rounded-[14px] bg-slate-50 border p-3"><p class="text-[10px] font-black text-slate-400">العميل</p><p class="text-[11px] font-black mt-1">${escHtml(o.clientName||'غير مسجل')}</p></div><div class="rounded-[14px] bg-slate-50 border p-3"><p class="text-[10px] font-black text-slate-400">الهاتف</p><p class="text-[11px] font-black mt-1" dir="ltr">${escHtml(o.clientPhone||'')}</p></div><div class="rounded-[14px] bg-slate-50 border p-3"><p class="text-[10px] font-black text-slate-400">المنطقة</p><p class="text-[11px] font-black mt-1">${escHtml(o.area||o.city||'')}</p></div><div class="rounded-[14px] bg-blue-50 border border-blue-100 p-3"><p class="text-[10px] font-black text-blue-600">الميزانية</p><p class="text-[11px] font-black mt-1">${escHtml(o.budget?String(o.budget)+' ج':'لم تحدد')}</p></div></div>
          <div class="mt-3 rounded-[14px] bg-slate-50 border p-3"><p class="text-[10px] font-black text-slate-400">وصف الطلب</p><p class="text-[11px] font-bold mt-2 leading-6 whitespace-pre-wrap">${escHtml(o.description||'لا يوجد وصف')}</p></div>
          ${o.hasVoiceRecording&&canReadVoiceReview()?`<div class="mt-3 rounded-[14px] border ${o.voiceReviewedAt?'border-emerald-200 bg-emerald-50':'border-amber-300 bg-amber-50'} p-2 space-y-1.5">
            <div class="flex items-center justify-between gap-2"><p class="text-[12px] font-black">🎙️ التسجيل الصوتي للطلب</p><span class="text-[10px] font-black">${o.voiceReviewedAt?'تمت المراجعة':'مطلوب الاستماع قبل النشر'}</span></div>
            
            ${state.voiceReviewAudioUrls?.[sn]?`<audio controls preload="metadata" playsinline src="${escHtml(state.voiceReviewAudioUrls[sn])}" class="w-full" style="min-height:38px" onended="window.adminVoicePlaybackEnded('${escHtml(sn)}')"></audio>${!o.voiceReviewedAt&&state.voiceReviewAudioPlayed?.[sn]&&canWriteVoiceReview()?`<button onclick="window.adminMarkVoiceReviewed('${escHtml(sn)}')" class="pill-btn primary-pill w-full">✓ تأكيد الاستماع ومراجعة التسجيل</button>`:''}`:`<button onclick="window.adminLoadVoice('${escHtml(sn)}')" class="pill-btn primary-pill w-full">${state.voiceReviewAudioLoading?.[sn]?'جارٍ تحميل التسجيل…':'▶ تحميل التسجيل والاستماع'}</button>`}
            ${o.voiceReviewedAt?`<p class="text-[10px] text-emerald-800 font-bold">تم تأكيد المراجعة ${escHtml(o.voiceReviewedBy||'')} • ${escHtml(new Date(o.voiceReviewedAt).toLocaleString('ar-EG',{timeZone:'Africa/Cairo'}))}</p>`:''}
          </div>`:''}
          <details class="mt-3 rounded-[16px] border overflow-hidden"><summary class="bg-slate-50 px-4 py-3 text-[11px] font-black">عروض الفنيين (${offers.length})</summary><div class="p-3 space-y-2 bg-white"><div class="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-[11px] space-y-1"><p><b>الميزانية الأصلية:</b> ${escHtml(o.budget||'غير محددة')} جنيه</p><p><b>سعر العرض المقبول/التنفيذ:</b> ${o.acceptedOfferPrice!=null?escHtml(String(o.acceptedOfferPrice))+' جنيه':'لم يُقبل عرض بعد'}</p><p><b>الفني المنفذ:</b> ${escHtml(o.assignedFanniName||'لم يُعيّن بعد')}</p><p><b>نسبة العمولة:</b> ${o.commissionRate!=null?escHtml(String(o.commissionRate))+'%':'غير متاحة'}</p><p><b>قيمة العمولة الفعلية:</b> ${o.commissionAmount!=null?escHtml(String(o.commissionAmount))+' جنيه':'غير محسوبة'} ${o.commissionCharged?'(تم تسجيل الخصم)':'(لم يُسجل الخصم)'}</p></div>
${offers.map((off,i)=>`<div class="rounded-[12px] bg-slate-50 border p-3 text-[11px]"><p class="font-black">العرض ${i+1}: ${escHtml(off.fanniName||'فني')} - ${escHtml(off.price||'')} ج</p><p class="text-[10px] mt-1">${escHtml(off.message||'')}</p><div class="mt-2 flex gap-2"><button onclick="removeOffer('${escHtml(sn)}','${i}')" class="pill-btn soft-btn text-[10px]">إزالة العرض</button></div></div>`).join('')||'<p class="text-[10px] text-slate-400">لا توجد عروض</p>'}</div></details>
        </article>`;
    }).join('')}
  </section>`;
}
