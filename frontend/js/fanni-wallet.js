'use strict';

async function copyWalletNumber(index){
 const walletNumber=String(document.getElementById('wallet-transfer-number-'+index)?.textContent||'').trim();
 if(!/^01[0-9]{9}$/.test(walletNumber))return toast('رقم المحفظة غير متاح حاليًا.','error');
 try{
  if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(walletNumber);}
  else{
   const input=document.createElement('textarea');input.value=walletNumber;input.readOnly=true;input.style.position='fixed';input.style.left='-9999px';input.style.top='0';input.setAttribute('aria-hidden','true');document.body.appendChild(input);
   input.focus();input.select();input.setSelectionRange(0,input.value.length);
   let copied=false;try{copied=document.execCommand('copy');}finally{input.remove();}
   if(!copied)throw new Error('تعذر نسخ الرقم تلقائيًا');
  }
  toast('تم نسخ رقم المحفظة');
 }catch(error){toast('تعذر النسخ تلقائيًا. اضغط مطولًا على الرقم لنسخه.','error');}
}
async function loadWalletTransferNumbers(){
 let loaded=false;
 try{const data=await apiGet('/api/wallet-settings');state.walletPhone1=String(data.walletPhone1||'').trim();state.walletPhone2=String(data.walletPhone2||'').trim();loaded=true;}
 catch(error){log('تعذر تحميل أرقام التحويل',error.message);state.walletPhone1='';state.walletPhone2='';}
 if(state.tab==='wallet')render();
 return loaded;
}

function loadWalletHistory(){
 if(!getToken())return false;

 try{
  const data=await API.walletHistory();

  state.walletHistory=extractList(data,['history','requests','items']);
  state.walletTransactions=Array.isArray(data.transactions)?data.transactions:[];

  state.walletBalance=data.balance
   ??data.walletBalance
   ??data.wallet?.balance
   ??currentUser?.walletBalance
   ??currentUser?.balance
   ??0;

  if(currentUser){
   currentUser.walletBalance=state.walletBalance;
   setAuth(getToken(),currentUser);
  }

  render();
  return true;
 }catch(e){
  log('wallet history',e);

  if(e.status===401){
   toast('انتهت جلسة الدخول. سجل دخولك مرة أخرى.','error');
  }
  return false;
 }
}

async function submitWallet(){
 if(state.walletLoading)return;

 if(!isApproved()){toast('شحن المحفظة متاح بعد اعتماد حسابك','error');return}
 if(!V.phone(state.walletFromPhone)){toast('رقم الهاتف المحول منه غير صحيح','error');return}
 if(!V.money(state.walletAmount,10,10000)){toast('المبلغ يجب أن يكون عددًا صحيحًا من 10 إلى 10000 جنيه','error');return}
 if(state.walletRef&&!V.text(state.walletRef,1,50)){toast('الكود المرجعي يجب ألا يتجاوز 50 حرفًا','error');return}

 state.walletLoading=true;
 state.error='';
 state.success='';
 render();

 try{
  const phone=state.walletFromPhone.replace(/\D/g,'');
  const reference=clean(state.walletRef,50);

  await API.topup({
   fromPhone:phone,
   phone,
   amount:Number(state.walletAmount),
   reference,
   referenceCode:reference,
   method:state.walletMethod,
   note:`تحويل من ${phone} بقيمة ${Number(state.walletAmount)} - كود: ${reference||'بدون'}`.slice(0,200)
  });

  state.walletLoading=false;
  state.success='تم إرسال طلب الشحن للمراجعة.';
  state.walletFromPhone='';
  state.walletAmount='';
  state.walletRef='';

  render();
  toast('تم إرسال طلب الشحن');
  await loadWalletHistory();
 }catch(e){
  state.walletLoading=false;
  state.error=e.message;
  render();
  toast(e.message,'error');
 }
}

