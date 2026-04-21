/**
 * CyberCoderCRM - DailyAssignment Model
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
    earning: {
      type: Number,
      required: true,
    },
    employeeSnapshot: {
      firstName: String,
      lastName: String,
      code: String,
    },
    directionSnapshot: {
      name: String,
    },
  },
  {
    timestamps: true,
  }
);

// Bir xodim bir kunda faqat bir marta
dailyAssignmentSchema.index(
  { businessId: 1, employeeId: 1, date: 1 },
  { unique: true }
);
dailyAssignmentSchema.index({ businessId: 1, date: -1 });

module.exports = mongoose.models.DailyAssignment || mongoose.model('DailyAssignment', dailyAssignmentSchema);