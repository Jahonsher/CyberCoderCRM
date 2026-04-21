/**
 * CyberCoderCRM - Archive Model
 */

const mongoose = require('mongoose');

const archiveSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    periodLabel: {
      type: String,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    archivedAt: {
      type: Date,
      default: Date.now,
    },
    data: {
      assignments: { type: Array, default: [] },
      products: { type: Array, default: [] },
    },
    stats: {
      totalEarnings: { type: Number, default: 0 },
      totalEmployeesWorked: { type: Number, default: 0 },
      totalShifts: { type: Number, default: 0 },
      totalProducts: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

archiveSchema.index({ businessId: 1, startDate: -1 });

module.exports = mongoose.models.Archive || mongoose.model('Archive', archiveSchema);
