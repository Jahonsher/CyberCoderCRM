/**
 * CyberCoderCRM - SalaryPayment Model (v3)
 *
 * Yangi mantiq (tanlangan kunlar rejimi):
 *  - Admin checkbox orqali bir nechta KUN tanlaydi va shu kunlar uchun
 *    bitta SalaryPayment yozuvi yaratiladi.
 *  - paidDates — to'langan kunlar ro'yxati: ["YYYY-MM-DD", ...]
 *  - monthKey — eng oxirgi to'langan sananing oyi ("YYYY-MM"). Arxivda
 *    oyga guruhlash uchun ishlatiladi.
 *  - amount — tanlangan kunlardagi earning yig'indisi.
 *
 * Backward compatibility:
 *  - Eski yozuvlar (v2) untilDate orqali bitta sanagacha to'lov edi.
 *    Ularda paidDates = [], monthKey = '' bo'ladi. Arxiv routerida
 *    monthKey bo'lmasa untilDate.slice(0,7) fallback ishlatiladi.
 *  - untilDate endi MAJBURIY EMAS — yangi yozuvlarda u max(paidDates)
 *    sifatida saqlanadi (eski qidiruv/index-larni buzmaslik uchun).
 */

const mongoose = require('mongoose');

const salaryPaymentSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    // Eski yozuvlar uchun saqlanib qoldi. Yangi yozuvlarda
    // max(paidDates) qiymati avtomatik beriladi.
    untilDate: {
      type: String,
      required: false,
      default: '',
      index: true,
    },
    // Yangi: tanlangan kunlar ro'yxati ("YYYY-MM-DD" formatda)
    paidDates: {
      type: [String],
      default: [],
    },
    // Yangi: arxivda oy bo'yicha guruhlash uchun. Eng oxirgi to'langan
    // sananing oyi ("YYYY-MM"). Eski yozuvlarda bo'sh — arxivda fallback bor.
    monthKey: {
      type: String,
      default: '',
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    note: {
      type: String,
      default: '',
      maxlength: 500,
    },
    employeeSnapshot: {
      fullName: String,
      code: String,
    },
    snapshot: {
      earningTillDate: { type: Number, default: 0 },
      paidBefore: { type: Number, default: 0 },
      remainingBefore: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

salaryPaymentSchema.index({ businessId: 1, employeeId: 1, paidAt: -1 });
salaryPaymentSchema.index({ businessId: 1, paidAt: -1 });

module.exports = mongoose.models.SalaryPayment || mongoose.model('SalaryPayment', salaryPaymentSchema);
