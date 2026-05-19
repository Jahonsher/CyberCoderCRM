/**
 * CyberCoderCRM - Recalculate Service
 *
 * Piecework yo'nalishlar:
 *   umumiy_summa = umumiy_mahsulot × yo'nalish_narxi
 *   1_smena_narx = umumiy_summa / xodimlar_smena_yig'indisi
 *   xodim_pul = 1_smena_narx × shift
 *
 *   Manual override: xodim qo'lda kiritsa, isManual=true bo'ladi.
 *   - Manual amount < fair_share => deficit -> manual bo'lmagan xodimlarga bonus
 *   - Manual amount > fair_share => faqat o'sha xodim oladi
 *
 * Daily yo'nalishlar:
 *   xodim_pul = direction.price × shift (smena 0.5 yoki 1)
 *   Manual qo'lda kiritilganda - shu summa
 */

const DailyAssignment = require('../models/DailyAssignment');
const DailyProduct = require('../models/DailyProduct');
const Direction = require('../models/Direction');

async function recalculateForDate(businessId, dateStr) {
  if (!businessId || !dateStr) return;

  // 1) Barcha biriktirishlar
  const assignments = await DailyAssignment.find({
    businessId,
    dateString: dateStr,
  });

  if (assignments.length === 0) return;

  // 2) Mahsulotlar (faqat piecework hisoblash uchun)
  const products = await DailyProduct.find({ businessId, dateString: dateStr });
  const totalQuantity = products.reduce((s, p) => s + (p.quantity || 0), 0);

  // 3) Yo'nalishlar ID'lari - narxlarni olamiz
  const directionIds = [...new Set(assignments.map(a => String(a.directionId)))];
  const directions = await Direction.find({
    _id: { $in: directionIds },
  }).lean();
  const directionMap = {};
  directions.forEach(d => {
    directionMap[String(d._id)] = d;
  });

  // ===========================================
  // DAILY assignments - har biri alohida
  // ===========================================
  const dailyAssignments = assignments.filter(a => a.type === 'daily');
  for (const a of dailyAssignments) {
    const direction = directionMap[String(a.directionId)];
    if (!direction) continue;

    const dailyPrice = direction.price || direction.currentPrice || direction.dailyPrice || 0;
    const baseAmount = dailyPrice * a.shift;

    a.priceSnapshot = dailyPrice;

    // Manual qo'lda kiritilgan bo'lsa, ushlab qolamiz
    if (!a.isManual) {
      a.earning = baseAmount;
    }
    a.fairShare = baseAmount;
    a.bonus = 0;

    await a.save();
  }

  // ===========================================
  // PIECEWORK assignments - umumiy hisoblash
  // ===========================================
  const pieceworkAssignments = assignments.filter(a => a.type === 'piecework' || (!a.type && !a.directionSnapshot?.type));

  if (pieceworkAssignments.length > 0) {
    // Piecework bo'lim uchun umumiy narx (har bir yo'nalishning narxi × o'sha yo'nalishdagi shift yig'indisi)
    // EMAS - bizning logikamiz: barcha piecework xodimlarga umumiy puldan teng taqsimlash

    // Aslida har yo'nalishning narxi har xil. Lekin oldingi logika "umumiy puldan" edi
    // Demak biz har xodimga unga tegishli yo'nalish narxida hisoblaymiz, lekin
    // fairShare = (totalQuantity * direction.price) / totalShiftsForThatDirection
    // bo'lishi kerak

    // Yo'nalishlar bo'yicha guruh
    const groupsByDirection = {};
    pieceworkAssignments.forEach(a => {
      const did = String(a.directionId);
      if (!groupsByDirection[did]) groupsByDirection[did] = [];
      groupsByDirection[did].push(a);
    });

    for (const [dirId, group] of Object.entries(groupsByDirection)) {
      const direction = directionMap[dirId];
      if (!direction) continue;

      const pieceworkPrice = direction.price || direction.currentPrice || direction.pieceworkPrice || 0;

      // Umumiy summa shu yo'nalish uchun = umumiy_mahsulot × narx
      const totalAmount = totalQuantity * pieceworkPrice;

      // Shu yo'nalishdagi umumiy shift
      const totalShifts = group.reduce((s, a) => s + (a.shift || 0), 0);
      if (totalShifts <= 0) continue;

      // 1 smena narxi
      const oneShiftPrice = totalAmount / totalShifts;

      // Manual va non-manual ajratish
      const manualOnes = group.filter(a => a.isManual);
      const nonManualOnes = group.filter(a => !a.isManual);

      // Manual xodimlar fair share dan ortig'ini olganmi yoki kamini?
      let totalManualEarning = 0;
      let totalManualFairShare = 0;
      manualOnes.forEach(a => {
        const fairShare = oneShiftPrice * (a.shift || 0);
        a.fairShare = fairShare;
        a.priceSnapshot = pieceworkPrice;
        const manualAmount = a.manualAmount !== undefined && a.manualAmount !== null ? a.manualAmount : a.earning;
        totalManualEarning += manualAmount;
        totalManualFairShare += fairShare;
      });

      // Manual'lardan qolgan summa non-manual'larga
      const remainingForNonManual = totalAmount - totalManualEarning;
      const totalNonManualShifts = nonManualOnes.reduce((s, a) => s + (a.shift || 0), 0);

      let newOneShiftPriceForNonManual = 0;
      if (totalNonManualShifts > 0) {
        newOneShiftPriceForNonManual = Math.max(0, remainingForNonManual) / totalNonManualShifts;
      }

      // Manual xodimlarga - manual amount
      for (const a of manualOnes) {
        const manualAmount = a.manualAmount !== undefined && a.manualAmount !== null ? a.manualAmount : a.earning;
        a.earning = manualAmount;
        const fairShare = oneShiftPrice * (a.shift || 0);
        a.fairShare = fairShare;
        a.bonus = Math.max(0, manualAmount - fairShare); // ortiq olgani
        await a.save();
      }

      // Non-manual xodimlarga - qaytadan hisoblangan summa
      for (const a of nonManualOnes) {
        const fairShare = oneShiftPrice * (a.shift || 0);
        const newEarning = newOneShiftPriceForNonManual * (a.shift || 0);
        a.earning = newEarning;
        a.fairShare = fairShare;
        a.bonus = Math.max(0, newEarning - fairShare); // manual'lardan kelgan bonus
        a.priceSnapshot = pieceworkPrice;
        await a.save();
      }
    }
  }
}

module.exports = { recalculateForDate };