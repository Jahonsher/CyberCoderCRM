/**
 * CyberCoderCRM - Employee Model (v2)
 *
 * Yangi mantiq:
 *  - firstName + lastName → fullName (bitta string).
 *  - departmentId majburiy. Har xodim faqat 1 bo'limga tegishli.
 *  - code biznesda unique-ish (runtime tekshiriladi + ReservedCode logikasi saqlanadi).
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
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
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
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

employeeSchema.index({ businessId: 1, code: 1 });
employeeSchema.index({ businessId: 1, departmentId: 1, status: 1 });

module.exports = mongoose.models.Employee || mongoose.model('Employee', employeeSchema);
