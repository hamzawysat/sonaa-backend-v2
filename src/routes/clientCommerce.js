'use strict';

const express = require('express');

function createClientCommerceRouter({ clientAuth, Client, CommerceItem, ClientSubscription, WalletTransaction, mongoose, createNotification }) {
  const router = express.Router();

  router.get('/commerce/catalog', clientAuth, async (req, res, next) => {
    try {
      const items = await CommerceItem.find({ kind: 'subscription', active: true })
        .select('name description price currency durationDays features')
        .sort({ price: 1, createdAt: -1 }).limit(100).lean();
      return res.set('Cache-Control', 'no-store').json({ items });
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
      if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) {
        await session.abortTransaction(); return res.status(409).json({ message: 'تعذر حساب قيمة أو مدة الاشتراك. تواصل مع خدمة العملاء.' });
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
          await createNotification({
            recipientRole: 'client', recipientId: notification.clientId,
            type: 'subscription_activated', title: 'تم تفعيل اشتراكك',
            message: 'تم تفعيل اشتراك ' + notification.itemName + ' بعد الدفع من محفظتك.',
            link: '/client.html?tab=subscriptions',
            dedupeKey: 'client-subscription-paid:' + String(notification.subscriptionId)
          });
        } catch (_) {}
      }
    }
  }

  router.post('/commerce/subscriptions/purchase', clientAuth, (req, res, next) => payForSubscription(req, res, next, 'purchase'));
  router.post('/commerce/subscriptions/:id/renew', clientAuth, (req, res, next) => payForSubscription(req, res, next, 'renew'));

  return router;
}

module.exports = createClientCommerceRouter;
