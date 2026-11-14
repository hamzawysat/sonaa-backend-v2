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
