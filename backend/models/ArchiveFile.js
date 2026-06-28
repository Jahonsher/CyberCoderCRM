/**
 * CyberCoderCRM - ArchiveFile Model
 *
 * Excel eksport tarixi. Har eksport diskka saqlanadi va shu yerda metadata
 * sifatida ro'yxatga olinadi. Foydalanuvchi keyinroq yuklab olishi yoki
 * o'chirishi mumkin.
 */

const mongoose = require('mongoose');

const archiveFileSchema = new mongoose.Schema(
  {
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['employees', 'dailyReport', 'monthlyReport', 'salary'],
      required: true,
      index: true,
    },
    subType: {
      type: String,
      default: '',
    },
    language: {
      type: String,
      enum: ['uz-lat', 'uz-cyr', 'ru'],
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    displayName: {
      type: String,
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    rowCount: {
      type: Number,
      default: 0,
    },
    dateFrom: {
      type: String,
      default: null,
    },
    dateTo: {
      type: String,
      default: null,
    },
    generatedBy: {
      type: String,
      default: '',
    },
    generatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

archiveFileSchema.index({ businessId: 1, category: 1, generatedAt: -1 });

module.exports =
  mongoose.models.ArchiveFile || mongoose.model('ArchiveFile', archiveFileSchema);
