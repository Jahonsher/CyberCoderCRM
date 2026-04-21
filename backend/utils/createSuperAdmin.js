/**
 * CyberCoderCRM - SuperAdmin avtomatik yaratish
 * Server start bo'lganda ishga tushadi
 */

const bcrypt = require('bcryptjs');
const SuperAdmin = require('../models/SuperAdmin');

async function createSuperAdmin() {
  try {
    const username = (process.env.SUPER_USERNAME || '').trim().toLowerCase();
    const password = process.env.SUPER_PASSWORD;

    if (!username || !password) {
      console.warn('⚠️  SUPER_USERNAME yoki SUPER_PASSWORD env da yo\'q');
      return;
    }

    // Mavjud SuperAdmin ni qidirish
    const existing = await SuperAdmin.findOne({ username });

    if (existing) {
      // Parol .env dagi bilan taqqoslash
      const isMatch = await bcrypt.compare(password, existing.password);

      if (!isMatch) {
        // Parol o'zgargan — DB'ni yangilash
        const newHash = await bcrypt.hash(password, 10);
        existing.password = newHash;
        await existing.save();
        console.log(`🔄 SuperAdmin paroli yangilandi: ${username}`);
      } else {
        console.log(`✅ SuperAdmin mavjud: ${username}`);
      }
      return;
    }

    // Yangi SuperAdmin yaratish
    const hashedPassword = await bcrypt.hash(password, 10);

    await SuperAdmin.create({
      username,
      password: hashedPassword,
    });

    console.log('========================================');
    console.log('🎉 SUPERADMIN YARATILDI');
    console.log(`👤 Username: ${username}`);
    console.log('========================================');
  } catch (err) {
    console.error('❌ SuperAdmin yaratishda xato:', err.message);
    // Xatoni throw qilmaymiz, server ishga tushaversin
  }
}

module.exports = createSuperAdmin;