'use strict';

const selectedRegionIds = new Set();

async function addService(){const name=document.getElementById('new-service-name')?.value; const emoji=document.getElementById('new-service-emoji')?.value||'🔧'; const catInput=document.getElementById('new-service-category')?.value||''; if(!name){showToast('اكتب اسم الخدمة','error');return;} try{await tryApi(['/api/admin/services'],{method:'POST',body:JSON.stringify({name,emoji,category:catInput||undefined})}); showToast('تمت إضافة الخدمة'); await loadServices();}catch(e){showToast(e.message);}}


async function editService(cat,serviceKey,currentName){const oldName=currentName||serviceKey;const newName=prompt('تعديل اسم الخدمة:',oldName);if(newName===null||!newName.trim())return;try{await tryApi([`/api/admin/services/${encodeURIComponent(serviceKey)}?category=${encodeURIComponent(cat)}`],{method:'PATCH',body:JSON.stringify({name:newName.trim(),category:cat})});showToast('تم التعديل');await loadServices();}catch(e){showToast(e.message||'تعذر تعديل الخدمة','error');}}


async function moveCategoryByIndex(categoryIndex,direction){try{const items=state.services.slice();const index=Number(categoryIndex);const next=index+Number(direction);if(!Number.isInteger(index)||index<0||next<0||next>=items.length)return;[items[index],items[next]]=[items[next],items[index]];await tryApi(['/api/admin/services/categories/order'],{method:'PATCH',body:JSON.stringify({categories:items.map(item=>String(item.label||item.name))})});showToast('تم حفظ ترتيب الأقسام الأساسية');await loadServices();}catch(e){showToast(e.message||'تعذر حفظ ترتيب الأقسام','error');}}


async function moveService(categoryLabel,serviceKey,direction){try{const category=state.services.find(c=>String(c.label||c.name)===categoryLabel);const items=Array.isArray(category?._detailed)?category._detailed.slice():[];const index=items.findIndex(item=>String(item.dbId||item.name)===String(serviceKey));const next=index+Number(direction);if(index<0||next<0||next>=items.length)return;[items[index],items[next]]=[items[next],items[index]];const payload=items.map((item,i)=>({name:item.name,sortOrder:(i+1)*10,emoji:item.emoji||category.emoji||'🔧',isActive:item.isActive!==false}));await tryApi(['/api/admin/services/order'],{method:'PATCH',body:JSON.stringify({category:categoryLabel,items:payload})});showToast('تم حفظ ترتيب الخدمات');await loadServices();}catch(e){showToast(e.message||'تعذر حفظ الترتيب','error');}}


async function deleteService(id,name,category){if(!confirm('حذف الخدمة "'+name+'" من قائمة الخدمات في قسم "'+category+'"؟ ستظل الطلبات القديمة محفوظة.'))return;try{const key=id||name;const result=await tryApi([`/api/admin/services/${encodeURIComponent(key)}?category=${encodeURIComponent(category)}`],{method:'DELETE'});showToast(result.message||'تمت معالجة حذف الخدمة',result.deleted===false?'warning':'success');await loadServices();}catch(e){showToast(e.message||'تعذر حذف الخدمة','error');}}


async function hideService(serviceKey,serviceName,category){if(!serviceKey||!serviceName||!category)return showToast('بيانات الخدمة أو القسم غير مكتملة','error');if(!confirm('إخفاء الخدمة '+serviceName+'؟'))return;try{await tryApi([`/api/admin/services/${encodeURIComponent(serviceKey)}/hide?category=${encodeURIComponent(category)}`],{method:'POST',body:JSON.stringify({category})});showToast('تم الإخفاء');await loadServices();}catch(e){showToast(e.message||'تعذر إخفاء الخدمة','error');}}


async function showService(serviceKey,serviceName,category){if(!serviceKey||!serviceName||!category)return showToast('بيانات الخدمة أو القسم غير مكتملة','error');if(!confirm('إظهار الخدمة '+serviceName+' في قسم '+category+'؟'))return;try{await tryApi([`/api/admin/services/${encodeURIComponent(serviceKey)}/show?category=${encodeURIComponent(category)}`],{method:'POST',body:JSON.stringify({category})});showToast('تم إظهار الخدمة مرة أخرى');await loadServices();}catch(e){showToast(e.message||'تعذر إظهار الخدمة','error');}}

async function loadRegions(){if(!getToken())return;state.regionsLoading=true;state.regionsError='';const root=document.getElementById('regions-list');if(root)root.innerHTML='<p class="p-4 text-center text-[11px] text-slate-500">جاري تحميل المناطق...</p>';try{const data=await tryApi(['/api/admin/regions'],{method:'GET'});state.regions=extractList(data,['regions','items']).map(r=>({...r,isDeleted:r.isDeleted===true,isActive:r.isActive!==false}));clearRegionSelection();}catch(e){state.regions=[];state.regionsError=e.message||'تعذر تحميل المناطق';}finally{state.regionsLoading=false;const target=document.getElementById('regions-list');if(target)target.innerHTML=renderRegionItems();updateRegionCounters();syncRegionSelectionUI();}}


function filterRegions(value){state.regionSearch=String(value||'');const target=document.getElementById('regions-list');if(target)target.innerHTML=renderRegionItems();syncRegionSelectionUI();}


async function addRegion(){const input=document.getElementById('new-region'),name=String(input?.value||'').trim().replace(/\s+/g,' ');if(name.length<2||name.length>100)return showToast('اسم المنطقة لازم يكون من حرفين إلى 100 حرف','error');const btn=document.getElementById('add-region-btn');if(btn)btn.disabled=true;try{const data=await tryApi(['/api/admin/regions'],{method:'POST',body:JSON.stringify({name})});showToast(data.message||'تمت إضافة المنطقة');if(input)input.value='';await loadRegions();}catch(e){showToast(e.message||'تعذرت إضافة المنطقة','error');}finally{if(btn)btn.disabled=false;}}


async function editRegion(id){const region=state.regions.find(item=>String(item._id)===String(id));if(!region)return showToast('المنطقة غير موجودة في القائمة الحالية','error');const name=prompt('تعديل اسم المنطقة:',String(region.name||''));if(name===null)return;const clean=name.trim().replace(/\s+/g,' ');if(clean.length<2||clean.length>100)return showToast('اسم المنطقة لازم يكون من حرفين إلى 100 حرف','error');try{const data=await tryApi(['/api/admin/regions/'+encodeURIComponent(id)],{method:'PATCH',body:JSON.stringify({name:clean})});showToast(data.message||'تم تعديل المنطقة');await loadRegions();}catch(e){showToast(e.message||'تعذر تعديل المنطقة','error');}}


async function toggleRegion(id,current){try{const data=await tryApi(['/api/admin/regions/'+encodeURIComponent(id)],{method:'PATCH',body:JSON.stringify({isActive:!current})});showToast(data.message||'تم تحديث حالة المنطقة');await loadRegions();}catch(e){showToast(e.message||'تعذر تحديث حالة المنطقة','error');}}


async function deleteRegion(id){const region=state.regions.find(item=>String(item._id)===String(id));if(!region)return showToast('المنطقة غير موجودة في القائمة الحالية','error');if(!confirm('حذف منطقة «'+String(region.name||'')+'» من الاختيارات الجديدة؟ سيظل سجل الطلبات القديمة محفوظًا ويمكن استعادة المنطقة لاحقًا.'))return;try{const data=await tryApi(['/api/admin/regions/'+encodeURIComponent(id)],{method:'DELETE'});showToast(data.message||'تم حذف المنطقة');await loadRegions();}catch(e){showToast(e.message||'تعذر حذف المنطقة','error');}}


async function restoreRegion(id){try{const data=await tryApi(['/api/admin/regions/'+encodeURIComponent(id)],{method:'PATCH',body:JSON.stringify({isDeleted:false})});showToast(data.message||'تمت استعادة المنطقة');await loadRegions();}catch(e){showToast(e.message||'تعذرت استعادة المنطقة','error');}}


function updateRegionCounters(){
  const active=state.regions.filter(r=>r.isDeleted!==true&&r.isActive!==false).length;
  const hidden=state.regions.filter(r=>r.isDeleted!==true&&r.isActive===false).length;
  const deleted=state.regions.filter(r=>r.isDeleted===true).length;
  const a=document.getElementById('regions-active-count'),h=document.getElementById('regions-hidden-count'),d=document.getElementById('regions-deleted-count');
  if(a)a.textContent=String(active);if(h)h.textContent=String(hidden);if(d)d.textContent=String(deleted);
}


function syncRegionSelectionUI(){
  const visible=[...document.querySelectorAll('.region-select')];
  const count=selectedRegionIds.size, label=document.getElementById('regions-selected-count'),bar=document.getElementById('regions-bulk-actions'),all=document.getElementById('regions-select-all');
  if(label)label.textContent='المحدد: '+count;if(bar)bar.classList.toggle('hidden',count===0);
  if(all){all.checked=visible.length>0&&visible.every(x=>x.checked);all.indeterminate=visible.some(x=>x.checked)&&!all.checked;}
}


function toggleRegionSelection(id,checked){if(checked)selectedRegionIds.add(String(id));else selectedRegionIds.delete(String(id));syncRegionSelectionUI();}


function selectAllVisibleRegions(checked){document.querySelectorAll('.region-select').forEach(input=>{input.checked=!!checked;if(checked)selectedRegionIds.add(String(input.value));else selectedRegionIds.delete(String(input.value));});syncRegionSelectionUI();}


function clearRegionSelection(){selectedRegionIds.clear();}


async function runBulkRegionUpdates(ids,operation,successLabel){
  let succeeded=0,failed=0;
  for(const id of ids){try{await operation(id);succeeded++;}catch(error){failed++;}}
  clearRegionSelection();await loadRegions();
  showToast(successLabel+' — نجح: '+succeeded+'، تعذر: '+failed,failed?'warning':'success');
}


async function bulkEditRegions(){
  const ids=[...selectedRegionIds];if(!ids.length)return;
  const changes=[];
  for(const id of ids){const region=state.regions.find(item=>String(item._id)===id);if(!region)continue;
    const value=prompt('اكتب الاسم الجديد للمنطقة: '+region.name,String(region.name||''));if(value===null)return;
    const name=value.trim().replace(/\s+/g,' ');if(name.length<2||name.length>100)return showToast('اسم غير صالح: '+region.name,'error');
    changes.push({id,name});
  }
  if(!changes.length||!confirm('تأكيد حفظ تعديلات '+changes.length+' منطقة؟'))return;
  await runBulkRegionUpdates(changes.map(x=>x.id),id=>{const item=changes.find(x=>x.id===id);return tryApi(['/api/admin/regions/'+encodeURIComponent(id)],{method:'PATCH',body:JSON.stringify({name:item.name})});},'انتهى التعديل الجماعي');
}


async function bulkToggleRegions(active){
  const ids=[...selectedRegionIds].filter(id=>{const r=state.regions.find(x=>String(x._id)===id);return r&&r.isDeleted!==true&&((r.isActive!==false)!==active);});
  if(!ids.length)return showToast('لا توجد مناطق محددة تحتاج إلى هذا التغيير');
  if(!confirm((active?'إظهار':'إخفاء')+' '+ids.length+' منطقة؟'))return;
  await runBulkRegionUpdates(ids,id=>tryApi(['/api/admin/regions/'+encodeURIComponent(id)],{method:'PATCH',body:JSON.stringify({isActive:active})}),active?'تم إظهار المناطق المحددة':'تم إخفاء المناطق المحددة');
}


async function bulkDeleteRegions(){
  const ids=[...selectedRegionIds].filter(id=>{const r=state.regions.find(x=>String(x._id)===id);return r&&r.isDeleted!==true;});
  if(!ids.length)return showToast('لا توجد مناطق قابلة للحذف ضمن التحديد');
  if(!confirm('حذف '+ids.length+' منطقة من الاختيارات الجديدة؟ يمكن استعادتها لاحقًا.'))return;
  await runBulkRegionUpdates(ids,id=>tryApi(['/api/admin/regions/'+encodeURIComponent(id)],{method:'DELETE'}),'تم تنفيذ الحذف الجماعي');
}


async function bulkRestoreRegions(){
  const ids=[...selectedRegionIds].filter(id=>{const r=state.regions.find(x=>String(x._id)===id);return r&&r.isDeleted===true;});
  if(!ids.length)return showToast('لا توجد مناطق محذوفة ضمن التحديد');
  if(!confirm('استعادة '+ids.length+' منطقة؟'))return;
  await runBulkRegionUpdates(ids,id=>tryApi(['/api/admin/regions/'+encodeURIComponent(id)],{method:'PATCH',body:JSON.stringify({isDeleted:false})}),'تم تنفيذ الاستعادة الجماعية');
}
