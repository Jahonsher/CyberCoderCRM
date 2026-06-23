/**
 * CyberCoderCRM - DailyQuantity Model (v2)
 *
 * ON bo'limning yo'nalishlari uchun har kunlik mahsulot soni.
 *  - Faqat ON-bo'limda ishlatiladi.
 *  - Bir yo'nalish + bir kun uchun bitta yozuv (upsert).
 *  - recalculate.js shu yerdan oladi.
 */

const mongoose = require('mongoose');

const dailyQuantitySchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    directionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Direction',
      required: true,
      index: true,
    },
    dateString: {
      type: String,
      required: true,
      index: true,
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

dailyQuantitySchema.index(
  { businessId: 1, directionId: 1, dateString: 1 },
  { unique: true }
);

module.exports = mongoose.models.DailyQuantity || mongoose.model('DailyQuantity', dailyQuantitySchema);
