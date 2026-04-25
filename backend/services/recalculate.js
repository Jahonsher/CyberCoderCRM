/**
 * CyberCoderCRM - Recalculate Service
 * dateString (YYYY-MM-DD) bilan ishlaydi
 */

const DailyAssignment = require('../models/DailyAssignment');
const DailyProduct = require('../models/DailyProduct');

/**
 * Yo'nalish + sana uchun qayta hisoblash
 * dateStr - "YYYY-MM-DD" string
 */
async function recalculateDirection(businessId, directionId, dateStr) {
  // 1. Shu yo'nalishdagi BARCHA xodimlar
  const allAssignments = await DailyAssignment.find({
    businessId,
    directionId,
    dateString: dateStr,
  });

  if (allAssignments.length === 0) return;

  // 2. Kunlik xodimlarni alohida hisoblash
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

  // 3. Piecework xodimlar
  const pieceworkAssignments = allAssignments.filter(a => a.type !== 'daily');
  if (pieceworkAssignments.length === 0) return;

  // 4. Umumiy mahsulot (shu kun uchun)
  const products = await DailyProduct.find({
    businessId,
    dateString: dateStr,
  });

  const totalQuantity = products.reduce((sum, p) => sum + p.quantity, 0);
  const price = pieceworkAssignments[0].priceSnapshot;

  // 5. Umumiy summa
  const totalAmount = totalQuantity * price;

  // 6. 1 smena narxi
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

/**
 * Butun kun uchun
 */
async function recalculateDay(businessId, dateStr) {
  const directionIds = await DailyAssignment.find({
    businessId,
    dateString: dateStr,
  }).distinct('directionId');

  const results = [];
  for (const directionId of directionIds) {
    const result = await recalculateDirection(businessId, directionId, dateStr);
    if (result) results.push({ directionId, ...result });
  }

  return results;
}

module.exports = {
  recalculateDirection,
  recalculateDay,
};