/**
 * CyberCoderCRM - Daily Report routes
 * Yangi formula bilan (recalculate)
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

function getDateRange(dateStr) {
  let d;
  if (dateStr) {
    d = new Date(dateStr);
    if (isNaN(d.getTime())) d = new Date();
  } else {
    d = new Date();
  }

  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);

  return { start, end, dateStr: start.toISOString().split('T')[0] };
}

/**
 * GET /api/daily-report?date=YYYY-MM-DD
 */
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
      }).populate('directionId', 'name currentPrice').sort('-createdAt'),
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

/**
 * POST /api/daily-report/assign
 */
router.post('/assign', async (req, res) => {
  try {
    const { employeeId, directionId, shift, date } = req.body;

    if (!employeeId || !directionId || !shift) {
      return res.status(400).json({ error: 'Barcha maydonlar kerak' });
    }

    const shiftNum = Number(shift);
    if (![0.5, 1].includes(shiftNum)) {
      return res.status(400).json({ error: "Smena 1 yoki 0.5 bo'lishi kerak" });
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

    let targetDate;
    if (date) {
      targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) targetDate = new Date();
    } else {
      targetDate = new Date();
    }
    targetDate.setHours(0, 0, 0, 0);

    const existing = await DailyAssignment.findOne({
      businessId: req.businessId,
      employeeId: employee._id,
      date: targetDate,
    });

    if (existing) {
      return res.status(400).json({ error: 'Bu xodim bu kun uchun allaqachon biriktirilgan' });
    }

    const priceSnapshot = direction.currentPrice;

    const assignment = new DailyAssignment({
      businessId: req.businessId,
      employeeId: employee._id,
      directionId: direction._id,
      date: targetDate,
      shift: shiftNum,
      priceSnapshot,
      earning: 0,     // Recalculate hisoblaydi
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

    // Recalculate - yangi xodim qo'shilgandan keyin
    await recalculateDirection(req.businessId, direction._id, targetDate);

    // Yangi assignment ma'lumotini qaytarish (recalculate'dan keyin)
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

/**
 * PUT /api/daily-report/assign/:id/earning
 * Manual o'zgartirish
 */
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

    if (!assignment) {
      return res.status(404).json({ error: 'Topilmadi' });
    }

    // Manual belgilash
    assignment.isManual = true;
    assignment.manualAmount = earningNum;
    await assignment.save();

    // Shu yo'nalish uchun recalculate
    await recalculateDirection(req.businessId, assignment.directionId, assignment.date);

    const updated = await DailyAssignment.findById(assignment._id);
    res.json(updated);
  } catch (err) {
    console.error('Earning update xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * DELETE /api/daily-report/assign/:id
 * Biriktirishni bekor qilish
 */
router.delete('/assign/:id', async (req, res) => {
  try {
    const assignment = await DailyAssignment.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Topilmadi' });
    }

    const directionId = assignment.directionId;
    const date = assignment.date;

    await DailyAssignment.findByIdAndDelete(assignment._id);

    // Recalculate
    await recalculateDirection(req.businessId, directionId, date);

    res.json({ success: true });
  } catch (err) {
    console.error('Assign DELETE xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * POST /api/daily-report/products
 * Mahsulot qo'shish - yo'nalish bilan
 */
router.post('/products', async (req, res) => {
  try {
    const { productName, quantity, date, directionId } = req.body;

    if (!productName || quantity === undefined) {
      return res.status(400).json({ error: 'Nom va soni kerak' });
    }

    if (!directionId) {
      return res.status(400).json({ error: "Yo'nalish kerak" });
    }

    const direction = await Direction.findOne({
      _id: directionId,
      businessId: req.businessId,
    });

    if (!direction) {
      return res.status(404).json({ error: "Yo'nalish topilmadi" });
    }

    let targetDate;
    if (date) {
      targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) targetDate = new Date();
    } else {
      targetDate = new Date();
    }
    targetDate.setHours(0, 0, 0, 0);

    const product = new DailyProduct({
      businessId: req.businessId,
      directionId: direction._id,
      date: targetDate,
      productName: String(productName).trim(),
      quantity: Number(quantity),
      directionSnapshot: {
        name: direction.name,
        price: direction.currentPrice,
      },
    });

    await product.save();

    // Recalculate - yangi mahsulot
    await recalculateDirection(req.businessId, direction._id, targetDate);

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

    if (!product) {
      return res.status(404).json({ error: 'Mahsulot topilmadi' });
    }

    const { productName, quantity } = req.body;
    if (productName) product.productName = String(productName).trim();
    if (quantity !== undefined) product.quantity = Number(quantity);

    await product.save();

    // Recalculate
    if (product.directionId) {
      await recalculateDirection(req.businessId, product.directionId, product.date);
    }

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

    const directionId = product.directionId;
    const date = product.date;

    await DailyProduct.findByIdAndDelete(product._id);

    // Recalculate
    if (directionId) {
      await recalculateDirection(req.businessId, directionId, date);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Product DELETE xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * POST /api/daily-report/recalculate
 * Qo'lda qayta hisoblash
 */
router.post('/recalculate', async (req, res) => {
  try {
    const { date } = req.body;
    const targetDate = date ? new Date(date) : new Date();

    const results = await recalculateDay(req.businessId, targetDate);
    res.json({ success: true, results });
  } catch (err) {
    console.error('Recalculate xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

module.exports = router;