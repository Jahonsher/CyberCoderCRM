/**
 * CyberCoderCRM - DailyAssignment Model (v2)
 *
 * Yangi mantiq:
 *  - departmentId majburiy (xodim qaysi bo'limda ishlagani).
 *  - directionId — faqat ON-bo'lim uchun (allowDirections=true).
 *  - productCount — OFF-bo'lim uchun: xodim necha mahsulot tayyorlagan.
 *  - type/dailyAmount olib tashlandi — endi faqat piecework (ON va OFF varianti).
 *
 *  dateString = "YYYY-MM-DD" — timezone safe asosiy kalit.
 */

const mongoose = require('mongoose');

const dailyAssignmentSchema = new mongoose.Schema(
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
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
    directionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Direction',
      default: null,
    },
    dateString: {
      type: String,
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    shift: {
      type: Number,
      required: true,
      enum: [0.5, 1],
      default: 1,
    },
    productCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    priceSnapshot: {
      type: Number,
      required: true,
      default: 0,
    },
    earning: {
      type: Number,
      required: true,
      default: 0,
    },
    fairShare: {
      type: Number,
      default: 0,
    },
    bonus: {
      type: Number,
      default: 0,
    },
    isManual: {
      type: Boolean,
      default: false,
    },
    manualAmount: {
      type: Number,
      default: null,
    },
    isProductManual: {
      type: Boolean,
      default: false,
    },
    employeeSnapshot: {
      fullName: String,
      code: String,
    },
    departmentSnapshot: {
      name: String,
      allowDirections: Boolean,
      pricePerUnit: Number,
    },
    directionSnapshot: {
      name: String,
      price: Number,
    },
    // --- Yangi: tanlangan kunlar bo'yicha to'lov mantiqi ---
    // paid: shu kun uchun ish haqi to'langanmi (admin checkbox orqali tanladi)
    paid: { type: Boolean, default: false, index: true },
    // paymentId: qaysi SalaryPayment yozuvi bu kunni "to'lagan"
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SalaryPayment',
      default: null,
    },
    // paidAt: to'lov qachon amalga oshirilgan
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

dailyAssignmentSchema.index(
  { businessId: 1, employeeId: 1, dateString: 1 },
  { unique: true }
);
dailyAssignmentSchema.index({ businessId: 1, dateString: -1 });
dailyAssignmentSchema.index({ businessId: 1, departmentId: 1, dateString: 1 });
dailyAssignmentSchema.index({ businessId: 1, directionId: 1, dateString: 1 });
// Yangi: to'lanmagan kunlarni tezroq topish uchun compound index
dailyAssignmentSchema.index({ businessId: 1, employeeId: 1, paid: 1 });

module.exports = mongoose.models.DailyAssignment || mongoose.model('DailyAssignment', dailyAssignmentSchema);
