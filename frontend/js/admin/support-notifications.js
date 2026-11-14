'use strict';

function renderNotifications(){
  return `
  <section class="mt-4 space-y-4">
    <div class="rounded-[18px] bg-gradient-to-r from-violet-600 to-purple-600 p-4 text-white"><p class="text-[12px] font-black">الإشعارات والرسائل</p><p class="text-[10px] text-violet-100 mt-1">إرسال فردي أو جماعي حسب نوع الحساب وحالته</p></div>
    <div class="premium-panel p-4 space-y-3">
      <label class="block text-[11px] font-black">طريقة الإرسال<select id="notification-mode" onchange="updateNotificationMode()" class="field mt-2 w-full"><option value="single">إشعار لفرد محدد</option><option value="group">إشعار جماعي لفئة</option></select></label>
      <label class="block text-[11px] font-black">نوع الحساب<select id="notification-recipient-role" onchange="updateNotificationAudience()" class="field mt-2 w-full"><option value="fanni">الفنيون</option><option value="client">العملاء</option></select></label>
      <div id="notification-phone-wrap"><label class="block text-[11px] font-black">رقم هاتف المستلم<input id="notification-recipient-phone" type="tel" inputmode="tel" autocomplete="off" maxlength="20" placeholder="رقم هاتف الفني أو العميل" class="field mt-2 w-full" /></label></div>
      <div id="notification-audience-wrap" class="hidden"><label class="block text-[11px] font-black">الفئة المستهدفة<select id="notification-audience" class="field mt-2 w-full"><option value="all">جميع الفنيين</option><option value="approved">الفنيون المعتمدون</option><option value="disabled">الفنيون المعطلون (معلقون)</option></select></label><p class="mt-1 text-[10px] text-slate-500">الإرسال الجماعي يرسل إشعارًا داخل التطبيق لكل حساب مطابق للاختيار.</p></div>
      <input id="notification-title" maxlength="100" placeholder="عنوان الإشعار..." class="field" />
      <textarea id="notification-message" rows="3" maxlength="300" placeholder="نص الرسالة (حتى 300 حرف)..." class="field"></textarea>
      <button id="send-notification-btn" onclick="sendNotification()" class="pill-btn primary-pill w-full">إرسال الإشعار 🔔</button>
      <div class="rounded-[12px] bg-slate-50 border p-3 text-[10px] font-bold text-slate-500">الإرسال داخل التطبيق فقط، وليس SMS. ستظهر رسالة تأكيد قبل الإرسال الجماعي.</div>
    </div>
    <div class="premium-panel p-4 space-y-3">
      <div class="flex items-center justify-between gap-3"><div><p class="text-[12px] font-black">سجل الإشعارات الإدارية</p><p class="mt-1 text-[10px] text-slate-500">الحذف هنا يزيل الإشعار من جميع الحسابات التي أُرسل إليها.</p></div><button type="button" onclick="loadNotificationHistory()" class="pill-btn soft-btn shrink-0">تحديث</button></div>
      <div id="notification-history-list" class="space-y-2">${renderNotificationHistory()}</div>
    </div>
  </section>`;
}


function updateNotificationMode(){const mode=document.getElementById('notification-mode')?.value||'single';const phoneWrap=document.getElementById('notification-phone-wrap');const audienceWrap=document.getElementById('notification-audience-wrap');if(phoneWrap)phoneWrap.classList.toggle('hidden',mode!=='single');if(audienceWrap)audienceWrap.classList.toggle('hidden',mode!=='group');updateNotificationAudience();}


function updateNotificationAudience(){const role=document.getElementById('notification-recipient-role')?.value||'fanni';const select=document.getElementById('notification-audience');if(!select)return;const current=select.value;const options=role==='fanni'?[['all','جميع الفنيين'],['approved','الفنيون المعتمدون'],['disabled','الفنيون المعطلون (معلقون)']]:[['all','جميع العملاء'],['active','العملاء النشطون'],['disabled','العملاء المعطلون (معلقون)']];select.innerHTML=options.map(([value,label])=>'<option value="'+value+'">'+label+'</option>').join('');if(options.some(option=>option[0]===current))select.value=current;}




function renderNotificationHistory(){
  if(state.notificationHistoryLoading)return '<p class="p-4 text-center text-[11px] text-slate-500">جاري تحميل سجل الإشعارات...</p>';
  if(!state.notificationHistory.length)return '<p class="p-4 text-center text-[11px] text-slate-500">لا توجد إشعارات إدارية محفوظة.</p>';
  return state.notificationHistory.map(item => '<div class="rounded-xl border border-slate-200 p-3 space-y-2"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="text-[11px] font-black break-words">'+escHtml(item.title||'إشعار بدون عنوان')+'</p><p class="mt-1 text-[10px] leading-5 text-slate-600 break-words">'+escHtml(item.message||'')+'</p></div><button type="button" data-id="'+escHtml(item.id)+'" onclick="deleteNotificationCampaign(this.dataset.id)" class="shrink-0 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[10px] font-black text-red-700">حذف</button></div><div class="flex flex-wrap items-center gap-2 text-[9px] text-slate-500"><span class="rounded-full bg-slate-100 px-2 py-1">'+(item.recipientRole==='client'?'العملاء':'الفنيون')+'</span><span class="rounded-full bg-blue-50 px-2 py-1 text-blue-700">عدد المستلمين: '+Number(item.count||0)+'</span><span>'+escHtml(item.createdAt?new Date(item.createdAt).toLocaleString('ar-EG'):'')+'</span></div></div>').join('');
}


async function loadNotificationHistory(){
  const root=document.getElementById('notification-history-list');
  state.notificationHistoryLoading=true;
  if(root)root.innerHTML=renderNotificationHistory();
  try{const data=await tryApi(['/api/admin/notifications/direct'],{method:'GET'});state.notificationHistory=extractList(data,['notifications']);}
  catch(e){state.notificationHistory=[];showToast(e.message||'تعذر تحميل سجل الإشعارات','error');}
  finally{state.notificationHistoryLoading=false;const target=document.getElementById('notification-history-list');if(target)target.innerHTML=renderNotificationHistory();}
}


async function deleteNotificationCampaign(id){
  const item=state.notificationHistory.find(entry=>String(entry.id)===String(id));
  if(!item)return showToast('الإشعار غير موجود في القائمة؛ حدّث السجل','error');
  if(!confirm('تأكيد حذف الإشعار «'+String(item.title||'').slice(0,100)+'» من '+Number(item.count||0)+' حساب؟ لا يمكن التراجع عن الحذف.'))return;
  try{const data=await tryApi(['/api/admin/notifications/direct/'+encodeURIComponent(id)],{method:'DELETE'});showToast((data.message||'تم حذف الإشعار')+' — المحذوف: '+Number(data.deleted||0));await loadNotificationHistory();}
  catch(e){showToast(e.message||'تعذر حذف الإشعار','error');}
}
