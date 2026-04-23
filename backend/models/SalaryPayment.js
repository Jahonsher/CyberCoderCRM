/**
 * CyberCoderCRM - Salary Payment Model
 * Oylik to'lovlar tarixi
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
    // Snapshot (xodim keyin o'chirilsa ham saqlanadi)
    employeeSnapshot: {
      firstName: String,
      lastName: String,
      code: String,
    },
    // Qaysi oy uchun (masalan 2026-04 — aprel 2026)
    periodMonth: {
      type: String,
      required: true,
      index: true,
    },
    // Diapazon
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAt: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Bir xodim bitta oy uchun faqat bir marta olishi mumkin
salaryPaymentSchema.index(
  { businessId: 1, employeeId: 1, periodMonth: 1 },
  { unique: true }
);
salaryPaymentSchema.index({ businessId: 1, paidAt: -1 });

module.exports = mongoose.models.SalaryPayment || mongoose.model('SalaryPayment', salaryPaymentSchema);