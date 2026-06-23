/**
 * CyberCoderCRM - Daily Report (v2)
 *
 * Bo'lim bo'yicha kunlik biriktirish. ON va OFF bo'lim:
 *  - ON  bo'lim: directionId majburiy. POST /quantity bilan umumiy mahsulot soni kiritiladi.
 *  - OFF bo'lim: directionId yo'q. productCount per-xodim kiritiladi (assign yoki PUT).
 *
 * Kelajak sana mumkin emas. Tashkent UTC+5 timezone.
 */

const express = require('express');
const router = express.Router();

const DailyAssignment = require('../models/DailyAssignment');
const DailyQuantity = require('../models/DailyQuantity');
const Department = require('../models/Department');
const Direction = require('../models/Direction');
const Employee = require('../models/Employee');

const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');
const requireModule = require('../middleware/requireModule');
const { recalculateForDate } = require('../services/recalculate');

router.use(verifyToken, requireAdmin, businessScope, requireModule('dailyReport'));

function todayDateString() {
  const now = new Date();
  const tashkent = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  return tashkent.toISOString().split('T')[0];
}

function parseDateString(s) {
  if (!s || typeof s !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

/**
 * GET /api/daily-report?date=YYYY-MM-DD&departmentId=<id>
 * Bo'lim tanlangan bo'lsa shu bo'limning xodimlari + biriktirishlari + yo'nalishlari.
 * Bo'lim tanlanmagan bo'lsa faqat barcha bo'limlar ro'yxati.
 */
router.get('/', async (req, res) => {
  try {
    const dateStr = parseDateString(req.query.date) || todayDateString();
    if (dateStr > todayDateString()) {
      return res.status(400).json({ error: 'Kelajakdagi kun mumkin emas' });
    }

    const { departmentId } = req.query;

    if (!departmentId) {
      const departments = await Department.find({ businessId: req.businessId }).sort('name').lean();
      return res.json({ dateStr, departments, department: null, directions: [], assigned: [], unassigned: [], quantities: {}, stats: {} });
    }

    const dept = await Department.findOne({ _id: departmentId, businessId: req.businessId }).lean();
    if (!dept) return res.status(404).json({ error: "Bo'lim topilmadi" });

    const [directions, employees, assigned, quantities] = await Promise.all([
      dept.allowDirections
        ? Direction.find({ businessId: req.businessId, departmentId, isArchived: { $ne: true } }).sort('name').lean()
        : Promise.resolve([]),
      Employee.find({ businessId: req.businessId, departmentId, status: { $ne: 'deleted' } }).sort('fullName').lean(),
      DailyAssignment.find({ businessId: req.businessId, departmentId, dateString: dateStr }).sort('-createdAt').lean(),
      dept.allowDirections
        ? DailyQuantity.find({ businessId: req.businessId, dateString: dateStr, directionId: { $in: [] } }).lean()
        : Promise.resolve([]),
    ]);

    // Quantities ni yo'nalishlar bo'yicha to'g'ri olish
    let quantityMap = {};
    if (dept.allowDirections && directions.length > 0) {
      const qDocs = await DailyQuantity.find({
        businessId: req.businessId,
        dateString: dateStr,
        directionId: { $in: directions.map(d => d._id) },
      }).lean();
      quantityMap = Object.fromEntries(qDocs.map(q => [String(q.directionId), q.quantity]));
    }

    const assignedIds = new Set(assigned.map(a => String(a.employeeId)));
    const unassigned = employees.filter(e => !assignedIds.has(String(e._id)));

    const totalEarning = assigned.reduce((s, a) => s + (a.earning || 0), 0);

    res.json({
      dateStr,
      department: dept,
      directions,
      assigned,
      unassigned,
      quantities: quantityMap,
      stats: {
        totalAssigned: assigned.length,
        totalUnassigned: unassigned.length,
        totalEarning,
      },
    });
  } catch (err) {
    console.error('Daily report GET:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * POST /api/daily-report/assign
 * Body: { employeeId, departmentId, directionId?, shift, productCount?, date? }
 */
router.post('/assign', async (req, res) => {
  try {
    const { employeeId, departmentId, directionId, shift, productCount, date } = req.body;
    if (!employeeId || !departmentId || !shift) {
      return res.status(400).json({ error: 'employeeId, departmentId va shift majburiy' });
    }

    const dateStr = parseDateString(date) || todayDateString();
    if (dateStr > todayDateString()) {
      return res.status(400).json({ error: 'Kelajakdagi kun mumkin emas' });
    }

    const shiftNum = Number(shift);
    if (![0.5, 1].includes(shiftNum)) return res.status(400).json({ error: 'shift 0.5 yoki 1' });

    const dept = await Department.findOne({ _id: departmentId, businessId: req.businessId });
    if (!dept) return res.status(404).json({ error: "Bo'lim topilmadi" });

    const emp = await Employee.findOne({
      _id: employeeId,
      businessId: req.businessId,
      status: { $ne: 'deleted' },
    });
    if (!emp) return res.status(404).json({ error: 'Xodim topilmadi' });

    if (String(emp.departmentId) !== String(dept._id)) {
      return res.status(400).json({ error: "Xodim bu bo'limga tegishli emas" });
    }

    const exists = await DailyAssignment.findOne({
      businessId: req.businessId,
      employeeId,
      dateString: dateStr,
    });
    if (exists) return res.status(400).json({ error: 'Bu xodim shu kun uchun allaqachon biriktirilgan' });

    let direction = null;
    let priceSnapshot = 0;
    if (dept.allowDirections) {
      if (!directionId) return res.status(400).json({ error: "ON bo'lim uchun yo'nalish majburiy" });
      direction = await Direction.findOne({
        _id: directionId,
        businessId: req.businessId,
        departmentId: dept._id,
        isArchived: { $ne: true },
      });
      if (!direction) return res.status(404).json({ error: "Yo'nalish topilmadi" });
      priceSnapshot = direction.price || 0;
    } else {
      priceSnapshot = dept.pricePerUnit || 0;
    }

    const pc = Math.max(0, Number(productCount) || 0);
    const initialEarning = dept.allowDirections ? 0 : priceSnapshot * pc;

    const assignment = await DailyAssignment.create({
      businessId: req.businessId,
      employeeId,
      departmentId: dept._id,
      directionId: direction ? direction._id : null,
      date: new Date(dateStr),
      dateString: dateStr,
      shift: shiftNum,
      productCount: pc,
      priceSnapshot,
      earning: initialEarning,
      fairShare: initialEarning,
      isManual: false,
      employeeSnapshot: { fullName: emp.fullName, code: emp.code },
      departmentSnapshot: {
        name: dept.name,
        allowDirections: dept.allowDirections,
        pricePerUnit: dept.pricePerUnit,
      },
      directionSnapshot: direction ? { name: direction.name, price: direction.price } : undefined,
    });

    await recalculateForDate(req.businessId, dateStr);

    const fresh = await DailyAssignment.findById(assignment._id).lean();
    res.status(201).json(fresh);
  } catch (err) {
    console.error('Assign POST:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

/**
 * PUT /api/daily-report/assign/:id
 * Body: { shift?, productCount?, earning? }
 *  - shift / productCount yangilanishi bilan recalc qilinadi.
 *  - earning to'g'ridan-to'g'ri kiritilsa isManual=true.
 */
router.put('/assign/:id', async (req, res) => {
  try {
    const a = await DailyAssignment.findOne({ _id: req.params.id, businessId: req.businessId });
    if (!a) return res.status(404).json({ error: 'Biriktirish topilmadi' });

    const { shift, productCount, earning } = req.body;
    if (shift !== undefined) {
      const s = Number(shift);
      if (![0.5, 1].includes(s)) return res.status(400).json({ error: 'shift 0.5 yoki 1' });
      a.shift = s;
    }
    if (productCount !== undefined) {
      a.productCount = Math.max(0, Number(productCount) || 0);
    }
    if (earning !== undefined) {
      const e = Math.max(0, Number(earning) || 0);
      a.earning = e;
      a.manualAmount = e;
      a.isManual = true;
    }

    await a.save();
    await recalculateForDate(req.businessId, a.dateString);

    const fresh = await DailyAssignment.findById(a._id).lean();
    res.json(fresh);
  } catch (err) {
    console.error('Assign PUT:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

router.delete('/assign/:id', async (req, res) => {
  try {
    const a = await DailyAssignment.findOne({ _id: req.params.id, businessId: req.businessId });
    if (!a) return res.status(404).json({ error: 'Biriktirish topilmadi' });
    const dateStr = a.dateString;
    await a.deleteOne();
    await recalculateForDate(req.businessId, dateStr);
    res.json({ success: true });
  } catch (err) {
    console.error('Assign DELETE:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * POST /api/daily-report/quantity
 * Body: { directionId, date?, quantity }
 * ON-yo'nalish uchun kunlik umumiy mahsulot soni (upsert).
 */
router.post('/quantity', async (req, res) => {
  try {
    const { directionId, date, quantity } = req.body;
    if (!directionId || quantity === undefined) {
      return res.status(400).json({ error: 'directionId va quantity majburiy' });
    }

    const dateStr = parseDateString(date) || todayDateString();
    if (dateStr > todayDateString()) {
      return res.status(400).json({ error: 'Kelajakdagi kun mumkin emas' });
    }

    const direction = await Direction.findOne({
      _id: directionId,
      businessId: req.businessId,
      isArchived: { $ne: true },
    });
    if (!direction) return res.status(404).json({ error: "Yo'nalish topilmadi" });

    const qty = Math.max(0, Number(quantity) || 0);

    const doc = await DailyQuantity.findOneAndUpdate(
      { businessId: req.businessId, directionId, dateString: dateStr },
      { $set: { quantity: qty, date: new Date(dateStr) } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await recalculateForDate(req.businessId, dateStr);
    res.json(doc);
  } catch (err) {
    console.error('Quantity POST:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

module.exports = router;
