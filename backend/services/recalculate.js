/**
 * CyberCoderCRM - Recalculate Service
 * Endi: kunlik xodim daromadi yo'nalishning dailyPrice'idan olinadi
 */

const DailyAssignment = require('../models/DailyAssignment');
const DailyProduct = require('../models/DailyProduct');
const Direction = require('../models/Direction');

async function recalculateDirection(businessId, directionId, dateStr) {
  const allAssignments = await DailyAssignment.find({
    businessId,
    directionId,
    dateString: dateStr,
  });

  if (allAssignments.length === 0) return;

  // Yo'nalishni olamiz - kunlik narxi uchun
  const direction = await Direction.findById(directionId);
  const dailyPrice = direction?.dailyPrice || 0;
  const pieceworkPrice = direction?.pieceworkPrice || direction?.currentPrice || 0;

  // 1. Kunlik xodimlar
  const dailyAssignments = allAssignments.filter(a => a.type === 'daily');
  for (const a of dailyAssignments) {
    // Yo'nalishdagi kunlik narxni ishlatamiz
    const baseAmount = dailyPrice * a.shift;
    a.dailyAmount = dailyPrice; // yangilash
    if (a.isManual && a.manualAmount !== null && a.manualAmount !== undefined) {
      a.earning = a.manualAmount;
    } else {
      a.earning = baseAmount;
    }
    a.fairShare = baseAmount;
    a.bonus = 0;
    await a.save();
  }

  // 2. Piecework xodimlar
  const pieceworkAssignments = allAssignments.filter(a => a.type !== 'daily');
  if (pieceworkAssignments.length === 0) return;

  const products = await DailyProduct.find({
    businessId,
    dateString: dateStr,
  });

  const totalQuantity = products.reduce((sum, p) => sum + p.quantity, 0);
  const totalAmount = totalQuantity * pieceworkPrice;

  const employeeCount = pieceworkAssignments.length;
  const oneShiftPrice = employeeCount > 0 ? totalAmount / employeeCount : 0;

  let deficitPool = 0;
  const processed = pieceworkAssignments.map(a => {
    const fairShare = oneShiftPrice * a.shift;
    if (a.isManual && a.manualAmount !== null && a.manualAmount !== undefined) {
      const diff = fairShare - a.manualAmount;
      if (diff > 0) deficitPool += diff;
      return { assignment: a, fairShare, isManual: true };
    }
    return { assignment: a, fairShare, isManual: false };
  });

  const nonManualCount = processed.filter(p => !p.isManual).length;
  const bonusPerEmployee = nonManualCount > 0 ? deficitPool / nonManualCount : 0;

  for (const p of processed) {
    const a = p.assignment;
    a.priceSnapshot = pieceworkPrice;
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
    totalQuantity, pieceworkPrice, totalAmount, oneShiftPrice,
    deficitPool, bonusPerEmployee,
    pieceworkCount: pieceworkAssignments.length,
    dailyCount: dailyAssignments.length,
  };
}

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

module.exports = { recalculateDirection, recalculateDay };