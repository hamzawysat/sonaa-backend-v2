'use strict';

async function submitFanniProfileEdit(payload){
 if(state.editSaving)return null;

 state.editSaving=true;
 state.error='';
 state.success='';
 render();
 toast('جاري إرسال طلب تعديل البيانات للإدارة للمراجعة...','pending');

 let outcome='error';
 let feedback='';
 try{
  const result=await API.updateProfile(payload);
  if(!result||typeof result!=='object'||Array.isArray(result)||result.success===false){
   throw new Error(result?.message||'لم يؤكد الخادم استلام طلب التعديل. حاول مرة أخرى.');
  }

  const updated=extractUser(result);
  if(updated&&typeof updated==='object'&&!Array.isArray(updated)){
   currentUser={...(currentUser||{}),...updated};
   setAuth(getToken(),currentUser);
  }

  state.editProfileMode=false;
  state.error='';
  state.success='';
  feedback=result?.message||result?.data?.message||'تم إرسال طلب التعديل للإدارة للمراجعة';
  outcome='success';
  return result;
 }catch(error){
  feedback=error?.message||'تعذر إرسال طلب تعديل البيانات';
  state.error=feedback;
  return null;
 }finally{
  state.editSaving=false;
  render();
  if(outcome==='success')toast(feedback,'success');
  else if(feedback)toast(feedback,'error');
 }
}


function beginEditProfile(){
 const user=currentUser||getUser()||{};
 state.editPhone=String(user.phone||'');
 state.editAreas=Array.isArray(user.areas)?user.areas.filter(area=>String(area||'').trim()!=='جميع المناطق'):[];
 state.editAreaSearch='';
 state.editSpecialties=Array.isArray(user.specialties)?user.specialties.filter(value=>ALL_SERVICES.includes(String(value||'').trim().replace(/\s+/g,' '))):[];
 state.editProfileMode=true;state.openSpecialtyCategory='';state.error='';state.success='';render();
}
function cancelEditProfile(){state.editProfileMode=false;state.editSaving=false;state.error='';state.success='';render();}
function toggleEditSpecialtyCategory(label){state.openSpecialtyCategory=state.openSpecialtyCategory===label?'':label;render();}
function toggleEditSpecialty(specialty){
 if(state.editSpecialties.includes(specialty))state.editSpecialties=state.editSpecialties.filter(item=>item!==specialty);
 else if(state.editSpecialties.length<20)state.editSpecialties=[...state.editSpecialties,specialty];
 else return toast('يمكنك اختيار 20 تخصصًا كحد أقصى','error');
 render();
}
async function saveProfileChanges(){
 if(state.editSaving)return;

 const phone=String(state.editPhone||'').replace(/\D/g,'');
 if(!/^01[0-9]{9}$/.test(phone)){
  state.error='رقم التليفون لازم يكون 11 رقم ويبدأ بـ 01';
  render();
  return;
 }
 if(!Array.isArray(state.editSpecialties)||!state.editSpecialties.length){
  state.error='اختار تخصصًا واحدًا على الأقل';
  render();
  return;
 }

 const areas=[...new Set((state.editAreas||[]).filter(Boolean))];
 if(!areas.length){
  state.error='اختار منطقة عمل واحدة على الأقل من القائمة';
  render();
  return;
 }

 return submitFanniProfileEdit({
  phone,
  specialties:[...state.editSpecialties],
  areas
 });
}

async function loadProfile(){
 if(!getToken())return false;

 try{
  const data=await API.profile();
  const user=extractUser(data)||data?.data||data;

  if(user&&typeof user==='object'&&!Array.isArray(user)){
   currentUser={...(currentUser||{}),...user};
   setAuth(getToken(),currentUser);

   if(state.walletBalance===0){
    state.walletBalance=user.walletBalance??user.balance??user.wallet??0;
   }

   render();
   return true;
  }
  return false;
 }catch(e){
  if(e.status===401){
   clearAuth();
   currentUser=null;
   state.tab='login';
   state.error='انتهت جلسة الدخول. سجل دخولك مرة أخرى.';
   render();
  }else{
   log('profile',e);
  }
  return false;
 }
}
