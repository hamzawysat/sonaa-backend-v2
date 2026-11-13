'use strict';

/* Admin commerce UI refinements: keep existing APIs and records unchanged. */
(function installAdminCommerceUiEnhancements() {
  if (typeof state !== 'object' || !state) return;

  if (typeof state.storeProductFormOpen !== 'boolean') state.storeProductFormOpen = false;
  if (!state.storeOrderStatusTab) state.storeOrderStatusTab = 'جديد';
  if (!state.clientSubscriptionStatusTab) state.clientSubscriptionStatusTab = 'active';

  const esc = value => typeof escHtml === 'function' ? escHtml(value) : String(value ?? '');
  const money = value => Number(value || 0).toLocaleString('ar-EG');
  const orderStatuses = ['جديد', 'تم التواصل', 'قيد التجهيز', 'ملغي', 'مكتمل'];
  const subscriptionTabs = [
    { id: 'active', label: 'الاشتراكات السارية' },
    { id: 'expired', label: 'الاشتراكات المنتهية' },
    { id: 'pending', label: 'طلبات الاشتراك الجديدة' }
  ];

  function subscriptionGroup(item) {
    const status = String(item.status || '');
    if (status === 'pending') return 'pending';
    if (status === 'active' && (!item.endsAt || new Date(item.endsAt).getTime() > Date.now())) return 'active';
    return 'expired';
  }

  window.setClientSubscriptionStatusTab = function (tab) {
    if (!subscriptionTabs.some(item => item.id === tab)) return;
    state.clientSubscriptionStatusTab = tab;
    if (typeof render === 'function') render();
  };

  window.setStoreOrderStatusTab = function (status) {
    if (!orderStatuses.includes(status)) return;
    state.storeOrderStatusTab = status;
    if (typeof render === 'function') render();
  };

  window.toggleStoreProductForm = function () {
    state.storeProductFormOpen = !state.storeProductFormOpen;
    if (typeof render === 'function') render();
  };

  window.renderCommerceSubscriptions = function () {
    const rows = state.clientSubscriptions || [];
    const selected = subscriptionTabs.some(item => item.id === state.clientSubscriptionStatusTab)
      ? state.clientSubscriptionStatusTab : 'active';
    state.clientSubscriptionStatusTab = selected;
    const filtered = rows.filter(item => subscriptionGroup(item) === selected);
    const counts = Object.fromEntries(subscriptionTabs.map(item => [
      item.id, rows.filter(row => subscriptionGroup(row) === item.id).length
    ]));
    const tabs = subscriptionTabs.map(item => `
      <button type="button" onclick="setClientSubscriptionStatusTab('${item.id}')"
        class="rounded-xl px-3 py-2 text-[11px] font-black border ${selected === item.id ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-slate-700 border-slate-200'}">
        ${item.label} <span class="mr-1">${counts[item.id]}</span>
      </button>`).join('');
    const cards = filtered.map(sub => {
      const client = sub.client || {};
      const end = sub.endsAt ? new Date(sub.endsAt).toLocaleDateString('ar-EG') : '—';
      const status = ({ active: 'نشط', pending: 'بانتظار التفعيل', paused: 'موقوف مؤقتًا', cancelled: 'ملغي', expired: 'منتهي' })[sub.status] || sub.status || 'غير محدد';
      return `<article class="premium-card p-4 space-y-2">
        <div class="flex items-start justify-between gap-2"><div><h3 class="font-black text-sm">${esc(client.name || 'عميل')}</h3><p class="text-xs text-slate-500" dir="ltr">${esc(client.phone || '')}</p></div><span class="text-xs font-black">${esc(status)}</span></div>
        <p class="text-sm font-bold">${esc(sub.itemName || 'اشتراك')} · ${money(sub.amount)} جنيه</p>
        <p class="text-xs text-slate-500">ينتهي: ${end} · الدفع: ${esc(sub.paymentStatus || '')}</p>
        ${sub.subscriptionDetails ? '<div class="rounded-xl border border-blue-100 bg-blue-50 p-3 text-[11px] leading-6 whitespace-pre-wrap break-words"><b class="block mb-1">تفاصيل الاشتراك</b>' + esc(sub.subscriptionDetails) + '</div>' : ''}
        <div class="flex flex-wrap gap-2">
          <button class="pill-btn soft-btn" onclick="editClientSubscriptionDetails('${esc(sub._id)}')">${sub.subscriptionDetails ? 'تعديل التفاصيل' : 'إضافة تفاصيل الاشتراك'}</button>
          <button class="pill-btn soft-btn" onclick="renewClientSubscription('${esc(sub._id)}')">تجديد</button>
          ${sub.status === 'active' ? '<button class="pill-btn soft-btn" onclick="changeClientSubscriptionStatus(\'' + esc(sub._id) + '\',\'paused\')">إيقاف مؤقت</button>' : '<button class="pill-btn soft-btn" onclick="changeClientSubscriptionStatus(\'' + esc(sub._id) + '\',\'active\')">تفعيل</button>'}
          <button class="pill-btn soft-btn" onclick="changeClientSubscriptionStatus('${esc(sub._id)}','cancelled')">إلغاء</button>
        </div>
      </article>`;
    }).join('');
    return `<section class="mt-4 space-y-3">
      <div class="premium-panel p-4 flex items-center justify-between gap-2"><div><h2 class="font-black text-sm">اشتراكات العملاء</h2><p class="text-[11px] text-slate-500 mt-1">متابعة الاشتراكات السارية والمنتهية وطلبات التفعيل الجديدة</p></div><button class="pill-btn primary-btn" onclick="createClientSubscription()">إضافة اشتراك</button></div>
      <div class="flex flex-wrap gap-2">${tabs}</div>
      ${state.commerceLoading ? '<p class="text-center p-5">جاري التحميل...</p>' : ''}
      ${filtered.length ? cards : '<p class="premium-panel p-6 text-center text-sm text-slate-500">لا توجد سجلات في هذا التبويب.</p>'}
    </section>`;
  };

  window.renderStore = function () {
    const products = state.storeProducts || [];
    const form = `
      <div class="premium-panel overflow-hidden">
        <button type="button" onclick="toggleStoreProductForm()" aria-expanded="${state.storeProductFormOpen ? 'true' : 'false'}"
          class="w-full p-4 flex items-center justify-between gap-3 text-right">
          <span><b class="block text-sm">إضافة منتج جديد</b><span class="block mt-1 text-[11px] text-slate-500">افتح النموذج لإدخال بيانات المنتج</span></span>
          <span class="text-xl font-black transition-transform ${state.storeProductFormOpen ? 'rotate-180' : ''}" aria-hidden="true">⌄</span>
        </button>
        ${state.storeProductFormOpen ? `<div class="border-t border-slate-100 p-4 grid gap-2">
          <input id="store-name" class="field" placeholder="اسم المنتج">
          <input id="store-price" type="number" min="0" class="field" placeholder="السعر الحالي بالجنيه">
          <input id="store-original-price" type="number" min="0" class="field" placeholder="السعر قبل العرض (اختياري)">
          <input id="store-offer" class="field" maxlength="200" placeholder="تفاصيل العرض (اختياري)">
          <select id="store-type" class="field"><option value="product">بضاعة ومنتج</option><option value="subscription">اشتراك أو تجديد اشتراك</option></select>
          <input id="store-duration" class="field" maxlength="60" placeholder="مدة الاشتراك (مثال: شهر أو سنة)">
          <textarea id="store-description" class="field" placeholder="الوصف المختصر"></textarea>
          <textarea id="store-details" class="field" placeholder="التفاصيل والمواصفات"></textarea>
          <input id="store-image" type="url" class="field" placeholder="رابط صورة المنتج (اختياري)">
          <input id="store-stock" type="number" min="0" class="field" placeholder="الكمية (اتركها فارغة بدون تحديد)">
          <button onclick="createStoreProduct()" class="primary-btn rounded-xl py-3">إضافة المنتج</button>
        </div>` : ''}
      </div>`;
    const productCards = products.map(product => `
      <article class="premium-card p-3 flex gap-3">
        <div class="w-16 h-16 bg-slate-100 rounded-xl overflow-hidden shrink-0">${product.imageUrl ? '<img class="w-full h-full object-cover" src="' + esc(product.imageUrl) + '" alt="' + esc(product.name) + '">' : '📦'}</div>
        <div class="min-w-0 flex-1"><b>${esc(product.name)}</b><p class="text-[11px]">${esc(product.description || '')}</p>
          <p class="text-[10px] text-teal-700">${product.type === 'subscription' ? 'اشتراك / تجديد' : 'منتج'}${product.offerText ? ' • ' + esc(product.offerText) : ''}</p>
          <b>${money(product.price)} جنيه</b>
          ${product.originalPrice != null && Number(product.originalPrice) > Number(product.price) ? '<p class="text-[10px] line-through text-slate-400">بدلًا من ' + money(product.originalPrice) + ' جنيه</p>' : ''}
          <p class="text-[10px]">${product.isActive ? 'متاح' : 'مخفي'}</p>
          <button class="text-blue-700 text-xs" onclick="editStoreProduct('${esc(product._id)}')">تعديل</button>
          ${product.isActive ? '<button class="text-rose-700 text-xs" onclick="hideStoreProduct(\'' + esc(product._id) + '\')">إخفاء</button>' : '<button class="text-emerald-700 text-xs" onclick="showStoreProduct(\'' + esc(product._id) + '\')">إظهار</button>'}
        </div>
      </article>`).join('');
    return `<section class="mt-4 space-y-3">${form}<b>المنتجات الحالية (${products.length})</b>
      ${state.storeProductsLoading ? '<div class="premium-panel p-5">جاري التحميل...</div>' : products.length ? productCards : '<div class="premium-panel p-5">لا توجد منتجات بعد.</div>'}
    </section>`;
  };

  window.renderStoreOrders = function () {
    const rows = state.storeOrders || [];
    const selected = orderStatuses.includes(state.storeOrderStatusTab) ? state.storeOrderStatusTab : 'جديد';
    state.storeOrderStatusTab = selected;
    const filtered = rows.filter(order => String(order.status || 'جديد') === selected);
    const tabs = orderStatuses.map(status => {
      const count = rows.filter(order => String(order.status || 'جديد') === status).length;
      return `<button type="button" onclick="setStoreOrderStatusTab('${status}')"
        class="rounded-xl px-3 py-2 text-[11px] font-black border ${selected === status ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-slate-700 border-slate-200'}">${status} <span class="mr-1">${count}</span></button>`;
    }).join('');
    const cards = filtered.map(order => {
      const currentStatus = String(order.status || 'جديد');
      const statusOptions = orderStatuses.map(status => {
        const disabled = status === 'جديد' && currentStatus !== 'جديد' ? ' disabled' : '';
        const selectedAttr = status === currentStatus ? ' selected' : '';
        return '<option value="' + esc(status) + '"' + selectedAttr + disabled + '>' + esc(status) + '</option>';
      }).join('');
      return `<article class="premium-card p-3 space-y-2">
        <b>${esc(order.productName)}</b>
        <p class="text-[10px]">${order.productType === 'subscription' ? 'اشتراك / تجديد' : 'بضاعة'} • ${esc(order.buyerName)} • ${esc(order.buyerPhone)} • ${order.buyerRole === 'client' ? 'عميل' : 'فني'}</p>
        <p class="text-xs">الكمية: ${Number(order.quantity || 0)} • الإجمالي: ${money(order.total)} جنيه</p>
        <p class="text-[10px]">الحالة الحالية: ${esc(currentStatus)} • الدفع: ${esc(order.paymentMethod || 'غير محدد')} (${esc(order.paymentStatus || 'غير مدفوع')})</p>
        <p class="text-[10px]">${esc(order.buyerNote || 'لا توجد ملاحظات')}</p>
        <select class="field" id="store-status-${esc(order._id)}">${statusOptions}</select>
        <select class="field" id="store-payment-${esc(order._id)}">
          <option value="غير محدد" ${!order.paymentMethod || order.paymentMethod === 'غير محدد' ? 'selected' : ''}>طريقة الدفع لم تحدد</option>
          <option value="محفظة العميل" ${order.paymentMethod === 'محفظة العميل' ? 'selected' : ''}>محفظة العميل</option>
          <option value="عند الاستلام" ${order.paymentMethod === 'عند الاستلام' ? 'selected' : ''}>عند الاستلام</option>
          <option value="تحويل" ${order.paymentMethod === 'تحويل' ? 'selected' : ''}>تحويل</option>
        </select>
        <input class="field" id="store-note-${esc(order._id)}" placeholder="ملاحظة للمشتري" value="${esc(order.adminNote || '')}">
        <button class="primary-btn rounded-xl py-2 w-full" onclick="updateStoreOrder('${esc(order._id)}')">حفظ الحالة وطريقة الدفع وإشعار صاحب الطلب</button>
      </article>`;
    }).join('');
    return `<section class="mt-4 space-y-3">
      <div class="premium-panel p-3"><b>طلبات ومبيعات المتجر</b><p class="text-[10px] text-slate-500">كل طلب يظهر في تبويب حالته الحالية، وينتقل تلقائيًا بعد حفظ الحالة الجديدة.</p></div>
      <div class="flex flex-wrap gap-2">${tabs}</div>
      ${state.storeOrdersLoading ? '<div class="premium-panel p-5">جاري التحميل...</div>' : filtered.length ? cards : '<div class="premium-panel p-5 text-center text-sm text-slate-500">لا توجد طلبات في هذه الحالة.</div>'}
    </section>`;
  };
})();
