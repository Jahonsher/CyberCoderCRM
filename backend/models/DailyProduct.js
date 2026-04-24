/**
 * CyberCoderCRM - DailyProduct Model
 * Umumiy mahsulot - barcha yo'nalishlar shu sonni ishlatadi
 */

const mongoose = require('mongoose');

const dailyProductSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    // directionId - qoladi (eski data uchun), lekin ishlatilmaydi
    directionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Direction',
      required: false,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    directionSnapshot: {
      name: String,
      price: Number,
    },
  },
  {
    timestamps: true,
  }
);

dailyProductSchema.index({ businessId: 1, date: -1 });

module.exports = mongoose.models.DailyProduct || mongoose.model('DailyProduct', dailyProductSchema);