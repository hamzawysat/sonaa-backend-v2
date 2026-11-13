'use strict';
const mongoose = require('mongoose');
const statusHistorySchema = new mongoose.Schema({
  status: { type: String, required: true },
  note: { type: String, trim: true, maxlength: 500, default: '' },
  by: { type: String, trim: true, maxlength: 100, default: 'النظام' },
  at: { type: Date, default: Date.now }
}, { _id: false });
const storeOrderSchema = new mongoose.Schema({
  buyerRole: { type: String, enum: ['client', 'fanni'], required: true, index: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null, index: true },
  fanni: { type: mongoose.Schema.Types.ObjectId, ref: 'Fanni', default: null, index: true },
  buyerName: { type: String, required: true, trim: true, maxlength: 100 },
  buyerPhone: { type: String, required: true, trim: true, maxlength: 20 },
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'CommerceItem', required: true, index: true },
  itemName: { type: String, required: true, trim: true, maxlength: 100 },
  sku: { type: String, trim: true, maxlength: 40, default: '' },
  unitPrice: { type: Number, required: true, min: 0, max: 100000000 },
  quantity: { type: Number, required: true, min: 1, max: 1000, default: 1 },
  total: { type: Number, required: true, min: 0, max: 100000000 },
  status: { type: String, enum: ['pending', 'confirmed', 'paid', 'shipped', 'completed', 'cancelled'], default: 'pending', index: true },
  paymentMethod: { type: String, trim: true, maxlength: 60, default: '' },
  notes: { type: String, trim: true, maxlength: 1000, default: '' },
  requestKey: { type: String, trim: true, maxlength: 150, default: undefined },
  stockDeducted: { type: Boolean, default: false },
  statusHistory: { type: [statusHistorySchema], default: [] }
}, { timestamps: true });
storeOrderSchema.index({ buyerRole: 1, client: 1, createdAt: -1 });
storeOrderSchema.index({ buyerRole: 1, fanni: 1, createdAt: -1 });
storeOrderSchema.index({ buyerRole: 1, requestKey: 1 }, { unique: true, partialFilterExpression: { requestKey: { $type: 'string' } } });
module.exports = mongoose.models.StoreOrder || mongoose.model('StoreOrder', storeOrderSchema);
