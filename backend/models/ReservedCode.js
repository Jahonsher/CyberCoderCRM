/**
 * CyberCoderCRM - ReservedCode Model
 * TTL index orqali avtomatik o'chiradi
 */

const mongoose = require('mongoose');

const reservedCodeSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
    },
    reservedUntil: {
      type: Date,
      required: true,
      // expires: 0 - reservedUntil vaqti kelganda avtomatik o'chiriladi
      expires: 0,
    },
    employeeData: {
      firstName: String,
      lastName: String,
      phone: String,
    },
  },
  {
    timestamps: true,
  }
);

reservedCodeSchema.index({ businessId: 1, code: 1 });

module.exports = mongoose.models.ReservedCode || mongoose.model('ReservedCode', reservedCodeSchema);