
'use strict';

const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
  fanni: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Fanni',
    default: null,
    index: true
  },

  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null, index: true },

  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null,
    index: true
  },

  orderSN: {
    type: String,
    trim: true,
    maxlength: 20,
    default: ''
  },

  type: {
    type: String,
    enum: ['commission', 'topup', 'admin_adjustment', 'refund', 'client_topup', 'client_admin_adjustment', 'client_admin_deduction', 'client_admin_settlement', 'client_service_payment', 'client_subscription_payment', 'client_refund', 'client_escrow_hold', 'client_escrow_release', 'technician_settlement'],
    required: true,
    index: true
  },

  amount: {
    type: Number,
    required: true,
    validate: {
      validator: Number.isFinite,
      message: 'قيمة الحركة يجب أن تكون رقمًا صحيحًا'
    }
  },

  balanceBefore: {
    type: Number,
    required: true,
    min: 0
  },

  balanceAfter: {
    type: Number,
    required: true,
    min: 0
  },

  description: {
    type: String,
    trim: true,
    maxlength: 500,
    required: true
  },

  // يمنع تسجيل نفس الخصم مرتين.
  idempotencyKey: {
    type: String,
    required: true,
    unique: true,
    index: true,
    maxlength: 150
  },

  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  versionKey: false
});

walletTransactionSchema.index({
  fanni: 1,
  createdAt: -1
});

walletTransactionSchema.index({ order: 1, type: 1 });
walletTransactionSchema.index({ client: 1, createdAt: -1 });
walletTransactionSchema.pre('validate', function () {
  if (Boolean(this.fanni) === Boolean(this.client)) this.invalidate('client', 'يجب تحديد مالك واحد للحركة المالية');
});

module.exports = mongoose.model(
  'WalletTransaction',
  walletTransactionSchema
);
