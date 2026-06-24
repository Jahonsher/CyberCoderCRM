/**
 * CyberCoderCRM - Distribute OFF production
 *
 * OFF-bo'lim uchun: kunlik umumiy mahsulot sonini biriktirilgan xodimlarga teng bo'lib chiqish.
 *  - isProductManual=true bo'lganlar saqlanadi (qo'lda kiritilgan).
 *  - Qolgan summa (quantity - manualSum) non-manual xodimlar orasida teng taqsimlanadi.
 */

const DailyAssignment = require('../models/DailyAssignment');
const DailyProduction = require('../models/DailyProduction');
const Department = require('../models/Department');

async function distributeOff(businessId, departmentId, dateStr) {
  if (!businessId || !departmentId || !dateStr) return;

  const dept = await Department.findOne({ _id: departmentId, businessId }).lean();
  if (!dept || dept.allowDirections) return;

  const production = await DailyProduction.findOne({
    businessId,
    departmentId,
    dateString: dateStr,
  }).lean();
  const quantity = production?.quantity || 0;

  const assignments = await DailyAssignment.find({
    businessId,
    departmentId,
    dateString: dateStr,
  });
  if (assignments.length === 0) return;

  const manualOnes = assignments.filter(a => a.isProductManual);
  const nonManualOnes = assignments.filter(a => !a.isProductManual);

  const manualSum = manualOnes.reduce((s, a) => s + (a.productCount || 0), 0);
  const remaining = Math.max(0, quantity - manualSum);
  const perEach = nonManualOnes.length > 0 ? Math.floor(remaining / nonManualOnes.length) : 0;

  const bulk = nonManualOnes.map(a => ({
    updateOne: {
      filter: { _id: a._id },
      update: { $set: { productCount: perEach } },
    },
  }));

  if (bulk.length > 0) {
    await DailyAssignment.bulkWrite(bulk);
  }
}

module.exports = { distributeOff };
