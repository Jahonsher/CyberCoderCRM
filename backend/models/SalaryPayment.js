/**
 * CyberCoderCRM - SalaryPayment Model (v2)
 *
 * Yangi mantiq:
 *  - "Sanagacha to'lash" rejimi: admin xodimning ma'lum sanagacha
 *    bo'lgan jami qoldig'ini bitta SalaryPayment yozuvi sifatida saqlaydi.
 *  - assignmentId endi ixtiyoriy (sanagacha to'lov hech qanday alohida assignmentga
 *    bog'lanmaydi).
 *  - untilDate — qaysi sanagacha bo'lgan ish hisobga olingan.
 *  - snapshot — to'lov vaqtidagi holat: earned, paidBefore, amount.
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
    untilDate: {
      type: String,
      required: true,
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
