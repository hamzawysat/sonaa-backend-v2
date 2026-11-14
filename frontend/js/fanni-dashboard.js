'use strict';

let fanniLoadingSafetyTimer=null;
let globalRefreshInProgress=false;
let technicianRefreshInProgress=false;
function showFanniLoading(message){let overlay=document.getElementById('fanniLoadingOverlay');if(!overlay){overlay=document.createElement('div');overlay.id='fanniLoadingOverlay';overlay.className='fanni-loading-overlay';overlay.setAttribute('role','status');overlay.setAttribute('aria-live','polite');overlay.innerHTML='<main class="account-gate min-h-screen px-4 py-8 flex items-center justify-center"><div class="w-full max-w-[440px] text-center"><div class="account-brand mx-auto mb-5 flex items-center justify-center"><img src="/images/LOGO_UPLOAD_HERE/logo.png" alt="صُنّاع" class="sonaa-logo-svg account-loading-logo"></div><h1 class="text-2xl font-black">صُنّاع</h1><p class="account-slogan mt-1 text-base font-extrabold">كل خدمة تبدأ بخطوة</p><div class="mt-7 inline-flex items-center gap-3 rounded-2xl border border-blue-200 bg-white/90 px-5 py-4 font-extrabold text-blue-900 shadow-xl"><span class="inline-block h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></span><span id="fanniLoadingMessage">جاري تحميل البيانات...</span></div></div></main>';document.body.appendChild(overlay);}const label=document.getElementById('fanniLoadingMessage');if(label)label.textContent=message||'جاري تحميل البيانات...';overlay.classList.remove('is-hidden');clearTimeout(fanniLoadingSafetyTimer);fanniLoadingSafetyTimer=setTimeout(hideFanniLoading,9000);}
function hideFanniLoading(){clearTimeout(fanniLoadingSafetyTimer);const overlay=document.getElementById('fanniLoadingOverlay');if(overlay)overlay.classList.add('is-hidden');}
async function refreshTechnicianPage(){
 if(technicianRefreshInProgress)return;
 technicianRefreshInProgress=true;
 showFanniLoading('جاري تحديث بيانات الفني...');
 try{
  const checks=[['الخدمات',loadServices],['مناطق العمل',loadAreas]];
  if(getToken()){
   checks.push(['الملف الشخصي',loadProfile],['الطلبات المتاحة',loadOrders],['العروض والمهام',loadMyOffers],['المحفظة',loadWalletHistory],['إشعارات الحساب',loadNotifications],['أرقام التحويل',loadWalletTransferNumbers]);
  }
  const results=await Promise.all(checks.map(async ([label,loader])=>{
   try{return {label,status:await loader()};}
   catch(error){log('فشل تحديث '+label,error?.message||error);return {label,status:false};}
  }));
  const failed=results.filter(item=>item.status===false).map(item=>item.label);
  const skipped=results.filter(item=>item.status===null).map(item=>item.label);
  if(failed.length)toast('اكتمل التحديث جزئيًا. تعذر تحديث: '+failed.join('، '),'error');
  else if(skipped.length)toast('تم تحديث البيانات المتاحة. تم تجاوز عناصر قيد التحميل: '+skipped.join('، '),'pending');
  else toast('تم تحديث جميع بيانات الفني بنجاح','success');
 }finally{
  hideFanniLoading();
  technicianRefreshInProgress=false;
 }
}
async function start(){
 showFanniLoading('جاري تحميل البيانات...');
 try{
  render();
  await Promise.allSettled([loadServices(),loadAreas()]);
  render();
  if(!getToken())return;
  state.checkingSession=true;
  await loadProfile();
  if(!getToken())return;
  if(state.tab==='login'||state.tab==='register')state.tab='home';
  await Promise.allSettled([loadOrders(),loadMyOffers(),loadWalletHistory(),loadNotifications()]);
 }catch(error){
  console.error('Technician page initialization failed:',error);
  const detail=String(error?.message||'خطأ غير معروف').slice(0,180);
  toast('حصل خطأ أثناء فتح صفحة الفني: '+detail,'error');
 }finally{
  state.checkingSession=false;
  hideFanniLoading();
  try{render();}catch(error){
   console.error('Technician page render failed:',error);
   const detail=String(error?.message||'خطأ غير معروف').slice(0,180);
   toast('تعذر عرض صفحة الفني: '+detail,'error');
  }
 }
}

start();
startFanniPolling();
