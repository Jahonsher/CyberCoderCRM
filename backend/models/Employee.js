const mongoose = require('mongoose');

/**
 * Employee Model
 * Har bir biznesning xodimlari
 * businessId orqali tenant isolation
 */
const employeeSchema = new mongoose.Schema(
  {
    // Qaysi biznesga tegishli
    businessId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },

    // Asosiy ma'lumotlar
    firstName: {
      type: String,
      required: [true, 'Ism kerak'],
      trim: true,
      maxlength: 50,
    },
    lastName: {
      type: String,
      required: [true, 'Familiya kerak'],
      trim: true,
      maxlength: 50,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 20,
      default: '',
    },

    // Unique kod (biznes ichida)
    // Harflar, raqamlar, symbol - SuperAdmin xohlagandek
    code: {
      type: String,
      required: [true, 'Kod kerak'],
      trim: true,
      maxlength: 50,
    },

    // Status
    status: {
      type: String,
      enum: ['active', 'deleted'],
      default: 'active',
    },

    // Agar o'chirilgan bo'lsa - qachon
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ========== INDEXLAR ==========
// Bir biznes ichida kod unique bo'lishi kerak (faqat active xodimlar uchun)
employeeSchema.index(
  { businessId: 1, code: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' },
  }
);

// Ism bo'yicha qidiruv uchun
employeeSchema.index({ businessId: 1, firstName: 1, lastName: 1 });

// Status bo'yicha filtr
employeeSchema.index({ businessId: 1, status: 1 });

// ========== VIRTUAL: to'liq ism ==========
employeeSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`.trim();
});

employeeSchema.set('toJSON', { virtuals: true });
employeeSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Employee', employeeSchema);