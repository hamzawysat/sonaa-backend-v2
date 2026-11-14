'use strict';

async function sendFanniQuickReply(sn,offerId,reply){try{await API.sendChat(sn,reply,offerId);await refreshFanniChatsSilently();toast('تم إرسال الرد.');}catch(e){toast(e.message||'تعذر إرسال الرد.','error');}}
async function sendFanniChat(sn,offerId){const el=document.getElementById('fanni-chat-'+sn);const text=String(el?.value||'').trim();if(!text)return toast('اكتب الرسالة أولًا.','error');try{await API.sendChat(sn,text,offerId);if(el)el.value='';await refreshFanniChatsSilently();toast('تم إرسال الرسالة.');}catch(e){toast(e.message||'تعذر إرسال الرسالة.','error');}}
let fanniChatPollInFlight=false,fanniLiveRenderPending=false;
let isFetching=false;
function renderFanniChatMessages(messages,accepted){return (Array.isArray(messages)?messages:[]).map(function(m){return '<div class="rounded-lg p-2 '+(m.senderRole==='fanni'?'bg-blue-50':'bg-emerald-50')+'"><p class="text-[10px] font-bold">'+(m.senderRole==='fanni'?'أنت':'العميل')+'</p><p class="text-[12px] '+(accepted?'whitespace-pre-wrap break-words':'')+'">'+esc(m.text||'')+'</p></div>';}).join('');}
function liveFanniCanRender(){return !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);}
async function refreshFanniChatsSilently(){
 if(!getToken()||document.hidden||fanniChatPollInFlight||isFetching)return;
 fanniChatPollInFlight=true;
 isFetching=true;
 try{
  const beforeOffers=JSON.stringify((state.myOffers||[]).map(o=>({id:String(o._id||''),accepted:!!o.accepted,status:o.orderStatus||'',completed:!!o.completed,price:o.priceNum??o.price??null})));
  const beforeCompleted=JSON.stringify((state.completedOffers||[]).map(o=>String(o._id||'')));
  const beforeOrders=JSON.stringify((state.orders||[]).map(o=>({sn:String(o.sn||o.orderSn||''),status:o.status||o.orderStatus||'',offersCount:(o.offers||[]).length})));
  const [availableResult,offersResult,notificationsResult]=await Promise.allSettled([API.available(),API.myOffers(),API.notifications()]);
  if(availableResult.status==='fulfilled'){
   const latestOrders=extractList(availableResult.value,['orders','requests','items']);
   const currentPage=Number(state.ordersPagination?.page||1);
   state.orders=currentPage>1?[...latestOrders,...(state.orders||[]).slice(20)]:latestOrders;
   if(availableResult.value.pagination)state.ordersPagination={...availableResult.value.pagination,page:currentPage};
  }
  let newlyAccepted=false;
  if(offersResult.status==='fulfilled'){
   const allOffers=extractList(offersResult.value,['offers','items','requests']);
   const nextActive=allOffers.filter(o=>!(o.completed===true||o.orderStatus==='تم الانتهاء'));
   const nextCompleted=allOffers.filter(o=>o.completed===true||o.orderStatus==='تم الانتهاء');
   const wasAccepted=new Map((state.myOffers||[]).map(o=>[String(o._id||''),o.accepted===true&&o.orderStatus==='تم اختيار فني']));
   newlyAccepted=nextActive.some(o=>o.accepted===true&&o.orderStatus==='تم اختيار فني'&&!wasAccepted.get(String(o._id||'')));
   state.myOffers=nextActive;state.completedOffers=nextCompleted;
  }
  if(notificationsResult.status==='fulfilled'){
   const data=notificationsResult.value;state.notifications=Array.isArray(data.notifications)?data.notifications:[];state.notificationsUnread=Number(data.unreadCount||0);
   const badge=document.getElementById('notificationBadge');if(badge)badge.textContent=state.notificationsUnread?(state.notificationsUnread>99?'99+':String(state.notificationsUnread)):'';
   if(state.notificationsOpen)fanniLiveRenderPending=true;
  }
  applyFilter();
  const afterOffers=JSON.stringify((state.myOffers||[]).map(o=>({id:String(o._id||''),accepted:!!o.accepted,status:o.orderStatus||'',completed:!!o.completed,price:o.priceNum??o.price??null})));
  const afterCompleted=JSON.stringify((state.completedOffers||[]).map(o=>String(o._id||'')));
  const afterOrders=JSON.stringify((state.orders||[]).map(o=>({sn:String(o.sn||o.orderSn||''),status:o.status||o.orderStatus||'',offersCount:(o.offers||[]).length})));
  const listChanged=beforeOffers!==afterOffers||beforeCompleted!==afterCompleted||beforeOrders!==afterOrders;
  if(newlyAccepted||(listChanged&&['available','myOrders'].includes(state.tab)))fanniLiveRenderPending=true;
  if(fanniLiveRenderPending&&liveFanniCanRender()){
   fanniLiveRenderPending=false;const scrollY=window.scrollY||window.pageYOffset||0;render();window.scrollTo({top:scrollY,left:0,behavior:'instant'});
  }
  if(newlyAccepted){const accepted=state.myOffers.find(o=>o.accepted===true&&o.orderStatus==='تم اختيار فني');if(accepted)setTimeout(()=>document.getElementById('fanni-accepted-chat-'+String(accepted.orderSn||accepted.sn||'').toUpperCase())?.scrollIntoView({behavior:'smooth',block:'center'}),80);}}catch(_){/* Preserve the last successful state during temporary network failures. */}
 finally{fanniChatPollInFlight=false;isFetching=false;}
}
let fanniMessagesPollInFlight=false;
async function refreshFanniChatMessagesSilently(){
 if(!getToken()||document.hidden||fanniMessagesPollInFlight||(state.tab!=='myOrders'||state.myOrdersView!=='active'))return;
 fanniMessagesPollInFlight=true;
 try{
  await Promise.allSettled((state.myOffers||[]).map(async function(offer){
   const sn=String(offer.orderSn||offer.sn||offer.order?.sn||'').toUpperCase();
   if(!/^SN\d{6}$/.test(sn))return;
   const offerId=String(offer._id||'');
   const accepted=offer.accepted===true;
   const targetId=accepted?'fanni-accepted-chat-'+sn:'fanni-prechat-chat-'+sn+'-'+offerId;
   if(!document.getElementById(targetId))return;
   const data=await API.chat(sn),messages=Array.isArray(data.messages)?data.messages:[];
   offer.chatMessages=messages;
   const box=document.getElementById(targetId);
   if(box)box.innerHTML=renderFanniChatMessages(messages,accepted);
  }));
 }catch(_){/* Keep the last successful chat visible during temporary network failures. */}
 finally{fanniMessagesPollInFlight=false;}
}
let fanniChatsPollTimer=null;
let fanniMessagesPollTimer=null;
function stopFanniPolling(){
 if(fanniChatsPollTimer){clearInterval(fanniChatsPollTimer);fanniChatsPollTimer=null;}
 if(fanniMessagesPollTimer){clearInterval(fanniMessagesPollTimer);fanniMessagesPollTimer=null;}
}
function startFanniPolling(){
 stopFanniPolling();
 if(document.hidden||!getToken())return;
 fanniChatsPollTimer=setInterval(refreshFanniChatsSilently,25000);
 fanniMessagesPollTimer=setInterval(refreshFanniChatMessagesSilently,10000);
}
document.addEventListener('visibilitychange',function(){
 if(document.hidden)stopFanniPolling();
 else startFanniPolling();
});

document.addEventListener('focusout',function(){
 setTimeout(function(){
  if(!fanniLiveRenderPending||document.hidden||!liveFanniCanRender())return;
  fanniLiveRenderPending=false;
  const scrollY=window.scrollY||window.pageYOffset||0;
  render();
  window.scrollTo({top:scrollY,left:0,behavior:'instant'});
 },0);
});

