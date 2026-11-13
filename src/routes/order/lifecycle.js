'use strict';

const express = require('express');

function createOrderLifecycleRouter({
  mongoose,
  Order,
  WalletTransaction,
  Fanni,
  auth,
  validSN,
  verifyClientToken,
  ACTIVE_STATUSES,
  currentPricing,
  DEFAULT_COMMISSION_RATE,
  money,
  getAcceptedOffer,
  publicOrder,
  createNotification,
  hasAcceptedGuidelines,
  autoPromoteFanni,
  sanitizeText
}) {
  const router = express.Router();

router.post('/:sn/accept', async (req, res, next) => {
  let session;
  let responsePayload = null;
  let responseStatus = 200;
  let notificationFanniId = null;
  let notificationClientId = null;
  let notificationOrderId = null;
  let notificationCommissionAmount = 0;
  let notificationCommissionRate = 0;

  try {
    session = await mongoose.startSession();

    const sn = String(req.params.sn || '').toUpperCase();
    const offerId = String(req.body.offerId || '');

    if (!validSN(sn) || !mongoose.isValidObjectId(offerId)) {
      return res.status(400).json({
        message: 'كود الطلب أو العرض غير صحيح'
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(503).json({
        message: 'الخدمة غير متاحة بسبب إعدادات الخادم'
      });
    }

    await session.startTransaction();

    const order = await Order.findOne({ sn }).session(session);

    if (!order) {
      await session.abortTransaction();
      return res.status(404).json({
        message: 'الطلب غير موجود'
      });
    }

    if (!(await verifyClientToken(req, order))) {
      await session.abortTransaction();
      return res.status(403).json({
        message: 'لازم تستخدم رابط أو جلسة العميل صاحب الطلب لقبول العرض'
      });
    }

    if (!ACTIVE_STATUSES.includes(order.status)) {
      await session.abortTransaction();
      return res.status(409).json({
        message: 'تم اختيار فني بالفعل أو لم يعد الطلب متاحًا'
      });
    }

    if (order.expiresAt && order.expiresAt <= new Date()) {
      await session.abortTransaction();
      return res.status(409).json({
        message: 'انتهت مدة استقبال العروض لهذا الطلب'
      });
    }

    if (order.commissionCharged === true) {
      await session.abortTransaction();
      return res.status(409).json({
        message: 'تم تسجيل عمولة هذا الطلب بالفعل'
      });
    }

    const offer = getAcceptedOffer(order, offerId);

    if (!offer) {
      await session.abortTransaction();
      return res.status(404).json({
        message: 'العرض غير موجود'
      });
    }

    const price = Number(offer.priceNum);

    if (!Number.isFinite(price) || price <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        message: 'سعر العرض غير صالح، اطلب من الفني إرسال عرض صحيح'
      });
    }

    const pricing = await currentPricing();
    const commissionRate = Number.isFinite(Number(pricing.commission)) ? Number(pricing.commission) : DEFAULT_COMMISSION_RATE;
    const commissionAmount = money(price * commissionRate / 100);

    if (
      !Number.isFinite(commissionAmount) ||
      commissionAmount < 0
    ) {
      await session.abortTransaction();
      return res.status(400).json({
        message: 'تعذر حساب عمولة الطلب بشكل صحيح'
      });
    }

    const fanniId = offer.fanni;

    const fanniBefore = await Fanni.findOne({
      _id: fanniId,
      role: 'fanni',
      status: 'معتمد',
      isFrozen: { $ne: true }
    }).session(session);

    if (!fanniBefore) {
      await session.abortTransaction();
      return res.status(409).json({
        message: 'الفني صاحب العرض لم يعد حسابه معتمدًا'
      });
    }

    const balanceBefore = Number(fanniBefore.walletBalance || 0);

    if (
      !Number.isFinite(balanceBefore) ||
      balanceBefore < commissionAmount
    ) {
      await session.abortTransaction();
      return res.status(409).json({
        message: 'رصيد محفظة الفني غير كافٍ لسداد عمولة المنصة',
        requiredCommission: commissionAmount,
        walletBalance: Number.isFinite(balanceBefore)
          ? balanceBefore
          : 0
      });
    }

    const fanniAfter = await Fanni.findOneAndUpdate(
      {
        _id: fanniId,
        role: 'fanni',
        status: 'معتمد',
        isFrozen: { $ne: true },
        walletBalance: { $gte: commissionAmount }
      },
      {
        $inc: { walletBalance: -commissionAmount }
      },
      {
        new: true,
        session,
        runValidators: true
      }
    );

    if (!fanniAfter) {
      await session.abortTransaction();
      return res.status(409).json({
        message: 'الرصيد تغيّر أو أصبح غير كافٍ؛ لم يتم قبول العرض أو خصم العمولة'
      });
    }

    const balanceAfter = Number(fanniAfter.walletBalance);

    const updateResult = await Order.updateOne(
      {
        _id: order._id,
        status: { $in: ACTIVE_STATUSES },
        commissionCharged: { $ne: true },
        expiresAt: { $gt: new Date() },
        'offers._id': offerId
      },
      {
        $set: {
          assignedFanni: fanniId,
          assignedFanniName: offer.fanniName,
          acceptedOfferId: offer._id,
          acceptedOfferPrice: price,
          commissionRate,
          commissionAmount,
          commissionCharged: true,
          commissionChargedAt: new Date(),
          status: 'تم اختيار فني'
        }
      },
      {
        session,
        runValidators: true
      }
    );

    if (updateResult.modifiedCount !== 1) {
      await session.abortTransaction();
      return res.status(409).json({
        message: 'الطلب لم يعد متاحًا؛ لم يتم تثبيت الخصم'
      });
    }

    const transaction = new WalletTransaction({
      fanni: fanniId,
      order: order._id,
      orderSN: order.sn,
      type: 'commission',
      amount: -commissionAmount,
      balanceBefore,
      balanceAfter,
      description: `عمولة منصة صُنّاع بنسبة ${commissionRate}% للطلب ${order.sn}`,
      idempotencyKey: `commission:${String(order._id)}`
    });

    await transaction.save({ session });

    const updatedOrder = await Order.findById(order._id).session(session);

    if (!updatedOrder) {
      throw new Error('ORDER_NOT_FOUND_AFTER_UPDATE');
    }

    notificationFanniId = fanniId;
    notificationClientId = updatedOrder.clientAccount || null;
    notificationOrderId = updatedOrder._id;
    notificationCommissionAmount = commissionAmount;
    notificationCommissionRate = commissionRate;

    responsePayload = {
      message: 'تم قبول العرض بنجاح',
      order: publicOrder(updatedOrder, {
        includeAddress: true,
        includeAssignedFanniPhone: true
      })
    };

    await session.commitTransaction();
  } catch (err) {
    if (session && session.inTransaction()) {
      try {
        await session.abortTransaction();
      } catch (abortError) {}
    }

    if (err && err.code === 11000) {
      responseStatus = 409;
      responsePayload = {
        message: 'توجد حركة مالية مسجلة لهذا الطلب بالفعل؛ لم يتم تكرار الخصم'
      };
    } else {
      return next(err);
    }
  } finally {
    if (session) await session.endSession();
  }

  if (responsePayload && responseStatus === 200 && responsePayload.order) {
    const acceptedOrder = responsePayload.order;
    await createNotification({
      recipientRole: 'fanni',
      recipientId: notificationFanniId,
      type: 'commission_deducted',
      title: 'تم خصم عمولة المنصة',
      message: 'تم خصم عمولة قدرها ' + notificationCommissionAmount + ' جنيه (' + notificationCommissionRate + '%) من محفظتك عند قبول الطلب ' + acceptedOrder.sn + '.',
      link: '/fanni',
      dedupeKey: 'commission-deducted:' + String(notificationOrderId || acceptedOrder.sn)
    });
    await createNotification({
      recipientRole: 'fanni', recipientId: notificationFanniId, type: 'offer_accepted',
      title: 'تم قبول عرضك', message: 'العميل قبل عرضك على الطلب ' + acceptedOrder.sn + '.',
      link: '/fanni', dedupeKey: 'offer-accepted:' + String(notificationOrderId || acceptedOrder.sn)
    });
    const clientAccountId = notificationClientId;
    if (clientAccountId) {
      await createNotification({
        recipientRole: 'client', recipientId: clientAccountId, type: 'offer_accepted',
        title: 'تم اختيار الفني', message: 'تم قبول العرض على طلبك ' + acceptedOrder.sn + '.',
        link: '/?tab=orders', dedupeKey: 'client-offer-accepted:' + String(notificationOrderId || acceptedOrder.sn)
      });
    }
  }

  if (responsePayload) {
    return res.status(responseStatus).json(responsePayload);
  }

  return res.status(500).json({
    message: 'تعذر إكمال عملية قبول العرض'
  });
});

router.post('/:sn/cancel', async (req, res, next) => {
  try {
    const sn = String(req.params.sn || '').toUpperCase();
    if (!validSN(sn)) return res.status(400).json({ message: 'كود الطلب غير صحيح.' });

    const order = await Order.findOne({ sn });
    if (!order) return res.status(404).json({ message: 'الطلب غير موجود.' });
    if (!(await verifyClientToken(req, order))) {
      return res.status(403).json({ message: 'لا يمكن إلغاء طلب لا يخص حسابك.' });
    }
    if (order.assignedFanni || ['تم اختيار فني', 'تم الانتهاء'].includes(order.status)) {
      return res.status(409).json({ message: 'لا يمكن إلغاء الطلب بعد اختيار الفني. تواصل مع الإدارة للمساعدة.' });
    }
    if (['ملغي', 'مؤرشف', 'منتهي', 'منتهي - اعتذار'].includes(order.status)) {
      return res.status(409).json({ message: 'الطلب ملغي أو مغلق بالفعل.' });
    }

    const cancelledOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        assignedFanni: null,
        status: { $nin: ['تم اختيار فني', 'تم الانتهاء', 'ملغي', 'مؤرشف', 'منتهي', 'منتهي - اعتذار'] }
      },
      { $set: { status: 'ملغي' } },
      { new: true, runValidators: true }
    );
    if (!cancelledOrder) {
      return res.status(409).json({ message: 'الطلب لم يعد متاحًا للإلغاء؛ ربما تم اختيار فني أو إغلاق الطلب.' });
    }

    if (cancelledOrder.clientAccount) {
      await createNotification({
        recipientRole: 'client',
        recipientId: cancelledOrder.clientAccount,
        type: 'order_cancelled',
        title: 'تم إلغاء الطلب',
        message: 'تم إلغاء طلبك ' + order.sn + ' بناءً على طلبك.',
        link: '/?tab=orders',
        dedupeKey: 'client-order-cancelled:' + String(cancelledOrder._id)
      });
    }

    return res.json({ message: 'تم إلغاء الطلب بنجاح.', order: publicOrder(cancelledOrder) });
  } catch (err) {
    next(err);
  }
});


router.post('/:sn/complete', auth(), async (req, res, next) => {
  let session;
  try {
    if (req.user.role !== 'fanni') return res.status(403).json({ message: 'إكمال المهمة متاح للفني المعيّن فقط' });
    if (!(await hasAcceptedGuidelines(req.userId))) return res.status(428).json({ code: 'TECHNICIAN_GUIDELINES_REQUIRED', message: 'يجب الموافقة على ميثاق التعامل المهني أولًا.' });
    const sn = String(req.params.sn || '').toUpperCase();
    if (!/^SN\d{6}$/.test(sn)) return res.status(400).json({ message: 'كود الطلب غير صحيح' });

    session = await mongoose.startSession();
    session.startTransaction();
    const order = await Order.findOne({ sn, status: 'تم اختيار فني', assignedFanni: req.userId }).session(session);
    if (!order) {
      await session.abortTransaction();
      const existing = await Order.findOne({ sn }).select('sn status assignedFanni').lean();
      if (!existing) return res.status(404).json({ message: 'الطلب غير موجود' });
      if (String(existing.assignedFanni || '') !== String(req.userId)) return res.status(403).json({ message: 'هذا الطلب غير مسند إليك' });
      return res.status(409).json({ message: existing.status === 'تم الانتهاء' ? 'المهمة مكتملة بالفعل' : 'حالة الطلب لا تسمح بإكمال المهمة' });
    }

    const fanni = await Fanni.findOne({ _id: req.userId, role: 'fanni' }).session(session);
    if (!fanni) { await session.abortTransaction(); return res.status(404).json({ message: 'حساب الفني غير موجود.' }); }
    let settlement = null;
    if (order.clientPaymentStatus === 'held') {
      const amount = Number(order.clientPaymentAmount || 0);
      if (!Number.isFinite(amount) || amount <= 0) { await session.abortTransaction(); return res.status(409).json({ message: 'قيمة المبلغ المحجوز غير سليمة؛ لم يتم إنهاء الطلب أو صرف أي رصيد.' }); }
      const before = Number(fanni.walletBalance || 0);
      const updatedFanni = await Fanni.findOneAndUpdate(
        { _id: fanni._id, role: 'fanni' },
        { $inc: { walletBalance: amount, 'stats.completedJobs': 1 } },
        { new: true, session, runValidators: true }
      );
      if (!updatedFanni) { await session.abortTransaction(); return res.status(409).json({ message: 'تعذر تحديث محفظة الفني؛ لم يتم إنهاء الطلب.' }); }
      await new WalletTransaction({
        fanni: fanni._id, order: order._id, orderSN: order.sn,
        type: 'technician_settlement', amount,
        balanceBefore: before, balanceAfter: Number(updatedFanni.walletBalance),
        description: 'صرف مستحقات تنفيذ الطلب ' + order.sn + ' بعد تأكيد إتمام المهمة',
        idempotencyKey: 'technician-settlement:' + String(order._id)
      }).save({ session });
      order.clientPaymentStatus = 'settled';
      order.technicianSettledAt = new Date();
      settlement = { amount, balance: Number(updatedFanni.walletBalance) };
    } else {
      await Fanni.updateOne({ _id: fanni._id, role: 'fanni' }, { $inc: { 'stats.completedJobs': 1 } }, { session });
    }
    order.status = 'تم الانتهاء';
    await order.save({ session });
    await session.commitTransaction();

    await autoPromoteFanni(req.userId, 'إكمال المهمة ' + order.sn);
    if (settlement) await createNotification({ recipientRole: 'fanni', recipientId: req.userId, type: 'technician_settlement', title: 'تم تحويل مستحقاتك', message: 'تم إضافة ' + settlement.amount + ' جنيه إلى محفظتك مقابل تنفيذ الطلب ' + order.sn + '.', link: '/fanni', dedupeKey: 'technician-settlement-notice:' + String(order._id) });
    if (order.clientAccount) {
      await createNotification({
        recipientRole: 'client', recipientId: order.clientAccount,
        type: 'order_completed', title: 'الفني أنهى المهمة',
        message: settlement ? 'تم إنهاء الطلب ' + order.sn + ' وتحويل مستحقات الفني. يمكنك الآن تقييم الخدمة.' : 'تم تسجيل اكتمال الطلب ' + order.sn + '. افتح الطلب لتقييم الفني.',
        link: '/client.html?tab=orders', dedupeKey: 'order-completed:' + String(order._id)
      });
    }
    return res.json({
      message: settlement ? 'تم إكمال المهمة وتحويل مستحقاتك إلى محفظتك بنجاح.' : 'تم إكمال المهمة بنجاح',
      order: { sn: order.sn, status: order.status, clientPaymentStatus: order.clientPaymentStatus },
      settlement
    });
  } catch (err) {
    if (session && session.inTransaction()) await session.abortTransaction().catch(() => {});
    if (err && err.code === 11000) return res.status(409).json({ message: 'تم تسجيل تسوية هذا الطلب بالفعل؛ لم يتم تكرار صرف المستحقات.' });
    next(err);
  } finally {
    if (session) await session.endSession();
  }
});

router.get('/:sn/assigned-details', auth(), async (req, res, next) => {
  try {
    const sn = String(req.params.sn || '').toUpperCase();

    if (!validSN(sn)) {
      return res.status(400).json({
        message: 'كود الطلب غير صحيح'
      });
    }

    const order = await Order.findOne({ sn }).select('+voiceRecordingData').lean();

    if (!order) {
      return res.status(404).json({
        message: 'الطلب غير موجود'
      });
    }

    if (
      order.status !== 'تم اختيار فني' ||
      !order.assignedFanni ||
      String(order.assignedFanni) !== String(req.userId) ||
      req.user.role !== 'fanni'
    ) {
      return res.status(403).json({
        message: 'تفاصيل العميل متاحة للفني المعيّن لهذا الطلب بعد قبول العرض فقط'
      });
    }

    return res.json({
      message: 'تم جلب تفاصيل الطلب المعيّن لك',
      order: {
        sn: order.sn,
        service: order.service,
        area: order.area,
        address: order.address,
        clientName: sanitizeText(order.clientName || ''),
        clientPhone: order.clientPhone,
        description: sanitizeText(order.description || ''),
        hasVoiceRecording: Boolean(order.voiceRecordingData),
        budget: order.budget || '',
        status: order.status,
        acceptedOfferPrice: order.acceptedOfferPrice,
        commissionAmount: order.commissionAmount,
        commissionCharged: order.commissionCharged
      }
    });
  } catch (err) {
    next(err);
  }
});



  return router;
}

module.exports = createOrderLifecycleRouter;
