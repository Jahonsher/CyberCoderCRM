/**
 * CyberCoderCRM - Recalculate Service (v3)
 *
 * Kunlik narx modeli:
 *  - ON  bo'lim: direction.price = bir kunlik narx.
 *      fairShare = direction.price * shift
 *      earning   = isManual ? manualAmount : fairShare
 *  - OFF bo'lim: department.pricePerUnit (mahsulot uchun).
 *      fairShare = pricePerUnit * productCount
 *      earning   = isManual ? manualAmount : fairShare
 */

const DailyAssignment = require('../models/DailyAssignment');
const Department = require('../models/Department');
const Direction = require('../models/Direction');

async function recalculateForDate(businessId, dateStr) {
  if (!businessId || !dateStr) return;

  const assignments = await DailyAssignment.find({ businessId, dateString: dateStr });
  if (assignments.length === 0) return;

  const deptIds = [...new Set(assignments.map(a => String(a.departmentId)))];
  const dirIds = [...new Set(assignments.map(a => a.directionId ? String(a.directionId) : null).filter(Boolean))];

  const [departments, directions] = await Promise.all([
    Department.find({ _id: { $in: deptIds } }).lean(),
    dirIds.length ? Direction.find({ _id: { $in: dirIds } }).lean() : Promise.resolve([]),
  ]);

  const deptMap = Object.fromEntries(departments.map(d => [String(d._id), d]));
  const dirMap = Object.fromEntries(directions.map(d => [String(d._id), d]));

  const bulk = [];

  for (const a of assignments) {
    const dept = deptMap[String(a.departmentId)];
    if (!dept) continue;

    let price = 0;
    let fair = 0;
    if (dept.allowDirections) {
      const dir = a.directionId ? dirMap[String(a.directionId)] : null;
      price = dir ? (dir.price || 0) : 0;
      fair = price * (a.shift || 0);
    } else {
      price = dept.pricePerUnit || 0;
      fair = price * (a.productCount || 0);
    }

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

  if (bulk.length > 0) {
    await DailyAssignment.bulkWrite(bulk);
  }
}

module.exports = { recalculateForDate };
