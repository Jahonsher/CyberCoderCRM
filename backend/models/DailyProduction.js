/**
 * CyberCoderCRM - DailyProduction Model
 *
 * OFF-bo'lim uchun bir kunda tayyorlangan umumiy mahsulot soni.
 *  - Bir bo'lim + bir kun uchun bitta yozuv (upsert).
 *  - quantity > 0 bo'lsa, biriktirilgan xodimlarga teng bo'linadi (distributeOff).
 */

const mongoose = require('mongoose');

const dailyProductionSchema = new mongoose.Schema(
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
    dateString: {
      type: String,
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  { timestamps: true }
);

dailyProductionSchema.index(
  { businessId: 1, departmentId: 1, dateString: 1 },
  { unique: true }
);

module.exports = mongoose.models.DailyProduction || mongoose.model('DailyProduction', dailyProductionSchema);
