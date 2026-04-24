/**
 * CyberCoderCRM - DailyAssignment Model
 * Endi fairShare, bonus, isManual bilan
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
    directionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Direction',
      required: true,
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
    priceSnapshot: {
      type: Number,
      required: true,
    },
    // Asosiy - yakuniy daromad (barcha hisoblashlardan keyin)
    earning: {
      type: Number,
      required: true,
      default: 0,
    },
    // Adolatli ulush (formuladan chiqadigan narx)
    fairShare: {
      type: Number,
      default: 0,
    },
    // Qo'shimcha (yashil +X)
    bonus: {
      type: Number,
      default: 0,
    },
    // Admin qo'lda o'zgartirganmi?
    isManual: {
      type: Boolean,
      default: false,
    },
    // Admin qo'lda yozgan qiymat (isManual=true bo'lsa)
    manualAmount: {
      type: Number,
      default: null,
    },
    employeeSnapshot: {
      firstName: String,
      lastName: String,
      code: String,
    },
    directionSnapshot: {
      name: String,
      departmentName: String,
    },
  },
  {
    timestamps: true,
  }
);

dailyAssignmentSchema.index(
  { businessId: 1, employeeId: 1, date: 1 },
  { unique: true }
);
dailyAssignmentSchema.index({ businessId: 1, date: -1 });
dailyAssignmentSchema.index({ businessId: 1, directionId: 1, date: 1 });

module.exports = mongoose.models.DailyAssignment || mongoose.model('DailyAssignment', dailyAssignmentSchema);