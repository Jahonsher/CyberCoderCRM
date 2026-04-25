/**
 * CyberCoderCRM - Daily Report routes
 * Sana UTC bilan ishlaydi - timezone muammosi yo'q
 * type: piecework | daily
 */

const express = require('express');
const router = express.Router();

const Employee = require('../models/Employee');
const Direction = require('../models/Direction');
const DailyAssignment = require('../models/DailyAssignment');
const DailyProduct = require('../models/DailyProduct');

const { recalculateDirection, recalculateDay } = require('../services/recalculate');

const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');
const requireModule = require('../middleware/requireModule');

router.use(verifyToken, requireAdmin, businessScope, requireModule('dailyReport'));

/**
 * Sana parserni - UTC bilan ishlaydi
 * YYYY-MM-DD formatdagi stringdan UTC 00:00 sanani qaytaradi
 */
function parseDate(dateStr) {
  if (!dateStr) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  // YYYY-MM-DD format kutiladi
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  return new Date(Date.UTC(year, month, day));
}

/**
 * Bugungi UTC sana
 */
function todayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Sana intervalini olish (start ... end)
 */
function getDateRange(dateStr) {
  const start = parseDate(dateStr);
  const end = new Date(start);
  end.setUTCHours(23, 59, 59, 999);
  const isoStr = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}-${String(start.getUTCDate()).padStart(2, '0')}`;
  return { start, end, dateStr: isoStr };
}

/**
 * Kelajak sana tekshiruvi
 */
function isFutureDate(date) {
  const today = todayUTC();
  return date.getTime() > today.getTime();
}

router.get('/', async (req, res) => {
  try {
    const { start, end, dateStr } = getDateRange(req.query.date);

    const [assigned, allEmployees, products] = await Promise.all([
      DailyAssignment.find({
        businessId: req.businessId,
        date: { $gte: start, $lte: end },
      }).sort('-createdAt'),
      Employee.find({
        businessId: req.businessId,
        status: { $ne: 'deleted' },
      }).sort('firstName'),
      DailyProduct.find({
        businessId: req.businessId,
        date: { $gte: start, $lte: end },
      }).sort('-createdAt'),
    ]);

    const assignedEmployeeIds = new Set(
      assigned.map((a) => a.employeeId.toString())
    );
    const unassigned = allEmployees.filter(
      (e) => !assignedEmployeeIds.has(e._id.toString())
    );

    const totalEarning = assigned.reduce((sum, a) => sum + (a.earning || 0), 0);
    const totalProducts = products.reduce((sum, p) => sum + (p.quantity || 0), 0);

    res.json({
      date: start,
      dateStr,
      assigned,
      unassigned,
      products,
      stats: {
        totalAssigned: assigned.length,
        totalUnassigned: unassigned.length,
        totalEarning,
        totalProducts,
      },
    });
  } catch (err) {
    console.error('Daily report GET xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.post('/assign', async (req, res) => {
  try {
    const { employeeId, directionId, shift, date, type, dailyAmount } = req.body;

    if (!employeeId || !directionId || !shift) {
      return res.status(400).json({ error: 'Barcha maydonlar kerak' });
    }

    const shiftNum = Number(shift);
    if (![0.5, 1].includes(shiftNum)) {
      return res.status(400).json({ error: "Smena 1 yoki 0.5 bo'lishi kerak" });
    }

    const assignType = type === 'daily' ? 'daily' : 'piecework';
    const dailyAmt = assignType === 'daily' ? Number(dailyAmount || 0) : 0;

    if (assignType === 'daily' && (isNaN(dailyAmt) || dailyAmt < 0)) {
      return res.status(400).json({ error: "Kunlik summa noto'g'ri" });
    }

    const targetDate = parseDate(date);

    // Kelajak sana tekshiruvi
    if (isFutureDate(targetDate)) {
      return res.status(400).json({ error: "Kelajakdagi kun uchun biriktirish mumkin emas" });
    }

    const [employee, direction] = await Promise.all([
      Employee.findOne({
        _id: employeeId,
        businessId: req.businessId,
        status: { $ne: 'deleted' }
      }),
      Direction.findOne({
        _id: directionId,
        businessId: req.businessId,
        status: 'active'
      }).populate('departmentId', 'name'),
    ]);

    if (!employee) return res.status(404).json({ error: 'Xodim topilmadi' });
    if (!direction) return res.status(404).json({ error: "Yo'nalish topilmadi" });

    const existing = await DailyAssignment.findOne({
      businessId: req.businessId,
      employeeId: employee._id,
      date: targetDate,
    });

    if (existing) {
      return res.status(400).json({ error: 'Bu xodim bu kun uchun allaqachon biriktirilgan' });
    }

    const assignment = new DailyAssignment({
      businessId: req.businessId,
      employeeId: employee._id,
      directionId: direction._id,
      date: targetDate,
      shift: shiftNum,
      type: assignType,
      dailyAmount: dailyAmt,
      priceSnapshot: direction.currentPrice,
      earning: 0,
      fairShare: 0,
      bonus: 0,
      isManual: false,
      employeeSnapshot: {
        firstName: employee.firstName,
        lastName: employee.lastName,
        code: employee.code,
      },
      directionSnapshot: {
        name: direction.name,
        departmentName: direction.departmentId?.name || '',
      },
    });

    await assignment.save();

    await recalculateDirection(req.businessId, direction._id, targetDate);

    const updated = await DailyAssignment.findById(assignment._id);
    res.status(201).json(updated);
  } catch (err) {
    console.error('Assign POST xato:', err);
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Bu xodim bu kun uchun allaqachon biriktirilgan' });
    }
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

router.put('/assign/:id/earning', async (req, res) => {
  try {
    const { earning } = req.body;
    const earningNum = Number(earning);

    if (isNaN(earningNum) || earningNum < 0) {
      return res.status(400).json({ error: "Narx noto'g'ri" });
    }

    const assignment = await DailyAssignment.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!assignment) return res.status(404).json({ error: 'Topilmadi' });

    assignment.isManual = true;
    assignment.manualAmount = earningNum;
    await assignment.save();

    await recalculateDirection(req.businessId, assignment.directionId, assignment.date);

    const updated = await DailyAssignment.findById(assignment._id);
    res.json(updated);
  } catch (err) {
    console.error('Earning update xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.delete('/assign/:id', async (req, res) => {
  try {
    const assignment = await DailyAssignment.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!assignment) return res.status(404).json({ error: 'Topilmadi' });

    const directionId = assignment.directionId;
    const date = assignment.date;

    await DailyAssignment.findByIdAndDelete(assignment._id);
    await recalculateDirection(req.businessId, directionId, date);

    res.json({ success: true });
  } catch (err) {
    console.error('Assign DELETE xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.post('/products', async (req, res) => {
  try {
    const { productName, quantity, date } = req.body;

    if (!productName || quantity === undefined) {
      return res.status(400).json({ error: 'Nom va soni kerak' });
    }

    const targetDate = parseDate(date);

    if (isFutureDate(targetDate)) {
      return res.status(400).json({ error: "Kelajakdagi kun uchun mahsulot qo'shish mumkin emas" });
    }

    const product = new DailyProduct({
      businessId: req.businessId,
      date: targetDate,
      productName: String(productName).trim(),
      quantity: Number(quantity),
    });

    await product.save();

    await recalculateDay(req.businessId, targetDate);

    res.status(201).json(product);
  } catch (err) {
    console.error('Product POST xato:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

router.put('/products/:id', async (req, res) => {
  try {
    const product = await DailyProduct.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!product) return res.status(404).json({ error: 'Mahsulot topilmadi' });

    const { productName, quantity } = req.body;
    if (productName) product.productName = String(productName).trim();
    if (quantity !== undefined) product.quantity = Number(quantity);

    await product.save();
    await recalculateDay(req.businessId, product.date);

    res.json(product);
  } catch (err) {
    console.error('Product PUT xato:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

router.delete('/products/:id', async (req, res) => {
  try {
    const product = await DailyProduct.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!product) return res.status(404).json({ error: 'Topilmadi' });

    const date = product.date;
    await DailyProduct.findByIdAndDelete(product._id);
    await recalculateDay(req.businessId, date);

    res.json({ success: true });
  } catch (err) {
    console.error('Product DELETE xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.post('/recalculate', async (req, res) => {
  try {
    const { date } = req.body;
    const targetDate = parseDate(date);
    const results = await recalculateDay(req.businessId, targetDate);
    res.json({ success: true, results });
  } catch (err) {
    console.error('Recalculate xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

module.exports = router;