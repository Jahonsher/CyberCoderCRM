/**
 * CyberCoderCRM - DailyAssignment Model
 * Endi 2 xil xodim:
 *  - piecework (shtuk) - mahsulot soniga qarab oladi
 *  - daily (kunlik) - alohida belgilangan summa oladi
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
    // YANGI: ish turi
    type: {
      type: String,
      enum: ['piecework', 'daily'],
      default: 'piecework',
    },
    // Kunlik xodim uchun belgilangan summa
    dailyAmount: {
      type: Number,
      default: 0,
    },
    priceSnapshot: {
      type: Number,
      required: true,
    },
    // Yakuniy daromad
    earning: {
      type: Number,
      required: true,
      default: 0,
    },
    // Adolatli ulush (faqat piecework uchun)
    fairShare: {
      type: Number,
      default: 0,
    },
    // Bonus (faqat piecework uchun)
    bonus: {
      type: Number,
      default: 0,
    },
    // Manual o'zgartirilganmi?
    isManual: {
      type: Boolean,
      default: false,
    },
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