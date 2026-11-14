'use strict';

function renderServices(){
  let html='<section class="mt-4 space-y-4"><div class="rounded-[18px] bg-gradient-to-r from-indigo-600 to-blue-600 p-4 text-white"><p class="text-[12px] font-black">إدارة خدمات حمزاوي سات</p><p class="text-[10px] text-blue-100 mt-1">إضافة • تعديل • حذف • ترتيب الأقسام والخدمات • مصدر موحد</p></div>';
  html+='<div class="premium-panel p-4"><div class="flex gap-2"><input id="new-service-name" placeholder="اسم خدمة جديدة" class="field flex-1"><input id="new-service-category" placeholder="القسم (اختياري)" class="field flex-1"><input id="new-service-emoji" placeholder="🔧" class="field !w-[60px]"><button onclick="addService()" class="pill-btn primary-pill">إضافة</button></div></div>';
  if(state.servicesLoading) html+='<div class="premium-panel p-10 text-center"><div class="h-8 w-8 rounded-full border-[3px] border-slate-200 border-t-blue-600 animate-spin mx-auto"></div></div>';
  if(state.filteredServices.length===0&&!state.servicesLoading) html+='<div class="premium-panel p-10 text-center text-[12px] font-bold text-slate-400">لا توجد خدمات</div>';
  state.filteredServices.forEach((cat, idx)=>{
    const label=String(cat.label||cat.name||'قسم'); const emoji=String(cat.emoji||'🔧'); const displayServices=Array.isArray(cat._displayServices)?cat._displayServices:cat.services||[]; const isOpen=state.openServices[idx]!==false;
    const categoryIndex=state.services.findIndex(item=>String(item.label||item.name)===label); const categoryMoveButtons=`<div class="flex gap-1 px-3 py-2 bg-slate-50 border-t"><button onclick="moveCategoryByIndex(${categoryIndex},-1)" ${categoryIndex<=0?'disabled':''} class="h-7 px-3 rounded-full bg-blue-50 border text-[10px] font-black disabled:opacity-30">ترتيب القسم ↑</button><button onclick="moveCategoryByIndex(${categoryIndex},1)" ${categoryIndex<0||categoryIndex>=state.services.length-1?'disabled':''} class="h-7 px-3 rounded-full bg-blue-50 border text-[10px] font-black disabled:opacity-30">ترتيب القسم ↓</button></div>`;
    html+=`<article class="premium-card overflow-hidden"><button onclick="toggleServiceCat(${idx})" class="w-full flex items-center justify-between p-4 bg-white text-right"><div class="flex items-center gap-3"><span class="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center">${escHtml(emoji)}</span><div class="text-right"><p class="font-black text-[13px]">${escHtml(label)}</p><p class="text-[10px] text-slate-500">${displayServices.length} خدمة</p></div></div><span class="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-[12px] ${isOpen?'rotate-180':''}">▼</span></button>${categoryMoveButtons}`;
    if(isOpen){
      html+='<div class="border-t divide-y bg-slate-50/50">';
      displayServices.forEach(srv=>{
        const s=String(srv||'');
        const detail=(Array.isArray(cat._detailed)?cat._detailed:[]).find(item=>String(item.name||'')===s);
        const isActive=detail?detail.isActive!==false:true;
        const serviceKey=String(detail&&detail.dbId?detail.dbId:s);
        const visibilityButton=isActive
          ? `<button onclick="hideService('${escHtml(serviceKey)}','${escHtml(s)}','${escHtml(label)}')" class="h-7 px-3 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-black">إخفاء</button>`
          : `<button onclick="showService('${escHtml(serviceKey)}','${escHtml(s)}','${escHtml(label)}')" class="h-7 px-3 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black">إظهار</button>`;
        const detailIndex=(Array.isArray(cat._detailed)?cat._detailed:[]).findIndex(item=>String(item.name||'')===s);
        const moveButtons=`<button onclick="moveService('${escHtml(label)}','${escHtml(serviceKey)}',-1)" ${detailIndex<=0?'disabled':''} class="h-7 px-2 rounded-full bg-blue-50 border text-[10px] font-black disabled:opacity-30" title="تحريك لأعلى">↑</button><button onclick="moveService('${escHtml(label)}','${escHtml(serviceKey)}',1)" ${detailIndex<0||detailIndex>=cat._detailed.length-1?'disabled':''} class="h-7 px-2 rounded-full bg-blue-50 border text-[10px] font-black disabled:opacity-30" title="تحريك لأسفل">↓</button>`;
        const deleteButton=`<button onclick="deleteService('${escHtml(detail&&detail.dbId?detail.dbId:'')}','${escHtml(s)}','${escHtml(label)}')" class="h-7 px-2 rounded-full bg-red-50 border border-red-200 text-red-700 text-[10px] font-black">حذف</button>`;
        html+=`<div class="p-3.5 flex items-center justify-between gap-2 bg-white"><div class="flex items-center gap-2.5 min-w-0"><span class="h-2 w-2 shrink-0 rounded-full ${isActive?'bg-blue-600':'bg-slate-400'}"></span><span class="text-[12px] font-bold">${escHtml(s)}</span><span class="text-[9px] font-bold ${isActive?'text-emerald-700':'text-slate-500'}">${isActive?'ظاهرة':'مخفية'}</span></div><div class="flex flex-wrap justify-end gap-1 shrink-0">${moveButtons}<button onclick="editService('${escHtml(label)}','${escHtml(serviceKey)}','${escHtml(s)}')" class="h-7 px-2 rounded-full bg-slate-50 border text-[10px] font-black">تعديل</button>${visibilityButton}${deleteButton}</div></div>`;
      });
      html+='</div>';
    }
    html+='</article>';
  });
  return html+'</section>';
}



function renderRegions(){
  const active=state.regions.filter(r=>r.isDeleted!==true&&r.isActive!==false).length,hidden=state.regions.filter(r=>r.isDeleted!==true&&r.isActive===false).length,deleted=state.regions.filter(r=>r.isDeleted===true).length;
  return '<section class="mt-4 space-y-4"><div class="rounded-[18px] bg-gradient-to-r from-teal-600 to-cyan-600 p-4 text-white"><p class="text-[12px] font-black">إدارة مناطق الخدمة</p><p class="text-[10px] text-teal-100 mt-1">تحكم في كل المناطق الأساسية والمضافة: تعديل، إخفاء، إظهار، حذف واستعادة.</p></div>'+
  '<div class="grid grid-cols-3 gap-2"><div class="premium-panel p-3 text-center"><b id="regions-active-count" class="block text-xl text-emerald-700">'+active+'</b><span class="text-[10px]">ظاهرة</span></div><div class="premium-panel p-3 text-center"><b id="regions-hidden-count" class="block text-xl text-amber-700">'+hidden+'</b><span class="text-[10px]">مخفية</span></div><div class="premium-panel p-3 text-center"><b id="regions-deleted-count" class="block text-xl text-red-700">'+deleted+'</b><span class="text-[10px]">محذوفة</span></div></div>'+
  '<div class="premium-panel p-4 space-y-3"><div class="flex gap-2"><input id="new-region" maxlength="100" placeholder="اسم المنطقة الجديدة" class="field flex-1"><button id="add-region-btn" onclick="addRegion()" class="pill-btn primary-pill">إضافة</button></div>'+
  '<input id="region-search" value="'+escHtml(state.regionSearch||'')+'" oninput="filterRegions(this.value)" placeholder="ابحث باسم المنطقة..." class="field w-full">'+
  '<div class="flex flex-wrap items-center justify-between gap-2"><label class="flex items-center gap-2 text-[10px] font-black"><input id="regions-select-all" type="checkbox" onchange="selectAllVisibleRegions(this.checked)"> تحديد كل النتائج الظاهرة</label><span id="regions-selected-count" class="text-[10px] font-bold text-slate-500">المحدد: 0</span></div>'+
  '<div id="regions-bulk-actions" class="hidden flex flex-wrap gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3"><button onclick="bulkEditRegions()" class="pill-btn primary-pill">تعديل المحدد</button><button onclick="bulkToggleRegions(false)" class="pill-btn soft-btn">إخفاء المحدد</button><button onclick="bulkToggleRegions(true)" class="pill-btn soft-btn">إظهار المحدد</button><button onclick="bulkDeleteRegions()" class="pill-btn danger-pill">حذف المحدد</button><button onclick="bulkRestoreRegions()" class="pill-btn soft-btn">استعادة المحدد</button></div>'+
  '<p class="text-[10px] leading-5 text-slate-500">المناطق الأساسية والمضافة تُدار من نفس القائمة. إخفاء المنطقة يمنع ظهورها في الاختيارات الجديدة. الحذف لا يمس الطلبات القديمة ويمكن استعادة المنطقة.</p>'+
  '<div id="regions-list" class="space-y-2">'+(state.regionsLoading?'<p class="text-center p-4 text-[11px] text-slate-500">جاري تحميل المناطق...</p>':renderRegionItems())+'</div></div></section>';
}


function renderRegionItems(){
  if(state.regionsError)return '<p class="p-3 text-[11px] font-bold text-red-600">'+escHtml(state.regionsError)+'</p>';
  const q=String(state.regionSearch||'').trim().toLocaleLowerCase('ar'),rows=state.regions.filter(r=>!q||String(r.name||'').toLocaleLowerCase('ar').includes(q));
  if(!rows.length)return '<p class="p-4 text-center text-[11px] text-slate-500">لا توجد مناطق مطابقة للبحث.</p>';
  return rows.map(r=>{
    const deleted=r.isDeleted===true,active=r.isActive!==false&&!deleted,status=deleted?'محذوفة — غير متاحة':active?'ظاهرة في الاختيارات':'مخفية — لا تظهر في الاختيارات',color=deleted?'text-red-700':active?'text-emerald-700':'text-amber-700';
    const controls='<button onclick="editRegion(\''+escHtml(r._id)+'\')" class="pill-btn soft-btn">تعديل</button>'+(deleted?'<button onclick="restoreRegion(\''+escHtml(r._id)+'\')" class="pill-btn soft-btn">استعادة</button>':'<button onclick="toggleRegion(\''+escHtml(r._id)+'\','+(active?'true':'false')+')" class="pill-btn soft-btn">'+(active?'إخفاء':'إظهار')+'</button><button onclick="deleteRegion(\''+escHtml(r._id)+'\')" class="pill-btn danger-pill">حذف</button>');
    return '<div class="flex flex-wrap justify-between items-center gap-3 p-3 rounded-xl bg-slate-50 border"><label class="flex items-center gap-2"><input type="checkbox" class="region-select" value="'+escHtml(r._id)+'" '+(selectedRegionIds.has(String(r._id))?'checked':'')+' onchange="toggleRegionSelection(this.value,this.checked)"><span class="sr-only">تحديد المنطقة</span></label><div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-2"><span class="text-[11px] font-black">'+escHtml(r.name||'')+'</span><span class="rounded-full bg-slate-200 px-2 py-1 text-[9px] font-bold">'+(r.isBase?'أساسية':'مضافة')+'</span></div><span class="text-[10px] font-bold '+color+'">'+status+'</span></div><div class="flex flex-wrap gap-1">'+controls+'</div></div>';
  }).join('');
}
