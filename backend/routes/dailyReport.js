/**
 * CyberCoderCRM - Daily Report routes
 * Endi: dailyAmount yo'nalishning dailyPrice'dan olinadi
 * Frontend body'dan dailyAmount qabul qilinmaydi
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

function toDateString(input) {
  if (!input) {
    const now = new Date();
    const tashkent = new Date(now.getTime() + 5 * 60 * 60 * 1000);
    return `${tashkent.getUTCFullYear()}-${String(tashkent.getUTCMonth() + 1).padStart(2, '0')}-${String(tashkent.getUTCDate()).padStart(2, '0')}`;
  }
  if (typeof input === 'string') {
    const match = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const d = input instanceof Date ? input : new Date(input);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateStringToDate(dateString) {
  const parts = dateString.split('-');
  return new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
}

function todayString() {
  const now = new Date();
  const tashkent = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  return `${tashkent.getUTCFullYear()}-${String(tashkent.getUTCMonth() + 1).padStart(2, '0')}-${String(tashkent.getUTCDate()).padStart(2, '0')}`;
}

function isFutureDateString(dateString) {
  return dateString > todayString();
}

router.get('/', async (req, res) => {
  try {
    const dateStr = toDateString(req.query.date);

    const [assigned, allEmployees, products] = await Promise.all([
      DailyAssignment.find({
        businessId: req.businessId,
        dateString: dateStr,
      }).sort('-createdAt'),
      Employee.find({
        businessId: req.businessId,
        status: { $ne: 'deleted' },
      }).sort('firstName'),
      DailyProduct.find({
        businessId: req.businessId,
        dateString: dateStr,
      }).sort('-createdAt'),
    ]);

    const assignedEmployeeIds = new Set(assigned.map((a) => a.employeeId.toString()));
    const unassigned = allEmployees.filter((e) => !assignedEmployeeIds.has(e._id.toString()));

    const totalEarning = assigned.reduce((sum, a) => sum + (a.earning || 0), 0);
    const totalProducts = products.reduce((sum, p) => sum + (p.quantity || 0), 0);

    res.json({
      date: dateStringToDate(dateStr),
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
    const { employeeId, directionId, shift, date, type } = req.body;

    if (!employeeId || !directionId || !shift) {
      return res.status(400).json({ error: 'Barcha maydonlar kerak' });
    }

    const shiftNum = Number(shift);
    if (![0.5, 1].includes(shiftNum)) {
      return res.status(400).json({ error: "Smena 1 yoki 0.5 bo'lishi kerak" });
    }

    const assignType = type === 'daily' ? 'daily' : 'piecework';

    const dateStr = toDateString(date);

    if (isFutureDateString(dateStr)) {
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

    // Yo'nalishda tanlangan tur yoqilgan bo'lishi kerak
    if (assignType === 'piecework' && !direction.pieceworkEnabled) {
      return res.status(400).json({ error: "Bu yo'nalishda Shtuk turi yoqilmagan" });
    }
    if (assignType === 'daily' && !direction.dailyEnabled) {
      return res.status(400).json({ error: "Bu yo'nalishda Kunlik turi yoqilmagan" });
    }

    // Yo'nalishdan narx olinadi
    const priceSnapshot = assignType === 'piecework'
      ? (direction.pieceworkPrice || direction.currentPrice || 0)
      : (direction.dailyPrice || 0);
    const dailyAmt = assignType === 'daily' ? (direction.dailyPrice || 0) : 0;

    const existing = await DailyAssignment.findOne({
      businessId: req.businessId,
      employeeId: employee._id,
      dateString: dateStr,
    });

    if (existing) {
      return res.status(400).json({ error: 'Bu xodim bu kun uchun allaqachon biriktirilgan' });
    }

    const assignment = new DailyAssignment({
      businessId: req.businessId,
      employeeId: employee._id,
      directionId: direction._id,
      dateString: dateStr,
      date: dateStringToDate(dateStr),
      shift: shiftNum,
      type: assignType,
      dailyAmount: dailyAmt,
      priceSnapshot,
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
    await recalculateDirection(req.businessId, direction._id, dateStr);

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

    await recalculateDirection(req.businessId, assignment.directionId, assignment.dateString);

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
    const dateStr = assignment.dateString;

    await DailyAssignment.findByIdAndDelete(assignment._id);
    await recalculateDirection(req.businessId, directionId, dateStr);

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

    const dateStr = toDateString(date);
    if (isFutureDateString(dateStr)) {
      return res.status(400).json({ error: "Kelajakdagi kun uchun mahsulot qo'shish mumkin emas" });
    }

    const product = new DailyProduct({
      businessId: req.businessId,
      dateString: dateStr,
      date: dateStringToDate(dateStr),
      productName: String(productName).trim(),
      quantity: Number(quantity),
    });

    await product.save();
    await recalculateDay(req.businessId, dateStr);
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
    await recalculateDay(req.businessId, product.dateString || toDateString(product.date));
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

    const dateStr = product.dateString || toDateString(product.date);
    await DailyProduct.findByIdAndDelete(product._id);
    await recalculateDay(req.businessId, dateStr);
    res.json({ success: true });
  } catch (err) {
    console.error('Product DELETE xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.post('/recalculate', async (req, res) => {
  try {
    const { date } = req.body;
    const dateStr = toDateString(date);
    const results = await recalculateDay(req.businessId, dateStr);
    res.json({ success: true, results });
  } catch (err) {
    console.error('Recalculate xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

module.exports = router;