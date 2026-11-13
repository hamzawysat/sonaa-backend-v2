'use strict';

const express = require('express');

function createClientCommerceRouter({ clientAuth, Client, Order, CommerceItem, CommerceOrder, ClientSubscription, WalletTransaction, mongoose, createNotification, notifyAdmins }) {
  const router = express.Router();


  router.post('/orders/:sn/pay', clientAuth, async (req, res, next) => {
    let session;
    let notice = null;
    try {
      const sn = String(req.params.sn || '').trim().toUpperCase();
      if (!/^SN\d{6}$/.test(sn)) return res.status(400).json({ message: 'كود الطلب غير صحيح.' });
      if (req.client.status !== 'نشط') return res.status(403).json({ message: 'حساب العميل غير نشط.' });
      if (req.client.walletFrozen) return res.status(403).json({ message: 'محفظتك مجمدة حاليًا.' });
      session = await mongoose.startSession();
      session.startTransaction();
      const order = await Order.findOne({ sn, clientAccount: req.clientId, status: 'تم اختيار فني', assignedFanni: { $ne: null } }).session(session);
      if (!order) { await session.abortTransaction(); return res.status(404).json({ message: 'الطلب غير موجود بحسابك أو لم يتم تعيين فني عليه بعد.' }); }
      if (order.clientPaymentStatus === 'held' || order.clientPaymentStatus === 'settled') {
        await session.abortTransaction();
        return res.status(200).json({ message: order.clientPaymentStatus === 'settled' ? 'تم سداد الطلب وتسوية مستحقات الفني بالفعل.' : 'تم حجز قيمة الخدمة بالفعل من محفظتك.', paymentStatus: order.clientPaymentStatus, balance: Number(req.client.walletBalance || 0) });
      }
      const amount = Number(order.acceptedOfferPrice);
      if (!Number.isFinite(amount) || amount <= 0) { await session.abortTransaction(); return res.status(409).json({ message: 'سعر الخدمة غير صالح؛ تواصل مع خدمة العملاء.' }); }
      const client = await Client.findOne({ _id: req.clientId, status: 'نشط', walletFrozen: { $ne: true }, walletBalance: { $gte: amount } }).session(session);
      if (!client) { await session.abortTransaction(); return res.status(409).json({ message: 'رصيد محفظتك غير كافٍ أو المحفظة غير متاحة.', required: amount, balance: Number(req.client.walletBalance || 0) }); }
      const before = Number(client.walletBalance || 0);
      const updatedClient = await Client.findOneAndUpdate(
        { _id: client._id, status: 'نشط', walletFrozen: { $ne: true }, walletBalance: { $gte: amount } },
        { $inc: { walletBalance: -amount } }, { new: true, session, runValidators: true }
      );
      if (!updatedClient) { await session.abortTransaction(); return res.status(409).json({ message: 'تغير رصيد المحفظة أثناء الدفع. حدّث الصفحة وحاول مرة أخرى.' }); }
      order.clientPaymentStatus = 'held';
      order.clientPaymentAmount = amount;
      order.clientPaymentAt = new Date();
      await order.save({ session });
      await new WalletTransaction({
        client: client._id, order: order._id, orderSN: order.sn,
        type: 'client_escrow_hold', amount: -amount, balanceBefore: before,
        balanceAfter: Number(updatedClient.walletBalance),
        description: 'حجز قيمة الخدمة للطلب ' + order.sn + ' لحين إتمام الفني للمهمة',
        idempotencyKey: 'client-service-hold:' + String(order._id)
      }).save({ session });
      await session.commitTransaction();
      notice = { fanniId: order.assignedFanni, sn: order.sn };
      return res.json({ message: 'تم حجز قيمة الخدمة من محفظتك بأمان. سيحصل الفني على مستحقاته بعد إتمام المهمة.', balance: Number(updatedClient.walletBalance), paymentStatus: 'held', amount });
    } catch (error) {
      if (session && session.inTransaction()) await session.abortTransaction().catch(() => {});
      if (error && error.code === 11000) return res.status(409).json({ message: 'عملية دفع هذا الطلب مسجلة بالفعل.' });
      return next(error);
    } finally {
      if (session) await session.endSession();
      if (notice) {
        try { await createNotification({ recipientRole: 'fanni', recipientId: notice.fanniId, type: 'client_service_payment_held', title: 'تم تأمين قيمة الخدمة', message: 'قام العميل بحجز قيمة الخدمة للطلب ' + notice.sn + ' من محفظته. تُضاف مستحقاتك بعد إتمام المهمة.', link: '/fanni', dedupeKey: 'client-service-payment-held:' + notice.sn }); } catch (_) {}
      }
    }
  });

  router.get('/commerce/catalog', clientAuth, async (req, res, next) => {
    try {
      const items = await CommerceItem.find({ kind: 'subscription', active: true })
        .select('name description price currency durationDays features')
        .sort({ price: 1, createdAt: -1 }).limit(100).lean();
      return res.set('Cache-Control', 'no-store').json({ items });
    } catch (error) { return next(error); }
  });


  // Store catalog and product orders are separate from subscription billing.
  router.get('/commerce/products', clientAuth, async (req, res, next) => {
    try {
      const items = await CommerceItem.find({ kind: 'product', active: true })
        .select('name description price currency sku features metadata')
        .sort({ createdAt: -1 }).limit(100).lean();
      return res.set('Cache-Control', 'no-store').json({ items });
    } catch (error) { return next(error); }
  });

  router.get('/commerce/product-orders', clientAuth, async (req, res, next) => {
    try {
      const orders = await CommerceOrder.find({ buyerRole: 'client', buyer: req.clientId })
        .sort({ createdAt: -1 }).limit(100).lean();
      return res.set('Cache-Control', 'no-store').json({ orders });
    } catch (error) { return next(error); }
  });

  router.post('/commerce/product-orders', clientAuth, async (req, res, next) => {
    try {
      if (req.client.status !== 'نشط') return res.status(403).json({ message: 'حساب العميل غير نشط.' });
      const itemId = String(req.body?.itemId || '').trim();
      const quantity = Number(req.body?.quantity || 1);
      const buyerNote = String(req.body?.note || '').trim();
      if (!mongoose.isValidObjectId(itemId)) return res.status(400).json({ message: 'الصنف غير صالح.' });
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) return res.status(400).json({ message: 'الكمية يجب أن تكون من 1 إلى 100.' });
      if (buyerNote.length > 500) return res.status(400).json({ message: 'الملاحظات طويلة أكثر من اللازم.' });
      const item = await CommerceItem.findOne({ _id: itemId, kind: 'product', active: true }).lean();
      if (!item) return res.status(404).json({ message: 'الصنف غير متاح حاليًا.' });
      const total = Number(item.price) * quantity;
      if (!Number.isFinite(total) || total < 0 || total > 100000000) return res.status(409).json({ message: 'قيمة الطلب غير صالحة.' });
      const orderNumber = 'ST' + Date.now().toString().slice(-10) + Math.floor(Math.random() * 90 + 10);
      const order = await CommerceOrder.create({
        orderNumber, buyerRole: 'client', buyer: req.clientId,
        buyerName: req.client.name || '', buyerPhone: req.client.phone || '',
        item: item._id, itemName: item.name, sku: item.sku || '',
        unitPrice: Number(item.price), quantity, total, buyerNote,
        status: 'pending', paymentMethod: 'pending',
        statusHistory: [{ status: 'pending', note: 'طلب شراء جديد من العميل', changedBy: 'العميل' }]
      });
      try {
        await notifyAdmins({ type: 'admin_store_order', title: 'طلب شراء جديد من المتجر',
          message: 'طلب العميل ' + (order.buyerName || order.buyerPhone) + ' شراء ' + item.name + ' بإجمالي ' + total + ' جنيه. رقم الطلب ' + orderNumber + '.',
          link: '/admin.html?tab=commerceOrders', dedupeKey: 'admin-store-order:' + String(order._id) });
      } catch (notificationError) { console.error('Store order admin notification failed:', notificationError.message); }
      return res.status(201).json({ message: 'تم تسجيل طلبك وإشعار الإدارة. هنتواصل معاك لتأكيد الطلب وطريقة الدفع.', order });
    } catch (error) { return next(error); }
  });

  router.get('/commerce/subscriptions', clientAuth, async (req, res, next) => {
    try {
      const subscriptions = await ClientSubscription.find({ client: req.clientId })
        .sort({ createdAt: -1 }).limit(100).lean();
      return res.set('Cache-Control', 'no-store').json({ subscriptions });
    } catch (error) { return next(error); }
  });

  async function payForSubscription(req, res, next, mode) {
    let session;
    let notification = null;
    try {
      const itemId = String(req.body?.itemId || '').trim();
      const subscriptionId = String(req.params?.id || '').trim();
      const idempotencyKey = String(req.body?.idempotencyKey || '').trim();
      if (!/^[a-f0-9]{24}$/i.test(itemId) && mode === 'purchase') return res.status(400).json({ message: 'الباقة غير صالحة.' });
      if (mode === 'renew' && !mongoose.isValidObjectId(subscriptionId)) return res.status(400).json({ message: 'الاشتراك غير صالح.' });
      if (!/^[a-zA-Z0-9:_-]{16,150}$/.test(idempotencyKey)) return res.status(400).json({ message: 'معرّف عملية الدفع غير صالح. حدّث الصفحة وحاول مرة أخرى.' });
      if (req.client.status !== 'نشط') return res.status(403).json({ message: 'حساب العميل غير نشط.' });
      if (req.client.walletFrozen) return res.status(403).json({ message: 'المحفظة مجمدة حاليًا. تواصل مع خدمة العملاء.' });

      const pendingRequest = mode === 'purchase' ? await ClientSubscription.findOne({ client: req.clientId, requestKey: idempotencyKey }).lean() : null;
      if (pendingRequest) return res.status(200).json({ message: 'طلب الاشتراك مسجل بالفعل وبانتظار مراجعة الإدارة.', balance: Number(req.client.walletBalance || 0), subscription: pendingRequest, duplicate: true });

      const existingTransaction = await WalletTransaction.findOne({ client: req.clientId, idempotencyKey }).lean();
      if (existingTransaction) {
        const existingSubscription = existingTransaction.order
          ? null
          : await ClientSubscription.findOne({ client: req.clientId, 'history.paymentKey': idempotencyKey }).lean();
        return res.json({ message: 'عملية الدفع مسجلة بالفعل.', balance: Number(req.client.walletBalance || 0), subscription: existingSubscription || null, duplicate: true });
      }

      session = await mongoose.startSession();
      session.startTransaction();
      const client = await Client.findOne({ _id: req.clientId, status: 'نشط', walletFrozen: { $ne: true } }).session(session);
      if (!client) { await session.abortTransaction(); return res.status(403).json({ message: 'حسابك أو محفظتك غير متاحين للدفع حاليًا.' }); }

      let subscription;
      let item;
      let startsAt;
      let endsAt;
      let amount;
      if (mode === 'purchase') {
        item = await CommerceItem.findOne({ _id: itemId, kind: 'subscription', active: true }).session(session);
        if (!item) { await session.abortTransaction(); return res.status(404).json({ message: 'الباقة غير موجودة أو غير متاحة حاليًا.' }); }
        amount = Number(item.price);
        startsAt = new Date();
        endsAt = new Date(startsAt.getTime() + Number(item.durationDays || 30) * 86400000);
      } else {
        subscription = await ClientSubscription.findOne({ _id: subscriptionId, client: req.clientId, status: { $in: ['active', 'expired'] } }).session(session);
        if (!subscription) { await session.abortTransaction(); return res.status(404).json({ message: 'الاشتراك غير موجود أو لا يمكن تجديده.' }); }
        item = subscription.item ? await CommerceItem.findById(subscription.item).session(session) : null;
        amount = Number(subscription.amount || item?.price || 0);
        const durationDays = Number(subscription.durationDays || item?.durationDays || 30);
        startsAt = subscription.endsAt && new Date(subscription.endsAt) > new Date() ? new Date(subscription.endsAt) : new Date();
        endsAt = new Date(startsAt.getTime() + durationDays * 86400000);
      }
      if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) {
        await session.abortTransaction(); return res.status(409).json({ message: 'تعذر حساب قيمة أو مدة الاشتراك. تواصل مع خدمة العملاء.' });
      }

      // Require sufficient available balance when the request is submitted, but do not debit until admin approval.
      if (mode === 'purchase') {
        const availableBalance = Number(client.walletBalance || 0);
        if (availableBalance < amount) {
          await session.abortTransaction();
          return res.status(409).json({
            message: 'رصيد محفظتك غير كافٍ لطلب هذا الاشتراك. اشحن المحفظة أولًا ثم حاول مرة أخرى.',
            required: amount,
            balance: availableBalance
          });
        }
      }

      // A new subscription is only a request. Wallet debit happens after explicit admin approval.
      if (mode === 'purchase') {
        subscription = new ClientSubscription({
          client: client._id, item: item._id, itemName: item.name, amount,
          durationDays: Number(item.durationDays || 30), status: 'pending', paymentStatus: 'pending',
          paymentMethod: 'محفظة العميل', requestKey: idempotencyKey,
          startsAt: null, endsAt: null, createdBy: 'العميل', updatedBy: 'العميل', history: []
        });
        await subscription.save({ session });
        await session.commitTransaction();
        notification = { clientId: client._id, subscriptionId: subscription._id, itemName: subscription.itemName, request: true };
        return res.status(201).json({
          message: 'تم إرسال طلب الاشتراك للإدارة بنجاح. لن يتم خصم أي رصيد إلا بعد الموافقة والتفعيل.',
          balance: Number(client.walletBalance || 0), subscription
        });
      }

      const before = Number(client.walletBalance || 0);
      if (before < amount) { await session.abortTransaction(); return res.status(409).json({ message: 'رصيد محفظتك غير كافٍ. اشحن المحفظة أولًا.', required: amount, balance: before }); }
      const updatedClient = await Client.findOneAndUpdate(
        { _id: client._id, status: 'نشط', walletFrozen: { $ne: true }, walletBalance: { $gte: amount } },
        { $inc: { walletBalance: -amount } },
        { new: true, session, runValidators: true }
      );
      if (!updatedClient) { await session.abortTransaction(); return res.status(409).json({ message: 'تغير رصيد المحفظة أثناء الدفع. حدّث الصفحة وحاول مرة أخرى.' }); }

      if (mode === 'purchase') {
        subscription = new ClientSubscription({
          client: client._id, item: item._id, itemName: item.name, amount,
          durationDays: Number(item.durationDays || 30),
          status: 'active', paymentStatus: 'paid', paymentMethod: 'محفظة العميل',
          startsAt, endsAt, createdBy: 'العميل', updatedBy: 'العميل',
          history: [{ amount, startsAt, endsAt, renewedBy: 'العميل', note: 'شراء من محفظة العميل', paymentKey: idempotencyKey }]
        });
      } else {
        subscription.status = 'active';
        subscription.paymentStatus = 'paid';
        subscription.paymentMethod = 'محفظة العميل';
        subscription.startsAt = subscription.startsAt || startsAt;
        subscription.endsAt = endsAt;
        subscription.updatedBy = 'العميل';
        subscription.history.push({ amount, startsAt, endsAt, renewedBy: 'العميل', note: 'تجديد من محفظة العميل', paymentKey: idempotencyKey });
      }
      await subscription.save({ session });
      await new WalletTransaction({
        client: client._id, type: 'client_subscription_payment', amount: -amount,
        balanceBefore: before, balanceAfter: Number(updatedClient.walletBalance),
        description: (mode === 'purchase' ? 'شراء اشتراك ' : 'تجديد اشتراك ') + subscription.itemName,
        idempotencyKey
      }).save({ session });
      await session.commitTransaction();
      notification = { clientId: client._id, subscriptionId: subscription._id, itemName: subscription.itemName };
      return res.status(mode === 'purchase' ? 201 : 200).json({
        message: mode === 'purchase' ? 'تم شراء الاشتراك وتفعيله بنجاح.' : 'تم تجديد الاشتراك بنجاح.',
        balance: Number(updatedClient.walletBalance), subscription
      });
    } catch (error) {
      if (session?.inTransaction()) await session.abortTransaction().catch(() => {});
      if (error?.code === 11000) return res.status(409).json({ message: 'تم تسجيل عملية الدفع بالفعل أو يوجد طلب مكرر. حدّث بياناتك.' });
      return next(error);
    } finally {
      if (session) await session.endSession();
      if (notification) {
        try {
          if (notification.request) {
            await notifyAdmins({
              type: 'admin_subscription_request', title: 'طلب اشتراك جديد',
              message: 'طلب العميل اشتراك ' + notification.itemName + '. راجع الطلب وفعّله بعد التأكد من الرصيد.',
              link: '/admin.html?tab=commerceSubscriptions',
              dedupeKey: 'admin-subscription-request:' + String(notification.subscriptionId)
            });
          } else {
            await createNotification({
              recipientRole: 'client', recipientId: notification.clientId,
              type: 'subscription_activated', title: 'تم تفعيل اشتراكك',
              message: 'تم تفعيل اشتراك ' + notification.itemName + ' بعد الدفع من محفظتك.',
              link: '/client.html?tab=subscriptions',
              dedupeKey: 'client-subscription-paid:' + String(notification.subscriptionId)
            });
          }
        } catch (_) {}
      }
    }
  }

  router.post('/commerce/subscriptions/purchase', clientAuth, (req, res, next) => payForSubscription(req, res, next, 'purchase'));
  router.post('/commerce/subscriptions/:id/renew', clientAuth, (req, res, next) => payForSubscription(req, res, next, 'renew'));

  return router;
}

module.exports = createClientCommerceRouter;
