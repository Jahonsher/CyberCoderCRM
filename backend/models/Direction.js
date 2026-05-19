/**
 * CyberCoderCRM - Direction Model
 * YANGI: Har yo'nalish FAQAT BITTA tur (piecework yoki daily)
 * Eski pieceworkEnabled/dailyEnabled/pieceworkPrice/dailyPrice OLIB TASHLANDI
 * Endi: type + price
 */

const mongoose = require('mongoose');

const directionSchema = new mongoose.Schema(
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
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    // YANGI: Yo'nalish turi - piecework (dona) yoki daily (kunlik)
    type: {
      type: String,
      enum: ['piecework', 'daily'],
      required: true,
      default: 'piecework',
      index: true,
    },

    // YANGI: Bitta narx (piecework => so'm/dona, daily => so'm/smena)
    price: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ESKI - backward compat (eski yozuvlarni o'qish uchun)
    currentPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    pieceworkEnabled: { type: Boolean, default: undefined },
    pieceworkPrice: { type: Number, default: undefined },
    dailyEnabled: { type: Boolean, default: undefined },
    dailyPrice: { type: Number, default: undefined },

    priceHistory: [{
      price: { type: Number, required: true },
      changedAt: { type: Date, default: Date.now },
    }],

    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archivedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

directionSchema.index({ businessId: 1, departmentId: 1, type: 1, isArchived: 1 });
directionSchema.index({ businessId: 1, type: 1, isArchived: 1 });

// Auto-migration: eski fieldlarni yangiga aylantirish
directionSchema.pre('save', function(next) {
  // Agar yangi 'price' yo'q bo'lsa - eskidan olamiz
  if ((this.price === undefined || this.price === 0) && this.currentPrice > 0) {
    this.price = this.currentPrice;
  }
  if ((this.price === undefined || this.price === 0) && this.pieceworkPrice > 0) {
    this.price = this.pieceworkPrice;
    if (!this.type) this.type = 'piecework';
  }
  if ((this.price === undefined || this.price === 0) && this.dailyPrice > 0) {
    this.price = this.dailyPrice;
    if (!this.type) this.type = 'daily';
  }

  // currentPrice ni saqlash backward compat uchun
  if (this.price > 0) {
    this.currentPrice = this.price;
  }

  next();
});

module.exports = mongoose.models.Direction || mongoose.model('Direction', directionSchema);