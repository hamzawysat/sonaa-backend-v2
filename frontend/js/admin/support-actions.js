'use strict';

async function loadContent(){try{const data=await tryApi(['/api/admin/content'],{method:'GET'});state.content=data.content||{announcement:'',faqs:[]};if(state.tab==='content')render();}catch(e){showToast(e.message||'تعذر تحميل المحتوى','error');}}


function addFaq(){const question=String(document.getElementById('faq-question')?.value||'').trim();const answer=String(document.getElementById('faq-answer')?.value||'').trim();if(question.length<2||question.length>250||answer.length<2||answer.length>1000)return showToast('اكتب سؤالًا وإجابة صالحين','error');state.content=state.content||{announcement:'',faqs:[]};state.content.faqs=Array.isArray(state.content.faqs)?state.content.faqs:[];if(state.content.faqs.length>=100)return showToast('الحد الأقصى 100 سؤال','error');state.content.faqs.push({question,answer,active:true});render();}


async function removeFaq(index){
 if(!state.content||!Array.isArray(state.content.faqs)||index<0||index>=state.content.faqs.length)return;
 const faq=state.content.faqs[index];
 if(!confirm('حذف السؤال «'+String(faq?.question||'').slice(0,120)+'» نهائيًا من واجهة العميل؟'))return;
 const btn=document.getElementById('save-content-btn');
 if(btn)btn.disabled=true;
 try{
  const data=await tryApi(['/api/admin/content/faqs/'+index],{method:'DELETE'});
  state.content=data.content||{announcement:state.content.announcement||'',faqs:state.content.faqs.filter((_,i)=>i!==index)};
  showToast(data.message||'تم حذف السؤال ونشر التغيير لواجهة العميل');
  render();
 }catch(e){
  showToast(e.message||'تعذر حذف السؤال من واجهة العميل؛ لم يتم اعتماد الحذف','error');
  await loadContent();
  render();
 }finally{const currentBtn=document.getElementById('save-content-btn');if(currentBtn)currentBtn.disabled=false;}
}


function previewContent(){const announcement=String(document.getElementById('content-announcement')?.value||state.content?.announcement||'').trim();const faqs=Array.isArray(state.content?.faqs)?state.content.faqs:[];const sample=faqs.slice(0,10).map((f,i)=>(i+1)+'. '+f.question+'\n'+f.answer).join('\n\n');alert('معاينة محتوى صُنّاع\n\nالإعلان:\n'+(announcement||'لا يوجد إعلان')+'\n\nالأسئلة الشائعة ('+faqs.length+'):\n'+(sample||'لا توجد أسئلة'));}


async function saveAnnouncement(){const announcement=String(document.getElementById('content-announcement')?.value??'').trim();try{const data=await tryApi(['/api/admin/content/announcement'],{method:'PATCH',body:JSON.stringify({announcement})});state.content={...(state.content||{faqs:[]}),...(data.content||{}),announcement};showToast(data.message||'تم حفظ الإعلان');render();}catch(e){showToast(e.message||'تعذر حفظ الإعلان','error');}}


async function clearAnnouncement(){const field=document.getElementById('content-announcement');if(field)field.value='';if(state.content)state.content.announcement='';await saveAnnouncement();}


async function saveContent(){const announcement=String(document.getElementById('content-announcement')?.value||'').trim();const faqs=Array.isArray(state.content?.faqs)?state.content.faqs:[];const btn=document.getElementById('save-content-btn');if(btn)btn.disabled=true;try{const data=await tryApi(['/api/admin/content'],{method:'PUT',body:JSON.stringify({announcement,faqs})});state.content=data.content||{announcement,faqs};showToast(data.message||'تم حفظ المحتوى');render();}catch(e){showToast(e.message||'تعذر حفظ المحتوى','error');}finally{if(btn)btn.disabled=false;}}


async function searchSupport(){const q=String(document.getElementById('support-query')?.value||'').trim();if(q.length<2)return showToast('اكتب كود طلب أو رقم هاتف للبحث','error');state.supportQuery=q;try{state.supportResults=await tryApi(['/api/admin/support/search?q='+encodeURIComponent(q)],{method:'GET'});state.supportViolations=[];render();}catch(e){showToast(e.message||'تعذر البحث في الدعم','error');}}


async function markSupportReview(sn){if(!confirm('وضع علامة مراجعة على الطلب أو الشكوى '+sn+'؟'))return;try{const data=await tryApi(['/api/admin/support/'+encodeURIComponent(sn)+'/review'],{method:'POST',body:JSON.stringify({})});showToast(data.message||'تم وضع علامة المراجعة');await Promise.all([searchSupport(),loadSupportViolations()]);}catch(e){showToast(e.message||'تعذر وضع علامة المراجعة','error');}}


async function loadSupportViolations(){try{const data=await tryApi(['/api/admin/support/violations'],{method:'GET'});state.supportViolations=extractList(data,['violations','items']);if(state.tab==='support')render();}catch(e){showToast(e.message||'تعذر تحميل سجل الدعم','error');}}


async function sendNotification(){const title=String(document.getElementById('notification-title')?.value||'').trim();const message=String(document.getElementById('notification-message')?.value||'').trim();const recipientRole=String(document.getElementById('notification-recipient-role')?.value||'');const recipientMode=String(document.getElementById('notification-mode')?.value||'single');const phone=String(document.getElementById('notification-recipient-phone')?.value||'').trim();const audience=String(document.getElementById('notification-audience')?.value||'all');if(title.length<2||title.length>100)return showToast('اكتب عنوانًا من 2 إلى 100 حرف','error');if(message.length<2||message.length>300)return showToast('اكتب نص الرسالة من 2 إلى 300 حرف','error');if(!['fanni','client'].includes(recipientRole))return showToast('اختار نوع الحساب','error');if(recipientMode==='single'&&!phone)return showToast('اكتب رقم هاتف المستلم','error');const labels={all:recipientRole==='fanni'?'جميع الفنيين':'جميع العملاء',approved:'الفنيين المعتمدين',active:'العملاء النشطون',disabled:recipientRole==='fanni'?'الفنيين المعطلين':'العملاء المعطلين'};if(!confirm(recipientMode==='single'?'إرسال الإشعار إلى حساب واحد برقم '+phone+'؟':'إرسال الإشعار جماعيًا إلى '+(labels[audience]||'الفئة المحددة')+'؟'))return;const btn=document.getElementById('send-notification-btn');if(btn)btn.disabled=true;try{const body={title,message,recipientRole,recipientMode};if(recipientMode==='single')body.phone=phone;else body.audience=audience;const data=await tryApi(['/api/admin/notifications/direct'],{method:'POST',body:JSON.stringify(body)});showToast((data.message||'تم إرسال الإشعار')+' — العدد: '+Number(data.sent||0));await loadNotificationHistory();}catch(e){showToast(e.message||'تعذر إرسال الإشعار','error');}finally{if(btn)btn.disabled=false;}}
