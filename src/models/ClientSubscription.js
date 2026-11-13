'use strict';
const mongoose = require('mongoose');
const renewalSchema = new mongoose.Schema({
  amount: { type: Number, min: 0, required: true },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  renewedAt: { type: Date, default: Date.now },
  renewedBy: { type: String, trim: true, maxlength: 50, default: 'الإدارة' },
  note: { type: String, trim: true, maxlength: 500, default: '' },
  paymentKey: { type: String, trim: true, maxlength: 150, default: '' }
}, { _id: false });
const clientSubscriptionSchema = new mongoose.Schema({
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'CommerceItem', default: null, index: true },
  itemName: { type: String, required: true, trim: true, maxlength: 100 },
  amount: { type: Number, required: true, min: 0, max: 100000000 },
  durationDays: { type: Number, min: 1, max: 3650, default: 30 },
  status: { type: String, enum: ['pending', 'active', 'paused', 'cancelled', 'expired'], default: 'pending', index: true },
  startsAt: { type: Date, default: null },
  endsAt: { type: Date, default: null, index: true },
  paymentStatus: { type: String, enum: ['unpaid', 'pending', 'paid', 'refunded'], default: 'pending', index: true },
  paymentMethod: { type: String, trim: true, maxlength: 40, default: '' },
  notes: { type: String, trim: true, maxlength: 1000, default: '' },
  history: { type: [renewalSchema], default: [] },
  createdBy: { type: String, trim: true, maxlength: 50, default: 'الإدارة' },
  updatedBy: { type: String, trim: true, maxlength: 50, default: 'الإدارة' }
}, { timestamps: true });
clientSubscriptionSchema.index({ client: 1, status: 1, endsAt: -1 });
clientSubscriptionSchema.index({ status: 1, endsAt: 1 });
module.exports = mongoose.models.ClientSubscription || mongoose.model('ClientSubscription', clientSubscriptionSchema);
