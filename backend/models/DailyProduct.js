const mongoose = require('mongoose');

/**
 * DailyProduct Model
 * Kunlik chiqgan mahsulotlar
 *
 * Masalan: "Bugun 50 juft oyoqkiyim chiqdi"
 *
 * MUHIM: Bu butun biznes uchun umumiy (yo'nalishga bog'liq emas)
 * Har kuni 03:00 da avtomatik yangi kun boshlanadi
 * Eski kunlik mahsulotlar arxivga tushganda saqlanadi
 */
const dailyProductSchema = new mongoose.Schema(
  {
    // Qaysi biznesga tegishli
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },

    // Mahsulot nomi
    productName: {
      type: String,
      required: [true, 'Mahsulot nomi kerak'],
      trim: true,
      maxlength: 100,
    },

    // Soni
    quantity: {
      type: Number,
      required: [true, 'Soni kerak'],
      min: [0, 'Soni manfiy bo\'lmasligi kerak'],
    },

    // Qaysi sana uchun
    date: {
      type: Date,
      required: true,
      index: true,
    },

    // Sana string (YYYY-MM-DD)
    dateString: {
      type: String,
      required: true,
      index: true,
    },

    // Izoh (ixtiyoriy)
    note: {
      type: String,
      maxlength: 500,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// ========== INDEXLAR ==========
dailyProductSchema.index({ businessId: 1, dateString: 1 });

// ========== dateString AVTOMATIK YARATISH ==========
dailyProductSchema.pre('save', function (next) {
  if (this.date && !this.dateString) {
    const d = new Date(this.date);
    this.dateString = d.toISOString().split('T')[0];
  }
  next();
});

module.exports = mongoose.model('DailyProduct', dailyProductSchema);