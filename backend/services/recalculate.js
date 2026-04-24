/**
 * CyberCoderCRM - Recalculate Service
 *
 * SODDA ALGORITM:
 * 1. Bugungi UMUMIY mahsulot sonini olish (barcha mahsulotlarning yig'indisi)
 * 2. Har yo'nalish uchun:
 *    - Jami_summa = umumiy_mahsulot × yo'nalish_narxi
 *    - 1 smena = Jami_summa / xodimlar_soni
 *    - Manual bo'lmagan xodim = 1_smena × uning_smenasi + bonus
 *    - Manual bo'lgan xodim = manualAmount (farq qolganlarga bo'linadi)
 */

const DailyAssignment = require('../models/DailyAssignment');
const DailyProduct = require('../models/DailyProduct');

async function recalculateDirection(businessId, directionId, date) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);

  // 1. Shu yo'nalishdagi xodimlar
  const assignments = await DailyAssignment.find({
    businessId,
    directionId,
    date: { $gte: day, $lte: dayEnd },
  });

  if (assignments.length === 0) return;

  // 2. UMUMIY mahsulotlar (bugungi hamma mahsulotlarning yig'indisi)
  const products = await DailyProduct.find({
    businessId,
    date: { $gte: day, $lte: dayEnd },
  });

  const totalQuantity = products.reduce((sum, p) => sum + p.quantity, 0);
  const price = assignments[0].priceSnapshot;

  // 3. Umumiy summa
  const totalAmount = totalQuantity * price;

  // 4. 1 smena narxi (xodimlar soniga bo'linadi)
  const employeeCount = assignments.length;
  const oneShiftPrice = employeeCount > 0 ? totalAmount / employeeCount : 0;

  // 5. Deficit pool (manual kam yozilgan)
  let deficitPool = 0;

  const processed = assignments.map(a => {
    const fairShare = oneShiftPrice * a.shift;

    if (a.isManual && a.manualAmount !== null && a.manualAmount !== undefined) {
      const diff = fairShare - a.manualAmount;
      if (diff > 0) {
        deficitPool += diff;
      }
      return { assignment: a, fairShare, isManual: true };
    }
    return { assignment: a, fairShare, isManual: false };
  });

  // 6. Qolgan xodimlarga deficitni bo'lish
  const nonManualCount = processed.filter(p => !p.isManual).length;
  const bonusPerEmployee = nonManualCount > 0 ? deficitPool / nonManualCount : 0;

  // 7. Yakuniy saqlash
  for (const p of processed) {
    const a = p.assignment;

    if (p.isManual) {
      a.fairShare = p.fairShare;
      a.earning = a.manualAmount;
      a.bonus = 0;
    } else {
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
 * Butun kun uchun - HAMMA yo'nalishlar
 */
async function recalculateDay(businessId, date) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);

  // Shu kungi biriktirilgan yo'nalishlar
  const directionIds = await DailyAssignment.find({
    businessId,
    date: { $gte: day, $lte: dayEnd },
  }).distinct('directionId');

  const results = [];
  for (const directionId of directionIds) {
    const result = await recalculateDirection(businessId, directionId, date);
    if (result) results.push({ directionId, ...result });
  }

  return results;
}

module.exports = {
  recalculateDirection,
  recalculateDay,
};