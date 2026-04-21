/**
 * CyberCoderCRM - ReservedCode Model
 * Xodim o'chirilganda uning kodi oy oxirigacha band qilinadi
 * TTL index orqali avtomatik o'chiriladi
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
      // TTL index - avtomatik o'chiradi (expires qachon kelganda)
      // Faqat shu yerda bitta marta aniqlaymiz
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

// Kompozit index (businessId + code birgalikda)
reservedCodeSchema.index({ businessId: 1, code: 1 });

module.exports = mongoose.model('ReservedCode', reservedCodeSchema);