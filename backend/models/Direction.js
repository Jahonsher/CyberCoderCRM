const mongoose = require('mongoose');

/**
 * Direction Model
 * Yo'nalishlar - ish turlari
 * Har yo'nalish JORIY narxga ega (kunlik narx)
 *
 * MUHIM: Narx o'zgarganda - eski kunlarga ta'sir qilmaydi
 * Chunki DailyAssignment da narx SNAPSHOT qilib saqlanadi
 */
const directionSchema = new mongoose.Schema(
  {
    // Qaysi biznesga tegishli
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },

    // Yo'nalish turi (masalan "Oyoqkiyim yig'ish")
    name: {
      type: String,
      required: [true, 'Yo\'nalish nomi kerak'],
      trim: true,
      maxlength: 100,
    },

    // Joriy kunlik narx (1 smena uchun)
    // 0.5 smena = narxning yarmi
    currentPrice: {
      type: Number,
      required: [true, 'Kunlik narx kerak'],
      min: [0, 'Narx manfiy bo\'lmasligi kerak'],
    },

    // Narx o'zgarish tarixi (audit uchun)
    priceHistory: [
      {
        price: { type: Number, required: true },
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: String, default: 'admin' },
      },
    ],

    // Status
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

// ========== INDEXLAR ==========
directionSchema.index({ businessId: 1, status: 1 });
directionSchema.index({ businessId: 1, name: 1 });

// ========== NARX O'ZGARGANDA TARIXGA YOZISH ==========
directionSchema.pre('save', function (next) {
  // Yangi yo'nalish bo'lsa - birinchi narxni history ga qo'shish
  if (this.isNew) {
    this.priceHistory.push({
      price: this.currentPrice,
      changedAt: new Date(),
    });
  }
  // Narx o'zgartirilgan bo'lsa
  else if (this.isModified('currentPrice')) {
    this.priceHistory.push({
      price: this.currentPrice,
      changedAt: new Date(),
    });
  }

  next();
});

module.exports = mongoose.model('Direction', directionSchema);