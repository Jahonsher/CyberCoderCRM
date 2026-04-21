/**
 * CyberCoderCRM - Employee Model
 */

const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 20,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'deleted'],
      default: 'active',
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index: bir biznesda kod noyob bo'lishi
employeeSchema.index({ businessId: 1, code: 1 });
employeeSchema.index({ businessId: 1, status: 1 });

module.exports = mongoose.models.Employee || mongoose.model('Employee', employeeSchema);
