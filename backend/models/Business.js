const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { getDefaultModules } = require('../config/modules');

/**
 * Business Model
 * SuperAdmin tomonidan yaratilgan bizneslar
 * Har bir biznes o'z admin login/parolga ega
 * Har bir biznes o'zining yoqilgan modullariga ega (enabledModules)
 */
const businessSchema = new mongoose.Schema(
  {
    // Asosiy ma'lumotlar
    name: {
      type: String,
      required: [true, 'Biznes nomi kerak'],
      trim: true,
      maxlength: [100, 'Biznes nomi 100 belgidan oshmasligi kerak'],
    },
    phone: {
      type: String,
      required: [true, 'Telefon raqam kerak'],
      trim: true,
      maxlength: 20,
    },

    // Login ma'lumotlari
    login: {
      type: String,
      required: [true, 'Login kerak'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Login kamida 3 belgi bo\'lishi kerak'],
      maxlength: 50,
    },
    password: {
      type: String,
      required: [true, 'Parol kerak'],
      minlength: [6, 'Parol kamida 6 belgi bo\'lishi kerak'],
      select: false,
    },

    // Logo
    logo: {
      type: String,
      default: null,
    },

    // Status
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
    },

    // Eslatma
    note: {
      type: String,
      maxlength: 500,
      default: '',
    },

    // Default til
    defaultLanguage: {
      type: String,
      enum: ['uz-lat', 'uz-cyr', 'ru'],
      default: 'uz-lat',
    },

    // ⭐ YOQILGAN MODULLAR (SuperAdmin boshqaradi)
    enabledModules: {
      type: [String],
      default: () => getDefaultModules(),
    },
  },
  {
    timestamps: true,
  }
);

// ========== INDEXLAR ==========
businessSchema.index({ status: 1 });
// Note: login index allaqachon unique: true tufayli avtomatik yaratilgan

// ========== PAROLNI HASH QILISH ==========
businessSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// ========== PAROL SOLISHTIRISH ==========
businessSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// ========== JSON da parolni olib tashlash ==========
businessSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

// ========== MODUL YOQILGANMI TEKSHIRISH ==========
businessSchema.methods.hasModule = function (moduleKey) {
  return this.enabledModules && this.enabledModules.includes(moduleKey);
};

module.exports = mongoose.model('Business', businessSchema);