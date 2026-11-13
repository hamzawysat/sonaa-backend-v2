'use strict';
const mongoose = require('mongoose');
const commerceItemSchema = new mongoose.Schema({
  kind: { type: String, enum: ['subscription', 'product'], required: true, default: 'subscription', index: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 1500, default: '' },
  price: { type: Number, required: true, min: 0, max: 100000000 },
  currency: { type: String, trim: true, maxlength: 8, default: 'EGP' },
  durationDays: { type: Number, min: 1, max: 3650, default: null },
  features: [{ type: String, trim: true, maxlength: 180 }],
  sku: { type: String, trim: true, uppercase: true, maxlength: 40, default: '' },
  active: { type: Boolean, default: true, index: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });
commerceItemSchema.index({ kind: 1, active: 1, createdAt: -1 });
module.exports = mongoose.models.CommerceItem || mongoose.model('CommerceItem', commerceItemSchema);
