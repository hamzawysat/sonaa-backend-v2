'use strict';

let pageVisitsData={summary:[],recent:[],total:0,filter:''};

function renderSettings(){
  const v=state.settings||{siteName:'حمزاوي سات',maintenance:false,maintenanceMessage:'',maxFanniSignupAttempts:5};
  return `
  <section class="mt-4 space-y-4">
    <div class="rounded-[18px] bg-gradient-to-r from-slate-800 to-slate-600 p-4 text-white"><p class="text-[12px] font-black">إعدادات النظام العامة</p><p class="text-[10px] text-slate-300 mt-1">يتم حفظ القيم في قاعدة البيانات؛ بعض الإعدادات تحتاج ربطًا تشغيليًا إضافيًا.</p></div>
    <div class="premium-panel p-4 space-y-4">
      <label class="block"><span class="text-[11px] font-black">اسم المنصة</span><input id="setting-site-name" maxlength="100" value="${escHtml(v.siteName && v.siteName !== 'صُنّاع' ? v.siteName : 'حمزاوي سات')}" class="field mt-2"></label>
      <label class="block"><span class="text-[11px] font-black">رسالة وضع الصيانة</span><textarea id="setting-maintenance-message" rows="2" maxlength="500" class="field mt-2">${escHtml(v.maintenanceMessage||'')}</textarea></label>
      <div class="flex items-center justify-between p-3 rounded-[12px] bg-amber-50 border border-amber-200"><span class="text-[11px] font-black">وضع الصيانة (يوقف طلبات العملاء والفنيين مؤقتًا)</span><label class="relative inline-flex items-center cursor-pointer"><input id="setting-maintenance" type="checkbox" class="sr-only peer" ${v.maintenance?'checked':''}><div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600"></div></label></div>
      <label class="block"><span class="text-[11px] font-black">الحد الأقصى لمحاولات تسجيل الفني من نفس عنوان IP خلال 15 دقيقة</span><input id="setting-signup-attempts" type="number" min="1" max="100" value="${Number(v.maxFanniSignupAttempts||5)}" class="field mt-2"></label>
      <div class="border-t pt-4 space-y-3">
        <p class="text-[12px] font-black">أرقام تحويل محفظة الفني</p>
        <p class="text-[10px] text-slate-500">الأرقام دي هتتربط بواجهة الفني على الموقع والتطبيق في الخطوات التالية. اترك أي خانة فارغة لو الرقم غير متاح.</p>
        <label class="block"><span class="text-[11px] font-black">رقم المحفظة الأول</span><input id="setting-wallet-phone-1" type="tel" inputmode="tel" maxlength="20" value="${escHtml(v.walletPhone1||'')}" placeholder="اكتب رقم المحفظة الأول" class="field mt-2"></label>
        <label class="block"><span class="text-[11px] font-black">رقم المحفظة الثاني</span><input id="setting-wallet-phone-2" type="tel" inputmode="tel" maxlength="20" value="${escHtml(v.walletPhone2||'')}" placeholder="اكتب رقم المحفظة الثاني أو اتركه فارغًا" class="field mt-2"></label>
      </div>
      <button id="save-settings-btn" onclick="saveSettings()" class="w-full h-11 rounded-full bg-slate-900 text-white font-black text-[11px]">حفظ الإعدادات</button>
    </div>
  </section>`;
}



function renderSecurity(){
  return `
  <section class="mt-4 space-y-4">
    <div class="rounded-[18px] bg-gradient-to-r from-red-600 to-orange-600 p-4 text-white"><p class="text-[12px] font-black">الأمان وسجل التدقيق</p><p class="text-[10px] text-red-100 mt-1">سجل حقيقي للأحداث المسجلة من أدوات الإدارة المدعومة، وليس سجلًا كاملًا لكل أحداث النظام حتى الآن.</p></div>
    <div class="premium-panel p-4">
      <div class="flex gap-2"><input id="audit-date" type="date" value="${escHtml(state.auditDate||"")}" oninput="state.auditDate=this.value" class="field flex-1"><button id="audit-filter-btn" onclick="loadAuditLogs()" class="pill-btn soft-btn">تصفية</button></div>
      <div class="mt-4 space-y-2 text-[11px] font-bold">
        ${state.auditLogs?.length?state.auditLogs.map(log=>`<div class="p-3 rounded-[12px] ${log.category==='support'?'bg-amber-50 border border-amber-100':'bg-slate-50 border'}"><p>${escHtml(log.action||'إجراء إداري')} — ${escHtml(log.target||'')}</p><p class="text-[10px] text-slate-500 mt-1">${escHtml(log.adminName||'الإدارة')} • ${escHtml(log.createdAt?new Date(log.createdAt).toLocaleString('ar-EG-u-ca-gregory',{calendar:'gregory',timeZone:'Africa/Cairo'}):'')} • ${escHtml(log.details||'')}</p></div>`).join(''):'<p class="p-4 text-center text-slate-500">لا توجد سجلات مسجلة للفترة المحددة.</p>'}
      </div>
    </div>
  </section>`;
}



function renderReports(){
  return `
  <section class="mt-4 space-y-4">
    <div class="rounded-[18px] bg-gradient-to-r from-indigo-600 to-blue-600 p-4 text-white"><p class="text-[12px] font-black">التقارير والتحليلات</p><p class="text-[10px] text-indigo-100 mt-1">طلبات • فنيون • عملاء • مالي • تصدير</p></div>
    <div class="premium-panel p-4">
      <div class="grid grid-cols-2 gap-2"><label class="text-[10px] font-bold">من تاريخ<input id="report-start-date" type="date" class="field mt-1"></label><label class="text-[10px] font-bold">إلى تاريخ<input id="report-end-date" type="date" class="field mt-1"></label><input id="report-service" maxlength="100" placeholder="اسم الخدمة (اختياري)" class="field"><input id="report-area" maxlength="250" placeholder="المنطقة (اختياري)" class="field"></div>
      <button id="generate-report-btn" onclick="generateReport()" class="mt-3 w-full h-11 rounded-full bg-slate-900 text-white font-black text-[11px]">إنشاء التقرير 📊</button>
      <button onclick="exportReport()" class="mt-2 w-full h-11 rounded-full bg-white border font-black text-[11px]">تصدير التقرير CSV لفتحه في Excel</button>
      <p id="report-status" class="text-[10px] font-bold text-slate-500 mt-2">أنشئ التقرير أولًا لعرض بيانات قاعدة البيانات.</p>
    </div>
    <div id="report-results" class="grid grid-cols-2 gap-3">
      <div class="premium-panel p-4 col-span-2 text-[11px] text-slate-500">لا توجد بيانات تقرير معروضة. اضغط «إنشاء التقرير» لجلب الأرقام الفعلية.</div>
    </div>
  </section>`;
}




async function loadPageVisits(){try{const q=pageVisitsData.filter?'?pageKey='+encodeURIComponent(pageVisitsData.filter):'';const data=await tryApi(['/api/admin/page-visits'+q],{method:'GET'});pageVisitsData={...pageVisitsData,summary:Array.isArray(data.summary)?data.summary:[],recent:Array.isArray(data.recent)?data.recent:[],total:Number(data.total||0)};}catch(e){showToast(e.message||'تعذر تحميل سجل الزيارات','error');}if(state.tab==='pageVisits')render();}


function renderPageVisits(){const pages=pageVisitsData.summary||[],rows=pageVisitsData.recent||[],esc=v=>escHtml(String(v??''));return `<section class="mt-4 space-y-4"><div class="premium-panel p-4"><div class="flex items-center justify-between gap-3"><div><h2 class="font-black text-sm">سجل زيارات الموقع</h2><p class="text-[10px] text-slate-500 mt-1">تسجيل تلقائي من صفحات المشروع</p></div><button onclick="loadPageVisits()" class="rounded-xl px-4 py-2 bg-slate-900 text-white font-black text-[11px]">↻ تحديث</button></div><div class="grid grid-cols-2 gap-3 mt-4"><div class="stat-card"><p class="text-2xl font-black">${Number(pageVisitsData.total||0).toLocaleString('ar-EG')}</p><p class="text-[10px] font-bold text-slate-500">إجمالي الزيارات</p></div><div class="stat-card"><p class="text-2xl font-black">${pages.length.toLocaleString('ar-EG')}</p><p class="text-[10px] font-bold text-slate-500">صفحات مسجلة</p></div></div><label class="block mt-4 text-[11px] font-bold">فلترة حسب الصفحة<select class="field mt-1" onchange="filterPageVisits(this.value)"><option value="">كل الصفحات</option>${pages.map(p=>`<option value="${esc(p.pageKey)}" ${pageVisitsData.filter===p.pageKey?'selected':''}>${esc(p.pageName)}</option>`).join('')}</select></label></div><div class="premium-panel p-4"><h3 class="font-black text-[12px] mb-3">إحصائيات كل صفحة</h3>${pages.length?pages.map(p=>`<div class="flex items-center justify-between gap-3 border-b border-slate-100 py-3"><div><p class="font-black text-[11px]">${esc(p.pageName)}</p><p class="text-[10px] text-slate-500">${esc(p.pageKey)}</p></div><div class="text-left"><p class="font-black text-lg">${Number(p.visits||0).toLocaleString('ar-EG')}</p><p class="text-[9px] text-slate-500">زيارة</p></div></div>`).join(''):'<p class="text-[11px] text-slate-500">لا توجد زيارات مسجلة حتى الآن.</p>'}</div><div class="premium-panel p-4"><h3 class="font-black text-[12px] mb-3">أحدث الزيارات</h3>${rows.length?rows.map(v=>`<div class="border-b border-slate-100 py-3"><div class="flex justify-between gap-3"><p class="font-black text-[11px]">${esc(v.pageName)}</p><p class="text-[10px] text-slate-500 shrink-0">${v.visitedAt?new Date(v.visitedAt).toLocaleString('ar-EG',{timeZone:'Africa/Cairo'}):'—'}</p></div><p class="text-[10px] text-slate-500 mt-1 break-all">${esc(v.path)}</p></div>`).join(''):'<p class="text-[11px] text-slate-500">لا توجد زيارات مسجلة حتى الآن.</p>'}</div></section>`;}


function filterPageVisits(value){pageVisitsData.filter=String(value||'');loadPageVisits();}


function renderPricing(){
  const p=state.pricing||{check:0,commission:10,minOffer:1,maxOffer:1000000};
  const history=Array.isArray(state.pricingHistory)?state.pricingHistory:[];
  return `
  <section class="mt-4 space-y-4">
    <div class="rounded-[18px] bg-gradient-to-r from-emerald-600 to-teal-600 p-4 text-white"><p class="text-[12px] font-black">الأسعار والعمولات ورسوم الفرص</p><p class="text-[10px] text-emerald-100 mt-1">تُطبّق عمولة المنصة وحدود سعر العرض الجديدة على العروض الجديدة فقط.</p></div>
    <div class="premium-panel p-4 space-y-4">
      <label class="block"><span class="text-[11px] font-black">رسوم الفرصة (check) — محفوظة فقط وغير مخصومة تلقائيًا حاليًا</span><input id="price-check" type="number" min="0" max="100000" value="${Number(p.check||0)}" class="field mt-2"></label>
      <label class="block"><span class="text-[11px] font-black">عمولة المنصة %</span><input id="price-commission" type="number" min="0" max="100" step="0.01" value="${Number(p.commission??10)}" class="field mt-2"></label>
      <label class="block"><span class="text-[11px] font-black">الحد الأدنى لسعر العرض</span><input id="price-min" type="number" min="1" max="1000000" value="${Number(p.minOffer||1)}" class="field mt-2"></label>
      <label class="block"><span class="text-[11px] font-black">الحد الأقصى لسعر العرض</span><input id="price-max" type="number" min="1" max="1000000" value="${Number(p.maxOffer||1000000)}" class="field mt-2"></label>
      <p class="text-[10px] text-slate-500">لا يُعاد حساب العمولات المسجلة على الطلبات القديمة.</p>
      <button id="save-pricing-btn" onclick="savePricing()" class="w-full h-11 rounded-full bg-slate-900 text-white font-black text-[11px]">حفظ الأسعار</button>
    </div>
    <div class="premium-panel p-4"><h3 class="text-[11px] font-black mb-3">سجل تغييرات الأسعار</h3>
      ${history.length?history.map(h=>`<div class="border-b last:border-0 py-3 text-[10px]"><p class="font-black">${escHtml(h.by||'الإدارة')} — ${escHtml(h.createdAt?new Date(h.createdAt).toLocaleString('ar-EG-u-ca-gregory',{calendar:'gregory',timeZone:'Africa/Cairo'}):'')}</p><p class="text-slate-500 mt-1">من ${escHtml(JSON.stringify(h.before||{}))} إلى ${escHtml(JSON.stringify(h.after||{}))}</p></div>`).join(''):'<p class="text-[10px] text-slate-500">لا توجد تغييرات مسجلة بعد.</p>'}
    </div>
  </section>`;
}
