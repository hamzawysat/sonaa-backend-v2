'use strict';

async function removeOffer(sn,idx){if(!confirm('هل تريد إزالة هذا العرض؟'))return; try{await tryApi([`/api/admin/offers/${encodeURIComponent(sn)}/${idx}`],{method:'DELETE'}); showToast('تمت إزالة العرض'); await loadOrders();}catch(e){showToast(e.message);}}


async function rejectOffer(sn,idx){if(!confirm('رفض هذا العرض مع سبب؟'))return; try{await tryApi([`/api/admin/offers/${encodeURIComponent(sn)}/${idx}/reject`],{method:'POST',body:JSON.stringify({reason:'غير مناسب'})}); showToast('تم رفض العرض'); await loadOrders();}catch(e){showToast(e.message);}}
