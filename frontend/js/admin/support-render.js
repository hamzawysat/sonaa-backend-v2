'use strict';

function renderSupport(){
 const result=state.supportResults||{orders:[],complaints:[]};
 return `
 <section class="mt-4 space-y-4">
 <div class="premium-panel p-4"><h3 class="font-black text-sm">محادثات خدمة العملاء</h3><p class="text-[11px] text-slate-500 mt-1 leading-6">افتح صندوق المحادثات لمتابعة رسائل العملاء والفنيين والرد عليهم وتغيير حالة كل محادثة.</p><div class="mt-3"><a href="support.html?role=admin" class="pill-btn primary-pill w-full inline-flex items-center justify-center no-underline">مركز مساعدة حمزاوي سات 🎧</a></div></div>
 <div class="premium-panel p-4"><div class="flex gap-2"><input id="support-query" value="${escHtml(state.supportQuery||'')}" placeholder="رقم طلب / كود تتبع / هاتف" class="field flex-1"><button onclick="searchSupport()" class="pill-btn primary-pill">بحث</button></div><button onclick="loadSupportViolations()" class="pill-btn soft-btn mt-3 w-full">سجل المخالفات / إجراءات الدعم</button></div>
 ${(result.orders||[]).map(o=>`<article class="premium-card p-3"><p class="font-black">طلب ${escHtml(o.sn)} — ${escHtml(o.clientName||'عميل')} — ${escHtml(o.clientPhone||'')}</p><p class="text-[10px] text-slate-500">${escHtml(o.service||'')} • ${escHtml(o.status||'')}</p><button onclick="markSupportReview('${escHtml(o.sn)}')" class="pill-btn soft-btn mt-2">وضع علامة مراجعة</button></article>`).join('')}
 ${(result.complaints||[]).map(c=>`<article class="premium-card p-3"><p class="font-black">شكوى ${escHtml(c.sn)} — ${escHtml(c.clientName||'')}</p><p class="text-[10px] text-slate-600">${escHtml(c.text||'')}</p><p class="text-[10px]">الحالة: ${escHtml(c.status||'')}</p><button onclick="markSupportReview('${escHtml(c.sn)}')" class="pill-btn soft-btn mt-2">وضع علامة مراجعة</button></article>`).join('')}
 ${state.supportViolations?.length?`<div class="premium-panel p-4"><h3 class="font-black mb-2">سجل إجراءات الدعم</h3>${state.supportViolations.map(v=>`<p class="border-b py-2 text-[10px]">${escHtml(v.action)} — ${escHtml(v.target)} • ${escHtml(v.createdAt?new Date(v.createdAt).toLocaleString('ar-EG-u-ca-gregory',{calendar:'gregory',timeZone:'Africa/Cairo'}):'')}</p>`).join('')}</div>`:''}
 </section>`;
}


function renderContent(){
 const c=state.content||{announcement:'',faqs:[]};
 return `
 <section class="mt-4 space-y-4">
 <div class="premium-panel p-4 space-y-3">
 <label class="block"><span class="text-[11px] font-black">رسالة إعلانية في واجهة العميل</span><textarea id="content-announcement" oninput="state.content.announcement=this.value" maxlength="1000" rows="3" class="field mt-2">${escHtml(c.announcement||'')}</textarea></label><div class="flex gap-2"><button onclick="saveAnnouncement()" class="pill-btn primary-pill flex-1">حفظ الإعلان فقط</button><button onclick="clearAnnouncement()" class="pill-btn soft-btn flex-1">مسح الإعلان</button></div>
 <div class="border-t pt-3"><h3 class="text-[11px] font-black mb-2">الأسئلة الشائعة</h3><input id="faq-question" maxlength="250" placeholder="السؤال الجديد" class="field mb-2"><textarea id="faq-answer" maxlength="1000" rows="2" placeholder="الإجابة" class="field mb-2"></textarea><button onclick="addFaq()" class="pill-btn primary-pill w-full">إضافة سؤال</button></div>
 <div class="space-y-2">${(c.faqs||[]).map((faq,i)=>`<div class="border rounded-xl p-3"><p class="font-black text-[11px]">${escHtml(faq.question)}</p><p class="text-[10px] mt-1">${escHtml(faq.answer)}</p><button onclick="removeFaq(${i})" class="pill-btn soft-btn mt-2">حذف السؤال</button></div>`).join('')||'<p class="text-[10px] text-slate-500">لم تتم إضافة أسئلة بعد.</p>'}</div>
 <p class="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">سيظهر الإعلان والأسئلة النشطة في واجهة العميل بعد الحفظ وتحديث الصفحة.</p>
 <button onclick="previewContent()" class="w-full h-10 rounded-full border bg-white font-black text-[11px]">معاينة قبل النشر</button>
 <button id="save-content-btn" onclick="saveContent()" class="w-full h-11 rounded-full bg-slate-900 text-white font-black text-[11px]">حفظ ونشر المحتوى</button>
 </div></section>`;
}


function renderComplaints(){
  let html='<section class="mt-4 space-y-4"><div class="rounded-[18px] bg-gradient-to-r from-slate-900 to-slate-800 p-4 text-white flex gap-3"><div class="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">⚠️</div><div><p class="text-[12px] font-black">شكاوى العملاء والفنيين والنزاعات</p><p class="text-[10px] text-slate-300">رد رسمي • ملاحظة داخلية • ربط باسترداد</p></div></div>';
  html+='<div class="premium-panel p-3 space-y-2"><label class="text-[11px] font-black"><input type="checkbox" onchange="toggleAllBulkSelection(\'complaints\',state.filteredComplaints.map(c=>c._id||c.id),this.checked)"> تحديد كل الشكاوى الظاهرة</label><div class="flex flex-wrap gap-2"><button onclick="runBulkAction(\'complaints\',\'resolve\')" class="pill-btn primary-pill">حل المحدد</button><button onclick="runBulkAction(\'complaints\',\'reject\')" class="pill-btn danger-pill">رفض المحدد</button><button onclick="runBulkAction(\'complaints\',\'review\')" class="pill-btn soft-btn">قيد المراجعة</button></div></div>';
  if(state.errors.complaints) html+=`<div class="bg-red-50 border border-red-200 rounded-[16px] p-4 text-[12px] font-bold text-red-700">${escHtml(state.errors.complaints)}</div>`;
  if(state.loadingComplaints) html+=`<div class="premium-panel p-10 text-center"><div class="h-8 w-8 rounded-full border-[3px] border-slate-200 border-t-blue-600 animate-spin mx-auto"></div></div>`;
  if(state.filteredComplaints.length===0&&!state.loadingComplaints) html+=`<div class="premium-panel p-10 text-center text-[12px] font-bold text-slate-400">لا توجد شكاوى</div>`;
  state.filteredComplaints.forEach(c=>{
    const id=String(c._id||c.id||''); const sn=String(c.sn||''); const status=String(c.status||'جديدة');
    html+=`<article class="premium-card p-4"><label class="text-[10px] font-bold"><input type="checkbox" ${(state.selectedBulkComplaintIds||[]).includes(id)?'checked':''} onchange="toggleBulkSelection('complaints','${escHtml(id)}',this.checked)"> تحديد الشكوى</label><div class="flex justify-between gap-2"><div class="min-w-0"><p class="font-black text-[13px]">${escHtml(c.clientName||'عميل')}</p><p class="text-[11px] font-bold text-slate-500 mt-1">كود: <span class="bg-blue-50 px-2 py-0.5 rounded-full text-blue-800">${escHtml(sn)}</span> • ${escHtml(new Date(c.createdAt||Date.now()).toLocaleString('ar-EG-u-ca-gregory',{calendar:'gregory',timeZone:'Africa/Cairo'}))}</p></div><span class="text-[10px] px-3 py-1.5 rounded-full border font-black ${status==='تم الحل'?'bg-emerald-50 border-emerald-200 text-emerald-700':status==='مرفوضة'?'bg-red-50 border-red-200 text-red-700':'bg-amber-50 border-amber-200 text-amber-800'}">${escHtml(status)}</span></div><div class="mt-3 rounded-[14px] bg-slate-50 border p-3"><p class="text-[11px] font-bold leading-6 whitespace-pre-wrap">${escHtml(c.text||'')}</p></div><div class="mt-3 space-y-2"><select id="complaint-status-${escHtml(id)}" class="field"><option value="جديدة" ${status==='جديدة'?'selected':''}>جديدة</option><option value="قيد المراجعة" ${status==='قيد المراجعة'?'selected':''}>قيد المراجعة</option><option value="تم الحل" ${status==='تم الحل'?'selected':''}>تم الحل</option><option value="مرفوضة" ${status==='مرفوضة'?'selected':''}>مرفوضة</option></select><textarea id="complaint-note-${escHtml(id)}" rows="2" placeholder="ملاحظة داخلية" class="field">${escHtml(c.adminNote||'')}</textarea><textarea id="complaint-response-${escHtml(id)}" rows="2" placeholder="رد رسمي للعميل" class="field">${escHtml(c.adminResponse||'')}</textarea><button onclick="saveComplaint(\'${escHtml(id)}\')" class="w-full h-11 rounded-full bg-blue-600 text-white font-black text-[11px]">💾 حفظ التحديث</button></div></article>`;
  });
  return html+'</section>';
}
