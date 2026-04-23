/**
 * CyberCoderCRM - Daily Report routes
 * Endi ?date=YYYY-MM-DD parametri qo'llab-quvvatlanadi
 */

const express = require('express');
const router = express.Router();

const Employee = require('../models/Employee');
const Direction = require('../models/Direction');
const Department = require('../models/Department');
const DailyAssignment = require('../models/DailyAssignment');
const DailyProduct = require('../models/DailyProduct');

const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');
const requireModule = require('../middleware/requireModule');

router.use(verifyToken, requireAdmin, businessScope, requireModule('dailyReport'));

/**
 * Berilgan sana uchun diapazon (yoki bugun)
 */
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
 * Tanlangan kun (yoki bugungi) ma'lumotlari
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

/**
 * POST /api/daily-report/assign
 * body: { employeeId, directionId, shift, date? }
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

    // Sana - tanlangan yoki bugun
    let targetDate;
    if (date) {
      targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) targetDate = new Date();
    } else {
      targetDate = new Date();
    }
    targetDate.setHours(0, 0, 0, 0);

    // Takrorlanishni oldini olish
    const existing = await DailyAssignment.findOne({
      businessId: req.businessId,
      employeeId: employee._id,
      date: targetDate,
    });

    if (existing) {
      return res.status(400).json({ error: 'Bu xodim bu kun uchun allaqachon biriktirilgan' });
    }

    const priceSnapshot = direction.currentPrice;
    const earning = priceSnapshot * shiftNum;

    const assignment = new DailyAssignment({
      businessId: req.businessId,
      employeeId: employee._id,
      directionId: direction._id,
      date: targetDate,
      shift: shiftNum,
      priceSnapshot,
      earning,
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
    res.status(201).json(assignment);
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
 * Daromadni qo'lda o'zgartirish
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

    assignment.earning = earningNum;
    await assignment.save();

    res.json(assignment);
  } catch (err) {
    console.error('Earning update xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.delete('/assign/:id', async (req, res) => {
  try {
    const result = await DailyAssignment.findOneAndDelete({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!result) {
      return res.status(404).json({ error: 'Topilmadi' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Assign DELETE xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * POST /api/daily-report/products
 * body: { productName, quantity, date? }
 */
router.post('/products', async (req, res) => {
  try {
    const { productName, quantity, date } = req.body;

    if (!productName || quantity === undefined) {
      return res.status(400).json({ error: 'Nom va soni kerak' });
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
      date: targetDate,
      productName: String(productName).trim(),
      quantity: Number(quantity),
    });

    await product.save();
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
    res.json(product);
  } catch (err) {
    console.error('Product PUT xato:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

router.delete('/products/:id', async (req, res) => {
  try {
    const result = await DailyProduct.findOneAndDelete({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!result) return res.status(404).json({ error: 'Topilmadi' });
    res.json({ success: true });
  } catch (err) {
    console.error('Product DELETE xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

module.exports = router;