/**
 * CyberCoderCRM - Department Model (v2)
 *
 * Yangi mantiq:
 *  - allowDirections: true  → ON  bo'lim, ichida yo'nalishlar bo'ladi (filter).
 *                              Kunlik hisobotda admin umumiy mahsulot sonini kiritadi,
 *                              har yo'nalish narxi bo'yicha xodimlarga taqsimlanadi.
 *  - allowDirections: false → OFF bo'lim, yo'nalish yo'q. Bo'limning o'zida narx bor.
 *                              Har xodim qo'lda kiritilgan productCount × pricePerUnit oladi.
 *  - budget: bo'lim doirasida xodimlarga jami berilishi mumkin bo'lgan summa (cheklov).
 */

const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      default: '',
      maxlength: 500,
    },
    allowDirections: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },
    budget: {
      type: Number,
      default: 0,
      min: 0,
    },
    pricePerUnit: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

departmentSchema.index({ businessId: 1, allowDirections: 1 });
departmentSchema.index({ businessId: 1, name: 1 });

module.exports = mongoose.models.Department || mongoose.model('Department', departmentSchema);
