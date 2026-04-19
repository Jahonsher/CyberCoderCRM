const mongoose = require('mongoose');

/**
 * Archive Model
 * Arxivlangan ma'lumotlar - to'liq snapshot
 *
 * MANTIQ:
 * - Admin oylik hisobotdan filter tanlaydi (masalan 01.03.2026 - 07.03.2026)
 * - "Arxivlash" tugmasini bosadi
 * - Shu davrdagi BARCHA ma'lumotlar bitta "snapshot" qilib saqlanadi:
 *   - Xodimlar va ularning daromadlari
 *   - Kunlik biriktirishlar
 *   - Kunlik mahsulotlar
 * - Arxiv qachon (sana + soat) yaratilgani ko'rinadi
 * - Faqat o'qish uchun (read-only)
 */
const archiveSchema = new mongoose.Schema(
  {
    // Qaysi biznesga tegishli
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },

    // Arxivlangan davr
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },

    // Davr nomi (display uchun, masalan "05.02.2026 - 11.02.2026")
    periodLabel: {
      type: String,
      required: true,
    },

    // Arxivlangan vaqt (aniq sana + soat)
    archivedAt: {
      type: Date,
      default: Date.now,
    },

    // Xodimlar bo'yicha umumiy hisobot
    // [{ employeeId, firstName, lastName, code, totalEarning, totalDays, totalShifts }]
    employeeSummary: [
      {
        employeeId: { type: mongoose.Schema.Types.ObjectId },
        firstName: String,
        lastName: String,
        code: String,
        totalEarning: { type: Number, default: 0 },
        totalDays: { type: Number, default: 0 },
        totalShifts: { type: Number, default: 0 },
      },
    ],

    // Barcha kunlik biriktirishlar (batafsil)
    assignments: [
      {
        employeeId: mongoose.Schema.Types.ObjectId,
        employeeSnapshot: {
          firstName: String,
          lastName: String,
          code: String,
        },
        directionId: mongoose.Schema.Types.ObjectId,
        directionSnapshot: {
          name: String,
        },
        priceSnapshot: Number,
        shift: Number,
        earning: Number,
        date: Date,
        dateString: String,
      },
    ],

    // Kunlik mahsulotlar
    products: [
      {
        productName: String,
        quantity: Number,
        date: Date,
        dateString: String,
        note: String,
      },
    ],

    // Jami statistika
    stats: {
      totalEarnings: { type: Number, default: 0 },
      totalAssignments: { type: Number, default: 0 },
      totalEmployeesWorked: { type: Number, default: 0 },
      totalProducts: { type: Number, default: 0 },
      totalProductQuantity: { type: Number, default: 0 },
    },

    // Kim arxivladi
    archivedBy: {
      type: String,
      default: 'admin',
    },
  },
  {
    timestamps: true,
  }
);

// ========== INDEXLAR ==========
archiveSchema.index({ businessId: 1, archivedAt: -1 });
archiveSchema.index({ businessId: 1, periodStart: 1, periodEnd: 1 });

module.exports = mongoose.model('Archive', archiveSchema);