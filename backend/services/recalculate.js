/**
 * CyberCoderCRM - Recalculate Service
 *
 * ALGORITM:
 * 1. 1 smena narxi = umumiy_summa / xodimlar_soni
 * 2. Har xodim adolatli = 1 smena × uning_smenasi
 * 3. Agar manual > adolatli → faqat o'ziga (boshqalarga tegmaydi)
 * 4. Agar manual < adolatli → farq qolganlarga teng bo'linadi
 */

const DailyAssignment = require('../models/DailyAssignment');
const DailyProduct = require('../models/DailyProduct');

/**
 * Yo'nalish + sana uchun qayta hisoblash
 */
async function recalculateDirection(businessId, directionId, date) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);

  // 1. Shu yo'nalishdagi barcha biriktirilgan xodimlar
  const assignments = await DailyAssignment.find({
    businessId,
    directionId,
    date: { $gte: day, $lte: dayEnd },
  });

  if (assignments.length === 0) return;

  // 2. Shu yo'nalish uchun mahsulotlar (barcha mahsulotlarni yig'ish)
  const products = await DailyProduct.find({
    businessId,
    directionId,
    date: { $gte: day, $lte: dayEnd },
  });

  const totalQuantity = products.reduce((sum, p) => sum + p.quantity, 0);
  const price = assignments[0].priceSnapshot;

  // 3. Umumiy summa
  const totalAmount = totalQuantity * price;

  // 4. 1 smena narxi (xodimlar soniga bo'linadi, smenaga qarama)
  const employeeCount = assignments.length;
  const oneShiftPrice = employeeCount > 0 ? totalAmount / employeeCount : 0;

  // 5. Har xodim uchun adolatli ulush
  // Manual bo'lmaganlar uchun: adolatli = oneShiftPrice × shift
  // Manual bo'lganlar: ularning manualAmount

  // Qolgan summa hisoblash (manual kam yozilgan bo'lsa - farq)
  let deficitPool = 0; // Qolgan xodimlarga bo'linadigan summa

  // Birinchi o'tish: manual bo'lganlarni aniqlash, deficit yig'ish
  const processed = assignments.map(a => {
    const fairShare = oneShiftPrice * a.shift;

    if (a.isManual && a.manualAmount !== null && a.manualAmount !== undefined) {
      const diff = fairShare - a.manualAmount;
      if (diff > 0) {
        // Manual kam yozilgan - deficit pool ga qo'shish
        deficitPool += diff;
      }
      // Agar manual ko'p - hech qanday ta'sir, faqat o'ziga
      return { assignment: a, fairShare, isManual: true };
    }
    return { assignment: a, fairShare, isManual: false };
  });

  // Ikkinchi o'tish: qolgan xodimlarga deficit ni bo'lish
  const nonManualCount = processed.filter(p => !p.isManual).length;
  const bonusPerEmployee = nonManualCount > 0 ? deficitPool / nonManualCount : 0;

  // Yakuniy saqlash
  for (const p of processed) {
    const a = p.assignment;

    if (p.isManual) {
      // Manual - faqat manualAmount
      a.fairShare = p.fairShare;
      a.earning = a.manualAmount;
      a.bonus = 0; // Manual xodimlarga bonus yo'q
    } else {
      // Adolatli + bonus
      a.fairShare = p.fairShare;
      a.bonus = bonusPerEmployee;
      a.earning = p.fairShare + bonusPerEmployee;
    }

    await a.save();
  }

  return {
    totalQuantity,
    price,
    totalAmount,
    oneShiftPrice,
    deficitPool,
    bonusPerEmployee,
    assignmentCount: assignments.length,
  };
}

/**
 * Butun sana uchun (barcha yo'nalishlar) qayta hisoblash
 */
async function recalculateDay(businessId, date) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);

  // Barcha yo'nalishlarni topish (bu kungi biriktirilganlar)
  const assignments = await DailyAssignment.find({
    businessId,
    date: { $gte: day, $lte: dayEnd },
  }).distinct('directionId');

  const results = [];
  for (const directionId of assignments) {
    const result = await recalculateDirection(businessId, directionId, date);
    if (result) results.push({ directionId, ...result });
  }

  return results;
}

module.exports = {
  recalculateDirection,
  recalculateDay,
};