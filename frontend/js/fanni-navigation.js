'use strict';

const TECHNICIAN_TAB_DEFINITIONS=[{id:'home',label:'الرئيسية'},{id:'available',label:'فرص العمل'},{id:'myOrders',label:'طلباتي'},{id:'wallet',label:'المحفظة'},{id:'store',label:'المتجر'},{id:'profile',label:'حسابي'},{id:'support',label:'الدعم الفني'}];
function setTab(tab){
 if(tab==='myOffers'){tab='myOrders';state.myOrdersView='active';}
 if(tab==='completed'){tab='myOrders';state.myOrdersView='completed';}
 state.tab=tab;
 state.error='';
 state.success='';
 state.pendingMsg='';
 render();

 if(tab==='available')loadOrders();
if(tab==='myOrders')loadMyOffers();
 if(tab==='wallet'){loadWalletHistory();loadWalletTransferNumbers();}
 if(tab==='profile')loadProfile();
 if(tab==='store'&&getToken())loadStoreForRole('fanni');
}

function setMyOrdersView(view){if(!['active','completed'].includes(view))return;state.myOrdersView=view;render();}
