/**
 * CyberCoderCRM - Business Model
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
      unique: true,  // unique o'zi index yaratadi
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

// FAQAT QO'SHIMCHA indexes (login yo'q — u unique orqali qo'shiladi)
businessSchema.index({ status: 1 });
businessSchema.index({ createdAt: -1 });

// OverwriteModelError ni oldini olish (hot-reload uchun)
module.exports = mongoose.models.Business || mongoose.model('Business', businessSchema);