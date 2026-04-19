const mongoose = require('mongoose');

/**
 * DailyAssignment Model
 * Kunlik biriktirish: qaysi xodim qaysi yo'nalishga biriktirilgan
 *
 * ASOSIY MANTIQ:
 * - Xodim yo'nalishga biriktirilganda, yo'nalishning JORIY narxi shu yerga SNAPSHOT qilib saqlanadi
 * - Keyinchalik yo'nalish narxi o'zgarsa ham, bu record eski narxda qoladi
 * - Daromad = priceSnapshot × shift (1 yoki 0.5)
 *
 * Bu - oyda xodim qancha ishlagan va qancha topganligini to'g'ri hisoblash uchun
 */
const dailyAssignmentSchema = new mongoose.Schema(
  {
    // Qaysi biznesga tegishli
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },

    // Xodim
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },

    // Xodim ma'lumotlari (SNAPSHOT - keyin xodim o'chirilsa ham qolsin)
    employeeSnapshot: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      code: { type: String, required: true },
    },

    // Yo'nalish
    directionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Direction',
      required: true,
    },

    // Yo'nalish ma'lumotlari (SNAPSHOT)
    directionSnapshot: {
      name: { type: String, required: true },
    },

    // Narx SNAPSHOT (o'sha kundagi yo'nalish narxi)
    // Bu qiymat keyin hech qachon o'zgarmaydi!
    priceSnapshot: {
      type: Number,
      required: [true, 'Narx snapshot kerak'],
      min: 0,
    },

    // Smena: 1 = to'liq, 0.5 = yarim (kech kelgan)
    shift: {
      type: Number,
      required: true,
      enum: [0.5, 1],
      default: 1,
    },

    // Hisoblangan daromad = priceSnapshot × shift
    earning: {
      type: Number,
      required: true,
      min: 0,
    },

    // Qaysi sana uchun
    date: {
      type: Date,
      required: true,
      index: true,
    },

    // Sana string (YYYY-MM-DD) - qidiruv uchun qulay
    dateString: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// ========== INDEXLAR ==========
// Bitta xodim bitta kunda bitta biriktirish
dailyAssignmentSchema.index(
  { businessId: 1, employeeId: 1, dateString: 1 },
  { unique: true }
);

// Sana bo'yicha tez qidirish
dailyAssignmentSchema.index({ businessId: 1, dateString: 1 });

// Kod bo'yicha qidirish (oylik hisobot uchun)
dailyAssignmentSchema.index({ businessId: 1, 'employeeSnapshot.code': 1, date: 1 });

// ========== SAQLASH OLDIDAN DAROMADNI HISOBLASH ==========
dailyAssignmentSchema.pre('save', function (next) {
  // Daromad = narx × smena
  this.earning = this.priceSnapshot * this.shift;

  // dateString ni yaratish (YYYY-MM-DD)
  if (this.date && !this.dateString) {
    const d = new Date(this.date);
    this.dateString = d.toISOString().split('T')[0];
  }

  next();
});

module.exports = mongoose.model('DailyAssignment', dailyAssignmentSchema);