const cron = require('node-cron');
const DailyAssignment = require('../models/DailyAssignment');
const DailyProduct = require('../models/DailyProduct');

/**
 * Kunlik Reset Cron Job
 *
 * Har kuni soat 03:00 da ishga tushadi:
 * - Kechagi va oldingi kunlarga qarab hech narsa o'chirilmaydi (ular DB da saqlanadi)
 * - Lekin YANGI KUN boshlanadi degan ma'noda, admin panelida:
 *   - "Biriktirilgan xodimlar" ro'yxati bo'sh ko'rinadi (bugun uchun)
 *   - "Biriktirilmagan xodimlar" ga hamma qaytadi
 *   - Kunlik mahsulot ro'yxati bo'sh ko'rinadi (bugun uchun)
 *
 * Bu - DailyAssignment va DailyProduct collection'larida ma'lumotlar
 * sana bo'yicha saqlanganligi uchun avtomatik ishlaydi.
 * Kunlik hisobot endpoint'i faqat BUGUNGI sana uchun ma'lumot qaytaradi.
 *
 * Bu cron job shunchaki log chiqaradi va statistika yig'adi.
 */

/**
 * Bugungi sana string (YYYY-MM-DD)
 */
const getTodayString = () => {
  return new Date().toISOString().split('T')[0];
};

/**
 * Kechagi sana string
 */
const getYesterdayString = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
};

/**
 * Reset ish
 */
const performDailyReset = async () => {
  const startTime = Date.now();
  console.log('========================================');
  console.log('🌅 KUNLIK RESET BOSHLANDI (03:00)');
  console.log(`📅 Sana: ${new Date().toLocaleString('uz-UZ')}`);

  try {
    const yesterday = getYesterdayString();
    const today = getTodayString();

    // Kechagi kunlik statistika
    const yesterdayAssignments = await DailyAssignment.countDocuments({
      dateString: yesterday,
    });

    const yesterdayProducts = await DailyProduct.countDocuments({
      dateString: yesterday,
    });

    const yesterdayEarnings = await DailyAssignment.aggregate([
      { $match: { dateString: yesterday } },
      { $group: { _id: null, total: { $sum: '$earning' } } },
    ]);

    const totalEarning = yesterdayEarnings[0]?.total || 0;

    console.log('📊 KECHAGI KUN STATISTIKASI:');
    console.log(`   • Biriktirishlar: ${yesterdayAssignments}`);
    console.log(`   • Mahsulotlar: ${yesterdayProducts}`);
    console.log(`   • Jami daromad: ${totalEarning.toLocaleString()} so'm`);

    console.log(`✅ Yangi kun ochildi: ${today}`);

    const duration = Date.now() - startTime;
    console.log(`⏱️  Davomiyligi: ${duration}ms`);
    console.log('========================================');
  } catch (err) {
    console.error('❌ Kunlik reset xatosi:', err);
  }
};

/**
 * Cron job start
 * Format: 'soniya daqiqa soat kun oy haftakun'
 * '0 0 3 * * *' = har kuni soat 03:00:00
 */
const start = () => {
  // Har kuni soat 03:00
  cron.schedule('0 0 3 * * *', performDailyReset, {
    timezone: 'Asia/Tashkent',
  });

  console.log('⏰ Kunlik Reset Cron faol: har kuni 03:00 (Asia/Tashkent)');
};

/**
 * Qo'lda ishga tushirish (test uchun)
 */
const runNow = async () => {
  console.log('🔧 Qo\'lda reset boshlanmoqda...');
  await performDailyReset();
};

module.exports = {
  start,
  runNow,
  performDailyReset,
};