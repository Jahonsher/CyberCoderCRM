const mongoose = require('mongoose');

/**
 * ReservedCode Model
 * Band qilingan kodlar
 *
 * MANTIQ:
 * - Xodim o'chirilganda, uning kodi darhol bo'shamaydi
 * - Kod o'sha oyning oxirigacha BAND bo'lib qoladi
 * - Bu - yangi xodim bilan eski xodimning ish hisobi aralashib ketmasligi uchun
 * - Oy tugagach avtomatik bo'shaydi (yoki cron job orqali)
 *
 * Misol:
 * - 15-mart da xodim ishdan ketdi, kod "A123"
 * - 31-mart gacha bu kod band
 * - 1-aprel dan yangi xodimga berish mumkin
 */
const reservedCodeSchema = new mongoose.Schema(
  {
    // Qaysi biznesga tegishli
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },

    // Band qilingan kod
    code: {
      type: String,
      required: true,
      trim: true,
    },

    // Qaysi xodim uchun band qilingan
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },

    // Xodim ma'lumotlari (tarix uchun)
    employeeSnapshot: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
    },

    // Qachongacha band (oy oxirigi sana)
    reservedUntil: {
      type: Date,
      required: true,
      index: true,
    },

    // Qachon band qilindi
    reservedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// ========== INDEXLAR ==========
// Biznes + kod bo'yicha tez tekshirish
reservedCodeSchema.index({ businessId: 1, code: 1 });

// TTL index - reservedUntil o'tganda avtomatik o'chiriladi
// (MongoDB har daqiqada tekshirib turadi)
reservedCodeSchema.index({ reservedUntil: 1 }, { expireAfterSeconds: 0 });

// ========== STATIC METHOD: KOD BAND MI? ==========
reservedCodeSchema.statics.isCodeReserved = async function (businessId, code) {
  const reserved = await this.findOne({
    businessId,
    code,
    reservedUntil: { $gt: new Date() },
  });
  return !!reserved;
};

// ========== STATIC METHOD: KODNI BAND QILISH ==========
reservedCodeSchema.statics.reserveCode = async function (employee) {
  // Joriy oyning oxirgi kuni
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  return await this.create({
    businessId: employee.businessId,
    code: employee.code,
    employeeId: employee._id,
    employeeSnapshot: {
      firstName: employee.firstName,
      lastName: employee.lastName,
    },
    reservedUntil: endOfMonth,
  });
};

module.exports = mongoose.model('ReservedCode', reservedCodeSchema);