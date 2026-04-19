/**
 * SuperAdmin avtomatik yaratish
 *
 * Tizim birinchi marta ishga tushganda SuperAdmin yo'qligini tekshiradi.
 * Agar yo'q bo'lsa - .env dan SUPER_USERNAME va SUPER_PASSWORD ni oladi
 * va SuperAdminni yaratadi.
 *
 * SuperAdmin ma'lumotlari MongoDB da alohida collection'da saqlanadi
 * (businesses collection'idan alohida)
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * SuperAdmin Schema
 * Faqat 1 ta yozuv bo'ladi odatda
 */
const superAdminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Parol hash
superAdminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Parol solishtirish
superAdminSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const SuperAdmin = mongoose.model('SuperAdmin', superAdminSchema);

/**
 * SuperAdmin ni yaratish yoki yangilash
 */
const createSuperAdmin = async () => {
  try {
    const username = process.env.SUPER_USERNAME;
    const password = process.env.SUPER_PASSWORD;

    if (!username || !password) {
      console.warn('⚠️  SUPER_USERNAME yoki SUPER_PASSWORD .env da yo\'q!');
      return;
    }

    // Mavjud SuperAdminni qidirish
    const existing = await SuperAdmin.findOne({ username: username.toLowerCase() });

    if (existing) {
      console.log(`✅ SuperAdmin mavjud: ${username}`);

      // .env da parol o'zgartirilgan bo'lsa - yangilash
      const isSamePassword = await existing.comparePassword(password);
      if (!isSamePassword) {
        existing.password = password; // pre-save hash qiladi
        await existing.save();
        console.log('🔐 SuperAdmin paroli yangilandi (.env dan)');
      }

      return;
    }

    // Yangi SuperAdmin yaratish
    const superAdmin = await SuperAdmin.create({
      username: username.toLowerCase(),
      password,
    });

    console.log('========================================');
    console.log('🎉 SUPERADMIN YARATILDI');
    console.log(`👤 Username: ${superAdmin.username}`);
    console.log('🔑 Parol: (.env da SUPER_PASSWORD)');
    console.log('========================================');
  } catch (err) {
    console.error('❌ SuperAdmin yaratishda xato:', err.message);
  }
};

// Model ni export qilish (auth routes da kerak bo'ladi)
createSuperAdmin.SuperAdmin = SuperAdmin;

module.exports = createSuperAdmin;