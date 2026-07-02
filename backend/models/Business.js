/**
 * CyberCoderCRM - Business Model (v2)
 *
 * enabledWorkTypes olib tashlandi (piecework/daily ajratish endi yo'q).
 * enabledModules endi yangi keylardan iborat: employees, directions, dailyReport,
 *   monthlyReport, salary, archive.
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
    // Legacy: eski diskdagi logo fayl nomi (backward-compat uchun saqlanadi)
    logo: {
      type: String,
      default: null,
    },
    // Yangi: logo binary sifatida bevosita DB'da (deploy'da yo'qolmaydi)
    logoData: {
      type: Buffer,
      default: null,
      select: false, // og'ir maydon — faqat aniq so'ralganda yuklanadi
    },
    logoType: {
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
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
    },
  },
  { timestamps: true }
);

businessSchema.index({ status: 1 });
businessSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Business || mongoose.model('Business', businessSchema);
