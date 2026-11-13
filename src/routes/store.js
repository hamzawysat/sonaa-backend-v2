'use strict';

const express = require('express');
const Joi = require('joi');
const mongoose = require('mongoose');
const StoreProduct = require('../models/StoreProduct');
const StoreOrder = require('../models/StoreOrder');
const Client = require('../models/Client');
const WalletTransaction = require('../models/WalletTransaction');
const { auth } = require('../middleware/auth');
const { clientAuth } = require('../middleware/clientAuth');
const { notifyAdmins, createNotification } = require('../utils/notifications');

const router = express.Router();
const orderSchema = Joi.object({
  productId: Joi.string().hex().length(24).required(),
  quantity: Joi.number().integer().min(1).max(1000).default(1),
  note: Joi.string().trim().max(1000).allow('').default(''),
  paymentMethod: Joi.string().valid('wallet', 'cash_on_delivery').optional(),
  idempotencyKey: Joi.string().pattern(/^[a-zA-Z0-9:_-]{16,150}$/).optional()
}).unknown(false);

router.get('/products', async (req, res, next) => {
  try {
    const products = await StoreProduct.find({ isActive: true }).sort({ createdAt: -1 }).select('name description details price originalPrice offerText type subscriptionDuration imageUrl stock createdAt').lean();
    return res.set('Cache-Control', 'no-store').json({ products });
  } catch (error) { return next(error); }
});

async function submitOrder(req, res, next, role) {
  let session = null;
  let requestValue = null;
  let reservedProductId = null;
  let reservedQuantity = 0;
  try {
    const { error, value } = orderSchema.validate(req.body || {}, { abortEarly: false });
    requestValue = value;
    if (error) return res.status(400).json({ message: 'راجع بيانات طلب الشراء وطريقة الدفع.' });
    if (role === 'fanni' && req.user?.role !== 'fanni') return res.status(403).json({ message: 'الشراء متاح لحسابات الفنيين فقط.' });
    const buyer = role === 'client' ? req.client : req.user;
    if (!buyer || !buyer._id) return res.status(401).json({ message: 'سجّل الدخول لإرسال طلب الشراء.' });

    if (role === 'client') {
      if (!value.idempotencyKey) return res.status(400).json({ message: 'حدّث الصفحة وحاول إرسال الطلب مرة أخرى.' });
      const duplicate = await StoreOrder.findOne({ buyerRole: 'client', buyerId: buyer._id, requestKey: value.idempotencyKey }).lean();
      if (duplicate) {
        return res.status(200).json({
          message: 'طلب الشراء مسجل بالفعل.',
          balance: Number(buyer.walletBalance || 0),
          order: { id: String(duplicate._id), productName: duplicate.productName, quantity: duplicate.quantity, total: duplicate.total, status: duplicate.status, paymentMethod: duplicate.paymentMethod, paymentStatus: duplicate.paymentStatus, createdAt: duplicate.createdAt },
          duplicate: true
        });
      }
      session = await mongoose.startSession();
      session.startTransaction();
    }

    const query = StoreProduct.findOne({ _id: value.productId, isActive: true });
    const product = session ? await query.session(session) : await query;
    if (!product) {
      if (session?.inTransaction()) await session.abortTransaction();
      return res.status(404).json({ message: 'المنتج غير متاح حاليًا.' });
    }
    const isSubscription = product.type === 'subscription';
    if (role === 'client' && !isSubscription && !['wallet', 'cash_on_delivery'].includes(value.paymentMethod)) {
      if (session?.inTransaction()) await session.abortTransaction();
      return res.status(400).json({ message: 'اختار طريقة الدفع: من المحفظة أو عند الاستلام.' });
    }

    if (product.stock !== null) {
      const reserved = await StoreProduct.findOneAndUpdate(
        { _id: product._id, isActive: true, stock: { $gte: value.quantity } },
        { $inc: { stock: -value.quantity } },
        session ? { new: true, session } : { new: true }
      );
      if (!reserved) {
        if (session?.inTransaction()) await session.abortTransaction();
        return res.status(409).json({ message: 'الكمية المطلوبة غير متاحة حاليًا.' });
      }
      reservedProductId = product._id;
      reservedQuantity = value.quantity;
    }

    const total = Math.round((Number(product.price) * value.quantity + Number.EPSILON) * 100) / 100;
    let paymentMethod = 'غير محدد';
    let paymentStatus = 'غير مدفوع';
    let updatedClient = null;
    let balanceBefore = 0;

    if (role === 'client' && !isSubscription) {
      if (value.paymentMethod === 'cash_on_delivery') {
        paymentMethod = 'عند الاستلام';
      } else {
        const client = await Client.findOne({
          _id: buyer._id, status: 'نشط', walletFrozen: { $ne: true }, walletBalance: { $gte: total }
        }).session(session);
        if (!client) {
          await session.abortTransaction();
          const current = await Client.findById(buyer._id).select('walletBalance walletFrozen').lean();
          return res.status(409).json({
            message: current?.walletFrozen
              ? 'محفظتك مجمدة حاليًا. تقدر تختار الدفع عند الاستلام.'
              : 'رصيد محفظتك غير كافٍ لهذا الطلب. تقدر تختار الدفع عند الاستلام أو تشحن محفظتك.',
            required: total,
            balance: Number(current?.walletBalance || 0),
            canUseCashOnDelivery: true
          });
        }
        balanceBefore = Number(client.walletBalance || 0);
        updatedClient = await Client.findOneAndUpdate(
          { _id: client._id, status: 'نشط', walletFrozen: { $ne: true }, walletBalance: { $gte: total } },
          { $inc: { walletBalance: -total } },
          { new: true, session, runValidators: true }
        );
        if (!updatedClient) {
          await session.abortTransaction();
          return res.status(409).json({ message: 'الرصيد اتغير أثناء تنفيذ الطلب. حدّث الصفحة وحاول مرة تانية، أو اختار الدفع عند الاستلام.', canUseCashOnDelivery: true });
        }
        paymentMethod = 'محفظة العميل';
        paymentStatus = 'مدفوع';
      }
    }

    const order = new StoreOrder({
      product: product._id, productName: product.name, productType: product.type || 'product',
      subscriptionDuration: product.subscriptionDuration || '', unitPrice: product.price,
      quantity: value.quantity, stockReserved: Boolean(reservedProductId), total,
      buyerRole: role, buyerId: buyer._id, buyerName: buyer.name || 'مستخدم',
      buyerPhone: buyer.phone || '', buyerNote: value.note,
      paymentMethod, paymentStatus,
      ...(role === 'client' ? { requestKey: value.idempotencyKey } : {}),
      statusHistory: [{ status: 'جديد', note: 'تم استلام طلب الشراء', by: buyer.name || 'المستخدم' }]
    });
    if (session) await order.save({ session });
    else await order.save();

    if (session && paymentMethod === 'محفظة العميل') {
      await new WalletTransaction({
        client: buyer._id, type: 'client_store_payment', amount: -total,
        balanceBefore, balanceAfter: Number(updatedClient.walletBalance),
        description: 'شراء ' + order.productName + ' من متجر حمزاوي سات',
        idempotencyKey: 'store-order:' + String(order._id)
      }).save({ session });
    }

    if (session) await session.commitTransaction();

    await notifyAdmins({
      type: 'admin_store_order', title: 'طلب شراء جديد',
      message: 'طلب ' + order.productName + ' من ' + order.buyerName + ' بإجمالي ' + order.total + ' جنيه — الدفع: ' + paymentMethod + '.',
      link: '/admin.html?tab=storeOrders', dedupeKey: 'store-order:' + String(order._id)
    });

    return res.status(201).json({
      message: role === 'client'
        ? (isSubscription ? 'تم إرسال طلب الاشتراك أو التجديد للإدارة. هنتواصل معاك لتأكيد التفاصيل وطريقة الدفع.' : paymentMethod === 'محفظة العميل' ? 'تم تأكيد طلبك والدفع من محفظتك بنجاح. الإدارة هتتواصل معاك لتجهيز الطلب.' : 'تم إرسال طلبك بنجاح. الدفع هيكون عند الاستلام، والإدارة هتتواصل معاك لتأكيد التفاصيل.')
        : 'تم إرسال طلب الشراء للإدارة. هنتواصل معاك لتأكيد الطلب وطريقة الدفع.',
      balance: updatedClient ? Number(updatedClient.walletBalance) : undefined,
      order: {
        id: String(order._id), productName: order.productName, quantity: order.quantity,
        total: order.total, status: order.status, paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus, createdAt: order.createdAt
      }
    });
  } catch (error) {
    if (session?.inTransaction()) await session.abortTransaction().catch(() => {});
    if (!session && reservedProductId && reservedQuantity) {
      await StoreProduct.updateOne({ _id: reservedProductId }, { $inc: { stock: reservedQuantity } }).catch(() => {});
    }
    if (error?.code === 11000 && role === 'client' && requestValue?.idempotencyKey) {
      const duplicate = await StoreOrder.findOne({ buyerRole: 'client', buyerId: req.client?._id, requestKey: requestValue.idempotencyKey }).lean().catch(() => null);
      if (duplicate) return res.status(200).json({ message: 'طلب الشراء مسجل بالفعل.', order: { id: String(duplicate._id), productName: duplicate.productName, quantity: duplicate.quantity, total: duplicate.total, status: duplicate.status, paymentMethod: duplicate.paymentMethod, paymentStatus: duplicate.paymentStatus, createdAt: duplicate.createdAt }, duplicate: true });
    }
    return next(error);
  } finally {
    if (session) await session.endSession().catch(() => {});
  }
}

router.post('/client/orders', clientAuth, (req, res, next) => submitOrder(req, res, next, 'client'));
router.post('/fanni/orders', auth('fanni'), (req, res, next) => submitOrder(req, res, next, 'fanni'));

router.get('/client/orders', clientAuth, async (req, res, next) => {
  try {
    const orders = await StoreOrder.find({ buyerRole: 'client', buyerId: req.client._id }).sort({ createdAt: -1 }).limit(100).lean();
    return res.set('Cache-Control', 'no-store').json({ orders });
  } catch (error) { return next(error); }
});
router.get('/fanni/orders', auth('fanni'), async (req, res, next) => {
  try {
    const orders = await StoreOrder.find({ buyerRole: 'fanni', buyerId: req.user._id }).sort({ createdAt: -1 }).limit(100).lean();
    return res.set('Cache-Control', 'no-store').json({ orders });
  } catch (error) { return next(error); }
});

module.exports = router;
