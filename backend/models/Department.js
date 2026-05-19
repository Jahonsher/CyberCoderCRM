/**
 * CyberCoderCRM - Department Model
 * YANGI: type field qo'shildi - har bo'lim 'piecework' yoki 'daily' ga tegishli
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
    // YANGI: Bo'lim turi
    type: {
      type: String,
      enum: ['piecework', 'daily'],
      default: 'piecework',
      index: true,
    },
    directionCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

departmentSchema.index({ businessId: 1, type: 1 });

module.exports = mongoose.models.Department || mongoose.model('Department', departmentSchema);