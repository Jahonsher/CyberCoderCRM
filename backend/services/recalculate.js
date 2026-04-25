/**
 * CyberCoderCRM - Recalculate Service
 *
 * SODDA ALGORITM:
 * 1. UMUMIY mahsulot sonini olish
 * 2. Har yo'nalish uchun:
 *    - FAQAT piecework (shtuk) xodimlarni hisoblash
 *    - Kunlik xodim shtuk hisobiga aralashmaydi
 * 3. Kunlik xodim daromadi = dailyAmount × shift
 */

const DailyAssignment = require('../models/DailyAssignment');
const DailyProduct = require('../models/DailyProduct');

async function recalculateDirection(businessId, directionId, date) {
  const day = new Date(date);
  day.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setUTCHours(23, 59, 59, 999);

  // 1. Shu yo'nalishdagi BARCHA xodimlar (piecework + daily)
  const allAssignments = await DailyAssignment.find({
    businessId,
    directionId,
    date: { $gte: day, $lte: dayEnd },
  });

  if (allAssignments.length === 0) return;

  // 2. Kunlik xodimlarni darhol hisoblash (alohida)
  const dailyAssignments = allAssignments.filter(a => a.type === 'daily');
  for (const a of dailyAssignments) {
    const baseAmount = (a.dailyAmount || 0) * a.shift;
    if (a.isManual && a.manualAmount !== null && a.manualAmount !== undefined) {
      a.earning = a.manualAmount;
    } else {
      a.earning = baseAmount;
    }
    a.fairShare = baseAmount;
    a.bonus = 0;
    await a.save();
  }

  // 3. Piecework xodimlar (asosiy logika)
  const pieceworkAssignments = allAssignments.filter(a => a.type !== 'daily');
  if (pieceworkAssignments.length === 0) return;

  // 4. Umumiy mahsulot
  const products = await DailyProduct.find({
    businessId,
    date: { $gte: day, $lte: dayEnd },
  });

  const totalQuantity = products.reduce((sum, p) => sum + p.quantity, 0);
  const price = pieceworkAssignments[0].priceSnapshot;

  // 5. Umumiy summa
  const totalAmount = totalQuantity * price;

  // 6. 1 smena narxi (faqat piecework xodimlar soniga bo'linadi)
  const employeeCount = pieceworkAssignments.length;
  const oneShiftPrice = employeeCount > 0 ? totalAmount / employeeCount : 0;

  // 7. Deficit pool
  let deficitPool = 0;

  const processed = pieceworkAssignments.map(a => {
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

  const nonManualCount = processed.filter(p => !p.isManual).length;
  const bonusPerEmployee = nonManualCount > 0 ? deficitPool / nonManualCount : 0;

  // 8. Saqlash
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
    pieceworkCount: pieceworkAssignments.length,
    dailyCount: dailyAssignments.length,
  };
}

async function recalculateDay(businessId, date) {
  const day = new Date(date);
  day.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setUTCHours(23, 59, 59, 999);

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