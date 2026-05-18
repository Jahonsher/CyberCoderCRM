/**
 * CyberCoderCRM - Business Model
 * YANGI: enabledWorkTypes - biznes qaysi ish turlarini ishlatadi
 *  - piecework: shtuk (mahsulot soniga qarab)
 *  - daily: kunlik (smenaga belgilangan summa)
 */

const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },
    login: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 50,
    },
    password: {
      type: String,
      required: true,
    },
    logo: {
      type: String,
      default: null,
    },
    defaultLanguage: {
      type: String,
      enum: ['uz-lat', 'uz-cyr', 'ru'],
      default: 'uz-lat',
    },
    note: {
      type: String,
      default: '',
      maxlength: 500,
    },
    enabledModules: {
      type: [String],
      default: [],
    },
    // YANGI: Ish turlari (default: ikkalasi yoqilgan)
    enabledWorkTypes: {
      piecework: { type: Boolean, default: true },
      daily: { type: Boolean, default: true },
    },
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

businessSchema.index({ status: 1 });
businessSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Business || mongoose.model('Business', businessSchema);