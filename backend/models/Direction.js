/**
 * CyberCoderCRM - Direction Model (v2)
 *
 * Yangi mantiq:
 *  - Direction faqat ON-bo'limda (department.allowDirections=true) bo'ladi.
 *  - type maydoni olib tashlandi (faqat piecework qoldi).
 *  - price = 1 birlik mahsulot uchun narx (per dona).
 *  - Eski pieceworkPrice/dailyPrice/currentPrice fieldlari yo'q.
 */

const mongoose = require('mongoose');

const directionSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    price: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    priceHistory: [{
      price: { type: Number, required: true },
      changedAt: { type: Date, default: Date.now },
    }],
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

directionSchema.index({ businessId: 1, departmentId: 1, isArchived: 1 });

module.exports = mongoose.models.Direction || mongoose.model('Direction', directionSchema);
