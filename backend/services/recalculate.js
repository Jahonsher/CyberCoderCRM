/**
 * CyberCoderCRM - Recalculate Service (v2)
 *
 * Bo'lim turiga qarab har kunni qayta hisoblash:
 *  - ON  bo'lim: bo'lim ichidagi har yo'nalish uchun:
 *      totalAmount    = direction.dailyQuantity * direction.price
 *      totalShifts    = shu yo'nalishga biriktirilgan smenalar yig'indisi
 *      oneShiftPrice  = totalAmount / totalShifts
 *      Manual'lar earning ni qo'lda saqlaydi. Manual olgan summa minus qilinib,
 *      qolgan summa non-manual'lar orasida shift bo'yicha taqsimlanadi.
 *  - OFF bo'lim: department.pricePerUnit dan foydalanadi.
 *      earning = pricePerUnit * productCount * shift  (isManual=false bo'lsa)
 */

const DailyAssignment = require('../models/DailyAssignment');
const DailyQuantity = require('../models/DailyQuantity');
const Department = require('../models/Department');
const Direction = require('../models/Direction');

async function recalculateForDate(businessId, dateStr) {
  if (!businessId || !dateStr) return;

  const assignments = await DailyAssignment.find({ businessId, dateString: dateStr });
  if (assignments.length === 0) return;

  const deptIds = [...new Set(assignments.map(a => String(a.departmentId)))];
  const dirIds = [...new Set(assignments.map(a => a.directionId ? String(a.directionId) : null).filter(Boolean))];

  const [departments, directions, quantities] = await Promise.all([
    Department.find({ _id: { $in: deptIds } }).lean(),
    dirIds.length ? Direction.find({ _id: { $in: dirIds } }).lean() : Promise.resolve([]),
    dirIds.length ? DailyQuantity.find({ businessId, dateString: dateStr, directionId: { $in: dirIds } }).lean() : Promise.resolve([]),
  ]);

  const deptMap = Object.fromEntries(departments.map(d => [String(d._id), d]));
  const dirMap = Object.fromEntries(directions.map(d => [String(d._id), d]));
  const dailyQuantities = Object.fromEntries(quantities.map(q => [String(q.directionId), q.quantity || 0]));

  const bulk = [];

  // OFF bo'lim assignmentlari
  const offAssignments = assignments.filter(a => {
    const d = deptMap[String(a.departmentId)];
    return d && !d.allowDirections;
  });

  for (const a of offAssignments) {
    const dept = deptMap[String(a.departmentId)];
    const price = dept.pricePerUnit || 0;
    const fair = price * (a.productCount || 0);
    let earning = fair;
    let bonus = 0;
    if (a.isManual && a.manualAmount !== null && a.manualAmount !== undefined) {
      earning = a.manualAmount;
      bonus = Math.max(0, a.manualAmount - fair);
    }
    bulk.push({
      updateOne: {
        filter: { _id: a._id },
        update: { $set: { priceSnapshot: price, fairShare: fair, earning, bonus } },
      },
    });
  }

  // ON bo'lim assignmentlari yo'nalish bo'yicha guruh
  const onAssignments = assignments.filter(a => {
    const d = deptMap[String(a.departmentId)];
    return d && d.allowDirections && a.directionId;
  });

  const byDir = {};
  onAssignments.forEach(a => {
    const k = String(a.directionId);
    if (!byDir[k]) byDir[k] = [];
    byDir[k].push(a);
  });

  for (const [dirId, group] of Object.entries(byDir)) {
    const dir = dirMap[dirId];
    if (!dir) continue;

    const price = dir.price || 0;
    const quantity = Number(dailyQuantities[dirId]) || 0;
    const totalAmount = price * quantity;
    const totalShifts = group.reduce((s, a) => s + (a.shift || 0), 0);
    if (totalShifts <= 0) continue;

    const oneShiftFair = totalShifts ? totalAmount / totalShifts : 0;

    const manualOnes = group.filter(a => a.isManual);
    const nonManualOnes = group.filter(a => !a.isManual);

    let manualSum = 0;
    for (const a of manualOnes) {
      const earning = a.manualAmount !== null && a.manualAmount !== undefined ? a.manualAmount : a.earning;
      manualSum += earning;
    }
    const remainForNonManual = Math.max(0, totalAmount - manualSum);
    const nonManualShifts = nonManualOnes.reduce((s, a) => s + (a.shift || 0), 0);
    const oneShiftEffective = nonManualShifts > 0 ? remainForNonManual / nonManualShifts : 0;

    for (const a of manualOnes) {
      const fair = oneShiftFair * (a.shift || 0);
      const earning = a.manualAmount !== null && a.manualAmount !== undefined ? a.manualAmount : a.earning;
      bulk.push({
        updateOne: {
          filter: { _id: a._id },
          update: {
            $set: {
              priceSnapshot: price,
              fairShare: fair,
              earning,
              bonus: Math.max(0, earning - fair),
            },
          },
        },
      });
    }

    for (const a of nonManualOnes) {
      const fair = oneShiftFair * (a.shift || 0);
      const earning = oneShiftEffective * (a.shift || 0);
      bulk.push({
        updateOne: {
          filter: { _id: a._id },
          update: {
            $set: {
              priceSnapshot: price,
              fairShare: fair,
              earning,
              bonus: Math.max(0, earning - fair),
            },
          },
        },
      });
    }
  }

  if (bulk.length > 0) {
    await DailyAssignment.bulkWrite(bulk);
  }
}

module.exports = { recalculateForDate };
