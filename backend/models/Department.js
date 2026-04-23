/**
 * CyberCoderCRM - Department Model
 * Bo'limlar (Yozgi stanoklar, Qishki stanoklar va h.k.)
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
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

departmentSchema.index({ businessId: 1, status: 1 });

module.exports = mongoose.models.Department || mongoose.model('Department', departmentSchema);