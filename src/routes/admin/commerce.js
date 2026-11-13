'use strict';
const express = require('express');
function createAdminCommerceRouter({ auth, validate, Joi, mongoose, Client, CommerceItem, ClientSubscription, WalletTransaction, adminName, writeAdminAudit, createNotification, validId, sendBadId, MAX_LIST_LIMIT }) {
  const router = express.Router();
  const itemSchema = Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    description: Joi.string().trim().max(1500).allow('').default(''),
    price: Joi.number().strict().min(0).max(100000000).required(),
    durationDays: Joi.number().integer().min(1).max(3650).required(),
    features: Joi.array().items(Joi.string().trim().min(1).max(180)).max(30).default([]),
    active: Joi.boolean().default(true)
  });
  const itemPatchSchema = Joi.object({
    name: Joi.string().trim().min(2).max(100),
    description: Joi.string().trim().max(1500).allow(''),
    price: Joi.number().strict().min(0).max(100000000),
    durationDays: Joi.number().integer().min(1).max(3650),
    features: Joi.array().items(Joi.string().trim().min(1).max(180)).max(30),
    active: Joi.boolean()
  }).min(1);
  const subscriptionSchema = Joi.object({
    clientPhone: Joi.string().trim().required(),
    itemId: Joi.string().trim().required(),
    status: Joi.string().valid('pending', 'active').default('active'),
    paymentStatus: Joi.string().valid('unpaid', 'pending', 'paid').default('paid'),
    paymentMethod: Joi.string().trim().max(40).allow('').default('إداري'),
    startsAt: Joi.date().iso().optional(),
    endsAt: Joi.date().iso().optional(),
    amount: Joi.number().strict().min(0).max(100000000).optional(),
    notes: Joi.string().trim().max(1000).allow('').default('')
  });
  router.get('/commerce/catalog', auth('admin'), async (req, res, next) => {
    try {
      const items = await CommerceItem.find({ kind: 'subscription' }).sort({ active: -1, createdAt: -1 }).limit(MAX_LIST_LIMIT).lean();
      res.set('Cache-Control', 'no-store').json({ items });
    } catch (error) { next(error); }
  });
  router.post('/commerce/catalog', auth('admin'), validate(itemSchema), async (req, res, next) => {
    try {
      const item = await CommerceItem.create({ ...req.body, kind: 'subscription', currency: 'EGP' });
      await writeAdminAudit(req, 'إنشاء باقة اشتراك', 'commerce-catalog', String(item._id), 'name=' + item.name + '; price=' + item.price);
      return res.status(201).json({ message: 'تم إنشاء الباقة.', item });
    } catch (error) { next(error); }
  });
  router.patch('/commerce/catalog/:id', auth('admin'), validate(itemPatchSchema), async (req, res, next) => {
    if (!validId(req.params.id)) return sendBadId(res);
    try {
      const item = await CommerceItem.findOneAndUpdate({ _id: req.params.id, kind: 'subscription' }, { $set: req.body }, { new: true, runValidators: true });
      if (!item) return res.status(404).json({ message: 'الباقة غير موجودة.' });
      await writeAdminAudit(req, 'تعديل باقة اشتراك', 'commerce-catalog', String(item._id), JSON.stringify(req.body));
      return res.json({ message: 'تم تحديث الباقة.', item });
    } catch (error) { next(error); }
  });
  router.get('/commerce/subscriptions', auth('admin'), async (req, res, next) => {
    try {
      const filter = {};
      if (['pending','active','paused','cancelled','expired'].includes(String(req.query.status || ''))) filter.status = String(req.query.status);
      const subscriptions = await ClientSubscription.find(filter).populate('client', 'name phone').sort({ createdAt: -1 }).limit(MAX_LIST_LIMIT).lean();
      return res.set('Cache-Control', 'no-store').json({ subscriptions });
    } catch (error) { next(error); }
  });
  router.post('/commerce/subscriptions', auth('admin'), validate(subscriptionSchema), async (req, res, next) => {
    let session;
    try {
      const item = await CommerceItem.findOne({ _id: req.body.itemId, kind: 'subscription', active: true }).lean();
      if (!item) return res.status(404).json({ message: 'الباقة غير موجودة أو متوقفة.' });
      const startsAt = req.body.startsAt ? new Date(req.body.startsAt) : new Date();
      const endsAt = req.body.endsAt ? new Date(req.body.endsAt) : new Date(startsAt.getTime() + Number(item.durationDays) * 86400000);
      if (endsAt <= startsAt) return res.status(400).json({ message: 'تاريخ انتهاء الاشتراك يجب أن يكون بعد تاريخ البداية.' });
      const isImmediateActivation = req.body.status === 'active';
      const amount = isImmediateActivation ? Number(item.price) : (req.body.amount === undefined ? Number(item.price) : Number(req.body.amount));
      if (isImmediateActivation && (!Number.isFinite(amount) || amount <= 0)) return res.status(409).json({ message: 'لا يمكن تفعيل باقة مجانية من هذا الإجراء؛ يجب أن يكون سعر الباقة أكبر من صفر.' });

      const subscriptionId = new mongoose.Types.ObjectId();
      const subscription = new ClientSubscription({
        _id: subscriptionId, item: item._id, itemName: item.name, amount,
        durationDays: Number(item.durationDays || 30), status: req.body.status,
        paymentStatus: isImmediateActivation ? 'paid' : req.body.paymentStatus,
        paymentMethod: isImmediateActivation ? 'محفظة العميل' : req.body.paymentMethod,
        startsAt: isImmediateActivation ? startsAt : null, endsAt: isImmediateActivation ? endsAt : null,
        notes: req.body.notes, createdBy: adminName(req), updatedBy: adminName(req),
        history: isImmediateActivation ? [{ amount, startsAt, endsAt, renewedBy: adminName(req), note: 'تفعيل إداري مباشر بعد الخصم من محفظة العميل', paymentKey: 'admin-client-subscription:' + String(subscriptionId) }] : []
      });

      session = await mongoose.startSession();
      session.startTransaction();
      const client = await Client.findOne({ phone: req.body.clientPhone }).session(session);
      if (!client) { await session.abortTransaction(); return res.status(404).json({ message: 'العميل غير موجود. تأكد من رقم الهاتف.' }); }

      if (isImmediateActivation) {
        const paymentKey = 'admin-client-subscription:' + String(subscriptionId);
        if (client.status !== 'نشط' || client.walletFrozen === true) {
          await session.abortTransaction();
          return res.status(409).json({ message: 'لا يمكن التفعيل: حساب العميل أو محفظته غير متاح.' });
        }
        const before = Number(client.walletBalance || 0);
        if (before < amount) { await session.abortTransaction(); return res.status(409).json({ message: 'رصيد العميل غير كافٍ لتفعيل هذه الباقة.' }); }
        const updatedClient = await Client.findOneAndUpdate(
          { _id: client._id, status: 'نشط', walletFrozen: { $ne: true }, walletBalance: { $gte: amount } },
          { $inc: { walletBalance: -amount } }, { new: true, session, runValidators: true }
        );
        if (!updatedClient) {
          await session.abortTransaction();
          return res.status(409).json({ message: 'تغير رصيد العميل أثناء التفعيل. حدّث الصفحة وحاول مرة أخرى.' });
        }
        await new WalletTransaction({
          client: client._id, type: 'client_subscription_payment', amount: -amount,
          balanceBefore: before, balanceAfter: Number(updatedClient.walletBalance),
          description: 'تفعيل اشتراك ' + item.name + ' من إدارة العملاء', idempotencyKey: paymentKey
        }).save({ session });
      }

      subscription.client = client._id;
      await subscription.save({ session });
      await session.commitTransaction();
      await writeAdminAudit(req, isImmediateActivation ? 'تفعيل اشتراك عميل من إدارة العملاء' : 'إنشاء طلب اشتراك عميل', 'client-subscriptions', String(subscription._id), 'client=' + String(client._id) + '; item=' + item.name + '; status=' + subscription.status + '; amount=' + amount);
      if (isImmediateActivation) await createNotification({
        recipientRole: 'client', recipientId: client._id, type: 'subscription_activated',
        title: 'تم تفعيل اشتراكك بنجاح',
        message: 'تم تفعيل اشتراك ' + item.name + ' بنجاح، والخدمة فعّالة الآن.',
        link: '/client.html?tab=subscriptions',
        dedupeKey: 'admin-client-subscription-activated:' + String(subscription._id)
      });
      return res.status(201).json({ message: isImmediateActivation ? 'تم تفعيل الاشتراك وخصم قيمته من محفظة العميل.' : 'تم إنشاء طلب الاشتراك.', subscription });
    } catch (error) {
      if (session?.inTransaction()) await session.abortTransaction().catch(() => {});
      if (error?.code === 11000) return res.status(409).json({ message: 'تم تسجيل خصم هذا الاشتراك بالفعل.' });
      next(error);
    } finally { if (session) await session.endSession(); }
  });
  router.post('/commerce/subscriptions/:id/renew', auth('admin'), validate(Joi.object({ note: Joi.string().trim().max(500).allow('').default(''), paymentStatus: Joi.string().valid('paid','pending','unpaid').default('paid'), amount: Joi.number().strict().min(0).max(100000000).optional() })), async (req, res, next) => {
    if (!validId(req.params.id)) return sendBadId(res);
    try {
      const subscription = await ClientSubscription.findById(req.params.id);
      if (!subscription) return res.status(404).json({ message: 'الاشتراك غير موجود.' });
      const item = subscription.item ? await CommerceItem.findById(subscription.item).lean() : null;
      const duration = Number(subscription.durationDays || item?.durationDays || 30);
      const now = new Date(), startsAt = subscription.endsAt && new Date(subscription.endsAt) > now ? new Date(subscription.endsAt) : now;
      const endsAt = new Date(startsAt.getTime() + duration * 86400000);
      const amount = req.body.amount === undefined ? Number(subscription.amount || item?.price || 0) : Number(req.body.amount);
      subscription.startsAt = subscription.startsAt || startsAt;
      subscription.endsAt = endsAt; subscription.status = 'active'; subscription.paymentStatus = req.body.paymentStatus;
      subscription.amount = amount; subscription.updatedBy = adminName(req);
      subscription.history.push({ amount, startsAt, endsAt, renewedBy: adminName(req), note: req.body.note });
      await subscription.save();
      await writeAdminAudit(req, 'تجديد اشتراك عميل', 'client-subscriptions', String(subscription._id), 'endsAt=' + endsAt.toISOString() + '; amount=' + amount);
      await createNotification({ recipientRole: 'client', recipientId: subscription.client, type: 'subscription_renewed', title: 'تم تجديد اشتراكك', message: 'تم تجديد اشتراك ' + subscription.itemName + '.', link: '/client.html?tab=subscriptions', dedupeKey: 'subscription-renewed:' + String(subscription._id) + ':' + endsAt.getTime() });
      return res.json({ message: 'تم تجديد الاشتراك.', subscription });
    } catch (error) { next(error); }
  });
  router.patch('/commerce/subscriptions/:id/status', auth('admin'), validate(Joi.object({ status: Joi.string().valid('active','paused','cancelled','expired').required(), reason: Joi.string().trim().max(500).allow('').default('') })), async (req, res, next) => {
    if (!validId(req.params.id)) return sendBadId(res);
    let session;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      const subscription = await ClientSubscription.findById(req.params.id).session(session);
      if (!subscription) { await session.abortTransaction(); return res.status(404).json({ message: 'الاشتراك غير موجود.' }); }

      // Charge client-originated requests only after explicit admin approval.
      if (req.body.status === 'active' && subscription.status === 'pending' && subscription.createdBy === 'العميل' && subscription.paymentStatus !== 'paid') {
        const paymentKey = 'client-subscription-approval:' + String(subscription._id);
        const priorPayment = await WalletTransaction.findOne({ client: subscription.client, idempotencyKey: paymentKey }).session(session).lean();
        if (!priorPayment) {
          const amount = Number(subscription.amount || 0);
          const client = await Client.findOne({ _id: subscription.client, status: 'نشط', walletFrozen: { $ne: true }, walletBalance: { $gte: amount } }).session(session);
          if (!client) { await session.abortTransaction(); return res.status(409).json({ message: 'لا يمكن تفعيل الاشتراك: رصيد العميل غير كافٍ أو المحفظة غير متاحة.' }); }
          const before = Number(client.walletBalance || 0);
          const updatedClient = await Client.findOneAndUpdate(
            { _id: client._id, status: 'نشط', walletFrozen: { $ne: true }, walletBalance: { $gte: amount } },
            { $inc: { walletBalance: -amount } }, { new: true, session, runValidators: true }
          );
          if (!updatedClient) { await session.abortTransaction(); return res.status(409).json({ message: 'تغير رصيد العميل أثناء التفعيل. حدّث الصفحة وحاول مرة أخرى.' }); }
          await new WalletTransaction({
            client: client._id, type: 'client_subscription_payment', amount: -amount,
            balanceBefore: before, balanceAfter: Number(updatedClient.walletBalance),
            description: 'تفعيل اشتراك ' + subscription.itemName + ' بعد موافقة الإدارة',
            idempotencyKey: paymentKey
          }).save({ session });
        }
        const startsAt = new Date();
        subscription.startsAt = startsAt;
        subscription.endsAt = new Date(startsAt.getTime() + Number(subscription.durationDays || 30) * 86400000);
        subscription.paymentStatus = 'paid';
        subscription.paymentMethod = 'محفظة العميل';
        subscription.history.push({ amount: Number(subscription.amount || 0), startsAt, endsAt: subscription.endsAt, renewedBy: adminName(req), note: 'خصم وتفعيل بعد موافقة الإدارة', paymentKey });
      }

      subscription.status = req.body.status; subscription.updatedBy = adminName(req);
      if (req.body.status === 'active' && !subscription.startsAt) subscription.startsAt = new Date();
      if (req.body.status === 'active' && !subscription.endsAt) {
        const item = subscription.item ? await CommerceItem.findById(subscription.item).session(session).lean() : null;
        subscription.endsAt = new Date(Date.now() + Number(item?.durationDays || 30) * 86400000);
      }
      subscription.notes = [subscription.notes, req.body.reason].filter(Boolean).join('\n').slice(0,1000);
      await subscription.save({ session });
      await session.commitTransaction();
      await writeAdminAudit(req, 'تغيير حالة اشتراك عميل', 'client-subscriptions', String(subscription._id), 'status=' + subscription.status + '; reason=' + req.body.reason);
      if (subscription.status === 'active' && subscription.paymentStatus === 'paid') {
        await createNotification({ recipientRole: 'client', recipientId: subscription.client, type: 'subscription_activated', title: 'تم تفعيل اشتراكك', message: 'وافقت الإدارة وتم تفعيل اشتراك ' + subscription.itemName + ' وخصم قيمته من محفظتك.', link: '/client.html?tab=subscriptions', dedupeKey: 'client-subscription-approved:' + String(subscription._id) });
      }
      return res.json({ message: 'تم تحديث حالة الاشتراك.', subscription });
    } catch (error) {
      if (session?.inTransaction()) await session.abortTransaction().catch(() => {});
      if (error?.code === 11000) return res.status(409).json({ message: 'تم تسجيل خصم هذا الاشتراك بالفعل.' });
      next(error);
    } finally { if (session) await session.endSession(); }
  });
  return router;
}
module.exports = createAdminCommerceRouter;
