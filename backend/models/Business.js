const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Business Model
 * SuperAdmin tomonidan yaratilgan bizneslar
 * Har bir biznes o'z admin login/parolga ega
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

    // Login ma'lumotlari (admin uchun)
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
      select: false, // default query da qaytmaydi
    },

    // Logo (fayl nomi, /uploads/ ichida)
    logo: {
      type: String,
      default: null, // yo'q bo'lsa - biznes nomining birinchi harfi
    },

    // Status
    status: {
      type: String,
      enum: ['active', 'suspended'],
      default: 'active',
    },

    // SuperAdmin eslatmasi (ixtiyoriy)
    note: {
      type: String,
      maxlength: 500,
      default: '',
    },

    // Til (default admin interface uchun)
    defaultLanguage: {
      type: String,
      enum: ['uz-lat', 'uz-cyr', 'ru'],
      default: 'uz-lat',
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

// ========== INDEXLAR ==========
businessSchema.index({ login: 1 });
businessSchema.index({ status: 1 });

// ========== PAROLNI HASH QILISH ==========
businessSchema.pre('save', async function (next) {
  // Faqat parol o'zgartirilgan bo'lsa hash qiladi
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

// ========== JSON ga o'zgartirishda parolni olib tashlash ==========
businessSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('Business', businessSchema);