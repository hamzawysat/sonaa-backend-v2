'use strict';

function renderOffers(){
  const allOffers = state.orders.flatMap(o=>(o.offers||[]).map((off,idx)=>({orderSn:o.sn,orderService:o.service,order:o,offer:off,idx})));
  const filter=state.offerFilter||'all';
  const visible=allOffers.filter(item=>{
    const accepted=!!item.order.acceptedOfferId&&String(item.order.acceptedOfferId)===String(item.offer._id);
    const expired=!!item.order.expiresAt&&new Date(item.order.expiresAt).getTime()<=Date.now()&&!accepted;
    if(filter==='accepted')return accepted;
    if(filter==='pending')return !accepted&&!expired;
    if(filter==='expired')return expired;
    return true;
  });
  return `
  <section class="mt-4 space-y-4">
    <div class="rounded-[18px] bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white"><p class="text-[12px] font-black">عروض الفنيين على الطلبات</p><p class="text-[10px] text-blue-100 mt-1">تصفية حسب حالة العرض الحقيقية المحسوبة من الطلب.</p></div>
    <div class="premium-panel p-4 space-y-3"><label class="text-[11px] font-black"><input type="checkbox" onchange="toggleAllBulkSelection(\'offers\',visible.filter(item=>!(item.order.acceptedOfferId&&String(item.order.acceptedOfferId)===String(item.offer._id))).map(item=>String(item.orderSn)+'|'+String(item.idx)),this.checked)"> تحديد العروض غير المقبولة الظاهرة</label><button onclick="runBulkAction(\'offers\',\'reject\')" class="pill-btn danger-pill">رفض العروض المحددة</button><div class="flex gap-2"><select id="offer-filter" onchange="state.offerFilter=this.value;render()" class="field flex-1"><option value="all" ${filter==='all'?'selected':''}>كل العروض</option><option value="accepted" ${filter==='accepted'?'selected':''}>العروض المقبولة</option><option value="pending" ${filter==='pending'?'selected':''}>غير المقبولة وغير المنتهية</option><option value="expired" ${filter==='expired'?'selected':''}>منتهية</option></select></div></div>
    ${visible.length===0?`<div class="premium-panel p-10 text-center text-[12px] font-bold text-slate-400">لا توجد عروض مطابقة للتصفية.</div>`:''}
    ${visible.slice(0,200).map(item=>{
      const accepted=!!item.order.acceptedOfferId&&String(item.order.acceptedOfferId)===String(item.offer._id);
      const expired=!!item.order.expiresAt&&new Date(item.order.expiresAt).getTime()<=Date.now()&&!accepted;
      const status=accepted?'مقبول':expired?'منتهي':'قيد الانتظار';
      return `
      <article class="premium-card p-4">
        <label class="text-[10px] font-bold"><input type="checkbox" ${((state.selectedBulkOfferKeys||[]).includes(String(item.orderSn)+'|'+String(item.idx))&&!accepted)?'checked':''} ${accepted?'disabled':''} onchange="toggleBulkSelection('offers','${escHtml(String(item.orderSn)+'|'+String(item.idx))}',this.checked)"> تحديد العرض</label>
        <div class="flex justify-between gap-2"><p class="font-black text-[12px]">طلب ${escHtml(item.orderSn)} - ${escHtml(item.orderService||'')}</p><span class="text-[10px] bg-blue-50 border border-blue-100 px-2 py-1 rounded-full font-black">${status}</span></div>
        <p class="text-[11px] font-bold mt-3">الفني: ${escHtml(item.offer.fanniName||'')} • ${escHtml(item.offer.price||'')} ج</p>
        <p class="text-[10px] text-slate-500 mt-1 leading-5">${escHtml(item.offer.message||'')}</p>
        <div class="mt-3 flex gap-2"><button onclick="rejectOffer('${escHtml(item.orderSn)}','${item.idx}')" class="pill-btn soft-btn flex-1" ${accepted?'disabled':''}>رفض العرض</button><button onclick="removeOffer('${escHtml(item.orderSn)}','${item.idx}')" class="pill-btn danger-pill flex-1" ${accepted?'disabled':''}>إزالة</button></div>
      </article>`;
    }).join('')}
    ${visible.length>200?'<p class="text-center text-[10px] text-slate-500">يُعرض أول 200 عرض مطابق. استخدم التصفية لتضييق النتائج.</p>':''}
  </section>`;
}

async function loadFanniProfileEdits(){try{const data=await tryApi(['/api/admin/fanni-profile-edits'],{method:'GET'});state.pendingProfileEdits=extractList(data,['requests','items']);}catch(e){state.pendingProfileEdits=[];showToast(e.message||'تعذر تحميل طلبات تعديل البيانات','error');}if(state.tab==='profileEdits')render();}

function renderRequestedFanniProfileFields(f,p){
 const changed=new Set(Array.isArray(p.changedFields)?p.changedFields:[]);
 const before=p.before||{phone:f.phone,specialties:f.specialties||[],areas:f.areas||[]};
 const isChanged=key=>changed.size?changed.has(key):(key==='phone'?String(p.phone||'')!==String(before.phone||''):JSON.stringify(p[key]||[])!==JSON.stringify(before[key]||[]));
 const rows=[
  ['phone','رقم الهاتف',escHtml(p.phone||'—')],
  ['specialties','خدمات حمزاوي سات المعتمدة',escHtml((p.activeSpecialties||[]).join('، ')||'لا توجد خدمات معتمدة حاليًا')],
  ['areas','مناطق العمل',escHtml((p.areas||[]).join('، ')||'—')]
 ];
 return rows.map(([key,label,value])=>isChanged(key)
  ? '<div class="rounded-lg border border-amber-300 bg-amber-100 px-2 py-1.5 text-[11px] leading-6"><strong class="text-amber-900">'+label+' — مطلوب تغييره</strong><br><span class="font-black text-amber-950">'+value+'</span></div>'
  : '<div class="text-[11px] leading-6 text-slate-400">'+label+': لم يطلب الفني تغييرها</div>'
 ).join('');
}

function renderFanniProfileEdits(){const rows=state.pendingProfileEdits||[];return `<section class="mt-4 space-y-3"><div class="premium-panel p-4"><h3 class="text-[13px] font-black">طلبات تعديل بيانات الفنيين</h3><p class="text-[11px] text-slate-500 mt-1">لن تتغير بيانات الفني إلا بعد الموافقة. راجع البيانات القديمة والجديدة قبل اتخاذ القرار.</p></div>${rows.length?rows.map(f=>{const p=f.pendingProfileChange||{};const id=escHtml(String(f._id||''));return `<article class="premium-card p-4 space-y-3"><div class="flex items-start justify-between gap-3"><div><h4 class="font-black text-[13px]">${escHtml(f.name||'فني')}</h4><p class="text-[11px] text-slate-500 mt-1">الحالي: ${escHtml(f.phone||'—')} · ${escHtml(f.status||'')}</p><p class="text-[10px] text-slate-400 mt-1">تاريخ الطلب: ${p.requestedAt?escHtml(new Date(p.requestedAt).toLocaleString('ar-EG',{timeZone:'Africa/Cairo'})):'—'}</p></div><span class="text-[10px] rounded-full border border-amber-200 bg-amber-50 text-amber-800 px-3 py-1">بانتظار المراجعة</span></div><div class="grid sm:grid-cols-2 gap-3"><div class="rounded-xl border p-3"><p class="font-black text-[11px] mb-2">البيانات الحالية</p><p class="text-[11px] leading-6">الهاتف: ${escHtml(f.phone||'—')}<br>الخدمات المعتمدة: ${escHtml((f.activeSpecialties||[]).join('، ')||'لا توجد خدمات معتمدة حاليًا')}<br>المناطق: ${escHtml((f.areas||[]).join('، ')||'—')}</p></div><div class="rounded-xl border border-amber-300 bg-amber-50/60 p-3"><p class="font-black text-[11px] mb-2">البيانات المطلوبة</p><div class="space-y-2">${renderRequestedFanniProfileFields(f,p)}</div></div></div><div class="grid grid-cols-2 gap-2"><button class="pill-btn primary-pill" onclick="reviewFanniProfileEdit('${id}','approve')">✓ موافقة واعتماد</button><button class="pill-btn danger-pill" onclick="reviewFanniProfileEdit('${id}','reject')">✕ رفض الطلب</button></div></article>`}).join(''):'<div class="premium-panel p-8 text-center text-[12px] text-slate-500">لا توجد طلبات تعديل بيانات معلّقة حاليًا.</div>'}<button class="pill-btn soft-btn w-full" onclick="loadFanniProfileEdits()">تحديث الطلبات</button></section>`;}

async function reviewFanniProfileEdit(id,action){if(!id||!['approve','reject'].includes(action))return;let reason='';if(action==='reject'){reason=prompt('سبب رفض طلب تعديل البيانات (اختياري):','الرجاء مراجعة البيانات وإعادة الإرسال');if(reason===null)return;}if(!confirm(action==='approve'?'اعتماد البيانات الجديدة لهذا الفني؟ لن يتم تغيير البيانات إلا الآن.':'تأكيد رفض الطلب والإبقاء على البيانات الحالية؟'))return;try{const data=await tryApi([`/api/admin/fanni-profile-edits/${encodeURIComponent(id)}/${action}`],{method:'POST',body:JSON.stringify({reason})});showToast(data.message||'تمت مراجعة الطلب');await Promise.all([loadFanniProfileEdits(),loadAll()]);}catch(e){showToast(e.message||'تعذرت مراجعة الطلب','error');}}
