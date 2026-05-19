/**
 * CyberCoderCRM - Daily Report routes
 * YANGI: Assign'da yo'nalishning o'z type'i va price'i ishlatiladi
 * type va dailyAmount endi body'da YO'Q - yo'nalishdan olinadi
 */

const express = require('express');
const router = express.Router();

const DailyAssignment = require('../models/DailyAssignment');
const DailyProduct = require('../models/DailyProduct');
const Direction = require('../models/Direction');
const Employee = require('../models/Employee');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');
const requireModule = require('../middleware/requireModule');
const { recalculateForDate } = require('../services/recalculate');

router.use(verifyToken, requireAdmin, businessScope, requireModule('dailyReport'));

// Tashkent UTC+5 today check
function todayDateString() {
  const now = new Date();
  const tashkentTime = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  return tashkentTime.toISOString().split('T')[0];
}

function parseDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  return dateStr;
}

// ============================================
// GET /api/daily-report?date=YYYY-MM-DD
// ============================================
router.get('/', async (req, res) => {
  try {
    const dateStr = parseDate(req.query.date) || todayDateString();

    // Future check
    if (dateStr > todayDateString()) {
      return res.status(400).json({ error: 'Kelajakdagi kun mumkin emas' });
    }

    const filter = {
      businessId: req.businessId,
      dateString: dateStr,
    };

    const [assigned, allEmployees, products] = await Promise.all([
      DailyAssignment.find(filter)
        .populate('employeeId', 'firstName lastName code phone status')
        .sort('-createdAt')
        .lean(),
      Employee.find({
        businessId: req.businessId,
        status: { $ne: 'deleted' },
      })
        .sort('firstName')
        .lean(),
      DailyProduct.find(filter).sort('-createdAt').lean(),
    ]);

    const assignedEmployeeIds = new Set(assigned.map(a => a.employeeId?._id?.toString() || a.employeeId?.toString()));
    const unassigned = allEmployees.filter(e => !assignedEmployeeIds.has(e._id.toString()));

    const totalEarning = assigned.reduce((sum, a) => sum + (a.earning || 0), 0);
    const totalProducts = products.reduce((sum, p) => sum + (p.quantity || 0), 0);

    res.json({
      date: new Date(dateStr).toISOString(),
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

// ============================================
// POST /api/daily-report/assign
// Body: employeeId, directionId, shift, date
// type endi BODY DA EMAS - yo'nalishdan olinadi
// ============================================
router.post('/assign', async (req, res) => {
  try {
    const { employeeId, directionId, shift, date } = req.body;

    if (!employeeId || !directionId || !shift) {
      return res.status(400).json({ error: 'employeeId, directionId, shift kerak' });
    }

    const dateStr = parseDate(date) || todayDateString();

    if (dateStr > todayDateString()) {
      return res.status(400).json({ error: 'Kelajakdagi kun mumkin emas' });
    }

    const shiftNum = Number(shift);
    if (![0.5, 1].includes(shiftNum)) {
      return res.status(400).json({ error: 'shift faqat 0.5 yoki 1' });
    }

    // Yo'nalishni olamiz
    const direction = await Direction.findOne({
      _id: directionId,
      businessId: req.businessId,
      isArchived: { $ne: true },
    });
    if (!direction) return res.status(404).json({ error: "Yo'nalish topilmadi" });

    // Xodimni tekshiramiz
    const emp = await Employee.findOne({
      _id: employeeId,
      businessId: req.businessId,
      status: { $ne: 'deleted' },
    });
    if (!emp) return res.status(404).json({ error: 'Xodim topilmadi' });

    // Bir xil sanada bir xil xodim - tekshirish
    const existing = await DailyAssignment.findOne({
      businessId: req.businessId,
      employeeId,
      dateString: dateStr,
    });
    if (existing) {
      return res.status(400).json({ error: 'Bu xodim bu kun uchun allaqachon biriktirilgan' });
    }

    // YANGI: type va price avtomatik yo'nalishdan
    const directionType = direction.type || 'piecework';
    const directionPrice = direction.price || direction.currentPrice || 0;

    // Department snapshot
    let departmentName = '';
    if (direction.departmentId) {
      const Department = require('../models/Department');
      const dept = await Department.findById(direction.departmentId).select('name');
      if (dept) departmentName = dept.name;
    }

    // Earning: piecework => keyin recalculate (0 dan boshlanadi), daily => price * shift
    let earning = 0;
    if (directionType === 'daily') {
      earning = directionPrice * shiftNum;
    }

    const assignment = new DailyAssignment({
      businessId: req.businessId,
      employeeId,
      directionId,
      date: new Date(dateStr),
      dateString: dateStr,
      shift: shiftNum,
      type: directionType,
      priceSnapshot: directionPrice,
      earning,
      isManual: false,
      employeeSnapshot: {
        firstName: emp.firstName,
        lastName: emp.lastName || '-',
        code: emp.code,
      },
      directionSnapshot: {
        name: direction.name,
        departmentName,
        type: directionType,
        price: directionPrice,
      },
    });

    await assignment.save();

    // Piecework bo'lsa - butun kunni qayta hisoblash
    if (directionType === 'piecework') {
      await recalculateForDate(req.businessId, dateStr);
    }

    // Fresh data
    const fresh = await DailyAssignment.findById(assignment._id).lean();
    res.status(201).json(fresh);
  } catch (err) {
    console.error('Assign xato:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

// ============================================
// PUT /api/daily-report/assign/:id/earning
// Qo'lda earning kiritish
// ============================================
router.put('/assign/:id/earning', async (req, res) => {
  try {
    const { earning } = req.body;
    const earningNum = Math.max(0, Number(earning) || 0);

    const assignment = await DailyAssignment.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });
    if (!assignment) return res.status(404).json({ error: 'Biriktirish topilmadi' });

    assignment.earning = earningNum;
    assignment.isManual = true;
    assignment.manualAmount = earningNum;
    await assignment.save();

    // Piecework bo'lsa, fair share qayta hisoblash kerak
    if (assignment.type === 'piecework') {
      await recalculateForDate(req.businessId, assignment.dateString);
    }

    const fresh = await DailyAssignment.findById(assignment._id).lean();
    res.json(fresh);
  } catch (err) {
    console.error('Earning edit xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// ============================================
// DELETE /api/daily-report/assign/:id
// ============================================
router.delete('/assign/:id', async (req, res) => {
  try {
    const assignment = await DailyAssignment.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });
    if (!assignment) return res.status(404).json({ error: 'Biriktirish topilmadi' });

    const dateStr = assignment.dateString;
    const wasPiecework = assignment.type === 'piecework';
    await assignment.deleteOne();

    if (wasPiecework) {
      await recalculateForDate(req.businessId, dateStr);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Unassign xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// ============================================
// POST /api/daily-report/products
// Body: productName, quantity, date
// ============================================
router.post('/products', async (req, res) => {
  try {
    const { productName, quantity, date } = req.body;
    if (!productName || quantity === undefined) {
      return res.status(400).json({ error: 'productName va quantity kerak' });
    }

    const dateStr = parseDate(date) || todayDateString();
    if (dateStr > todayDateString()) {
      return res.status(400).json({ error: 'Kelajakdagi kun mumkin emas' });
    }

    const qty = Math.max(0, Number(quantity) || 0);

    const product = new DailyProduct({
      businessId: req.businessId,
      date: new Date(dateStr),
      dateString: dateStr,
      productName: String(productName).trim(),
      quantity: qty,
    });

    await product.save();

    // Piecework yo'nalishlar bor bo'lsa qayta hisoblash
    await recalculateForDate(req.businessId, dateStr);

    res.status(201).json(product.toObject());
  } catch (err) {
    console.error('Product POST xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.put('/products/:id', async (req, res) => {
  try {
    const { productName, quantity, date } = req.body;
    const product = await DailyProduct.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });
    if (!product) return res.status(404).json({ error: 'Mahsulot topilmadi' });

    if (productName !== undefined) product.productName = String(productName).trim();
    if (quantity !== undefined) product.quantity = Math.max(0, Number(quantity) || 0);
    if (date) {
      const newDateStr = parseDate(date);
      if (newDateStr && newDateStr <= todayDateString()) {
        product.dateString = newDateStr;
        product.date = new Date(newDateStr);
      }
    }

    await product.save();
    await recalculateForDate(req.businessId, product.dateString);

    res.json(product.toObject());
  } catch (err) {
    console.error('Product PUT xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.delete('/products/:id', async (req, res) => {
  try {
    const product = await DailyProduct.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });
    if (!product) return res.status(404).json({ error: 'Mahsulot topilmadi' });

    const dateStr = product.dateString;
    await product.deleteOne();
    await recalculateForDate(req.businessId, dateStr);

    res.json({ success: true });
  } catch (err) {
    console.error('Product DELETE xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// ============================================
// POST /api/daily-report/recalculate
// ============================================
router.post('/recalculate', async (req, res) => {
  try {
    const { date } = req.body;
    const dateStr = parseDate(date) || todayDateString();
    await recalculateForDate(req.businessId, dateStr);
    res.json({ success: true });
  } catch (err) {
    console.error('Recalculate xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

module.exports = router;