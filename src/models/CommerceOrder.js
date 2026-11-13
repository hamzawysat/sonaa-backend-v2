'use strict';
const mongoose = require('mongoose');
const commerceOrderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true, index: true },
  buyerRole: { type: String, enum: ['client','fanni'], required: true, index: true },
  buyer: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  buyerName: { type: String, trim: true, maxlength: 100, default: '' },
  buyerPhone: { type: String, trim: true, maxlength: 20, default: '' },
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'CommerceItem', required: true, index: true },
  itemName: { type: String, required: true, trim: true, maxlength: 100 },
  sku: { type: String, trim: true, maxlength: 40, default: '' },
  unitPrice: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1, max: 1000, default: 1 },
  total: { type: Number, required: true, min: 0 },
  buyerNote: { type: String, trim: true, maxlength: 500, default: '' },
  status: { type: String, enum: ['pending','contacted','confirmed','completed','cancelled'], default: 'pending', index: true },
  paymentMethod: { type: String, enum: ['cash_on_delivery','transfer','pending'], default: 'pending' },
  adminNote: { type: String, trim: true, maxlength: 1000, default: '' },
  statusHistory: [{ status: String, note: String, changedBy: String, at: { type: Date, default: Date.now } }]
}, { timestamps: true });
commerceOrderSchema.index({ buyerRole: 1, buyer: 1, createdAt: -1 });
module.exports = mongoose.models.CommerceOrder || mongoose.model('CommerceOrder', commerceOrderSchema);
