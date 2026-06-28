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
const DailyProduction = require('../models/DailyProduction');
const Department = require('../models/Department');
const Direction = require('../models/Direction');
const Employee = require('../models/Employee');

const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');
const requireModule = require('../middleware/requireModule');
const { recalculateForDate } = require('../services/recalculate');
const { distributeOff } = require('../services/distributeOff');

const { buildDailyReportWorkbook } = require('../services/excelGenerator');
const { saveToArchive } = require('../services/excelArchive');
const { tr } = require('../services/excelI18n');

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

    const [directions, employees, assigned] = await Promise.all([
      dept.allowDirections
        ? Direction.find({ businessId: req.businessId, departmentId, isArchived: { $ne: true } }).sort('name').lean()
        : Promise.resolve([]),
      Employee.find({ businessId: req.businessId, departmentId, status: { $ne: 'deleted' } })
        .populate('directionId', 'name price')
        .sort('fullName')
        .lean(),
      DailyAssignment.find({ businessId: req.businessId, departmentId, dateString: dateStr }).sort('-createdAt').lean(),
    ]);

    let quantityMap = {};
    if (dept.allowDirections && directions.length > 0) {
      const qDocs = await DailyQuantity.find({
        businessId: req.businessId,
        dateString: dateStr,
        directionId: { $in: directions.map(d => d._id) },
      }).lean();
      quantityMap = Object.fromEntries(qDocs.map(q => [String(q.directionId), q.quantity]));
    }

    let production = null;
    if (!dept.allowDirections) {
      const pDoc = await DailyProduction.findOne({
        businessId: req.businessId,
        departmentId,
        dateString: dateStr,
      }).lean();
      production = {
        quantity: pDoc?.quantity || 0,
        productName: pDoc?.productName || '',
      };
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
      production,
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
 * GET /api/daily-report/export?date=YYYY-MM-DD&lang=uz-lat
 * Tanlangan kun bo'yicha barcha biriktirishlarni Excel'ga eksport qiladi.
 */
router.get('/export', async (req, res) => {
  try {
    const allowedLangs = ['uz-lat', 'uz-cyr', 'ru'];
    const lang = allowedLangs.includes(String(req.query.lang)) ? String(req.query.lang) : 'uz-lat';

    const dateStr = parseDateString(req.query.date) || todayDateString();
    if (dateStr > todayDateString()) {
      return res.status(400).json({ error: 'Kelajakdagi kun mumkin emas' });
    }

    const [departments, assignments] = await Promise.all([
      Department.find({ businessId: req.businessId }).sort('name').lean(),
      DailyAssignment.find({ businessId: req.businessId, dateString: dateStr })
        .sort('departmentSnapshot.name')
        .lean(),
    ]);

    const buffer = await buildDailyReportWorkbook(lang, { date: dateStr, departments, assignments });

    const displayName = `${tr(lang, 'file.daily')}_${dateStr}.xlsx`;
    const generatedBy = req.user?.fullName || req.user?.login || req.user?.username || '';

    try {
      await saveToArchive({
        buffer,
        businessId: req.businessId,
        category: 'dailyReport',
        subType: '',
        language: lang,
        displayName,
        dateFrom: dateStr,
        dateTo: dateStr,
        rowCount: assignments.length,
        generatedBy,
        meta: { date: dateStr, count: assignments.length },
      });
    } catch (archErr) {
      console.error('DailyReport export arxiv xatosi:', archErr);
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(displayName)}"`
    );
    return res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('DailyReport EXPORT:', err);
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
      const dirId = directionId || emp.directionId;
      if (!dirId) return res.status(400).json({ error: "ON bo'lim uchun xodimga yo'nalish biriktirilmagan" });
      direction = await Direction.findOne({
        _id: dirId,
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
    const initialEarning = dept.allowDirections ? priceSnapshot * shiftNum : 0;

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
      isProductManual: false,
      employeeSnapshot: { fullName: emp.fullName, code: emp.code },
      departmentSnapshot: {
        name: dept.name,
        allowDirections: dept.allowDirections,
        pricePerUnit: dept.pricePerUnit,
      },
      directionSnapshot: direction ? { name: direction.name, price: direction.price } : undefined,
    });

    if (!dept.allowDirections) {
      await distributeOff(req.businessId, dept._id, dateStr);
    }
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
      a.isProductManual = true;
    }
    if (earning !== undefined) {
      const e = Math.max(0, Number(earning) || 0);
      a.earning = e;
      a.manualAmount = e;
      a.isManual = true;
    }

    await a.save();
    if (productCount !== undefined) {
      const dept = await Department.findOne({ _id: a.departmentId, businessId: req.businessId }).lean();
      if (dept && !dept.allowDirections) {
        await distributeOff(req.businessId, a.departmentId, a.dateString);
      }
    }
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
 * POST /api/daily-report/production
 * Body: { departmentId, date?, quantity }
 * OFF-bo'lim uchun kunlik umumiy mahsulot soni (upsert).
 */
router.post('/production', async (req, res) => {
  try {
    const { departmentId, date, quantity, productName } = req.body;
    if (!departmentId || quantity === undefined) {
      return res.status(400).json({ error: 'departmentId va quantity majburiy' });
    }

    const dateStr = parseDateString(date) || todayDateString();
    if (dateStr > todayDateString()) {
      return res.status(400).json({ error: 'Kelajakdagi kun mumkin emas' });
    }

    const dept = await Department.findOne({ _id: departmentId, businessId: req.businessId });
    if (!dept) return res.status(404).json({ error: "Bo'lim topilmadi" });
    if (dept.allowDirections) {
      return res.status(400).json({ error: "ON bo'lim — /quantity dan foydalaning" });
    }

    const qty = Math.max(0, Number(quantity) || 0);
    const name = productName ? String(productName).trim().slice(0, 200) : '';

    const doc = await DailyProduction.findOneAndUpdate(
      { businessId: req.businessId, departmentId, dateString: dateStr },
      { $set: { quantity: qty, productName: name, date: new Date(dateStr) } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await distributeOff(req.businessId, departmentId, dateStr);
    await recalculateForDate(req.businessId, dateStr);
    res.json(doc);
  } catch (err) {
    console.error('Production POST:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
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
