const express = require('express');
const router = express.Router();

const Employee = require('../models/Employee');
const Direction = require('../models/Direction');
const DailyAssignment = require('../models/DailyAssignment');
const DailyProduct = require('../models/DailyProduct');

const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');
const { getTodayString, toDateString } = require('../utils/helpers');

router.use(verifyToken, requireAdmin, businessScope);

/**
 * GET /api/daily-report
 * Bugungi hisobot:
 *   - Biriktirilgan xodimlar (with earnings)
 *   - Biriktirilmagan xodimlar
 *   - Kunlik mahsulotlar
 *
 * Query: ?date=YYYY-MM-DD (default = bugun)
 */
router.get('/', async (req, res) => {
  try {
    const date = req.query.date || getTodayString();

    // 1. Biriktirilgan xodimlar
    const assignments = await DailyAssignment.find({
      ...req.businessScope,
      dateString: date,
    }).sort({ createdAt: -1 });

    const assignedEmployeeIds = assignments.map((a) => a.employeeId.toString());

    // 2. Biriktirilmagan xodimlar (faqat active, biriktirilganlar orasida emas)
    const unassignedEmployees = await Employee.find({
      ...req.businessScope,
      status: 'active',
      _id: { $nin: assignedEmployeeIds },
    }).sort({ firstName: 1 });

    // 3. Kunlik mahsulotlar
    const products = await DailyProduct.find({
      ...req.businessScope,
      dateString: date,
    }).sort({ createdAt: -1 });

    // Umumiy daromad
    const totalEarning = assignments.reduce((sum, a) => sum + (a.earning || 0), 0);
    const totalProductCount = products.reduce((sum, p) => sum + (p.quantity || 0), 0);

    res.json({
      date,
      assigned: assignments,
      unassigned: unassignedEmployees,
      products,
      stats: {
        totalAssigned: assignments.length,
        totalUnassigned: unassignedEmployees.length,
        totalEarning,
        totalProducts: products.length,
        totalProductCount,
      },
    });
  } catch (err) {
    console.error('GET /daily-report xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * POST /api/daily-report/assign
 * Xodimni yo'nalishga biriktirish
 *
 * Body: { employeeId, directionId, shift (1 yoki 0.5), date? }
 *
 * ASOSIY LOGIKA:
 * - Yo'nalishning JORIY narxi snapshot qilib saqlanadi
 * - Keyinchalik narx o'zgarsa - bu record ta'sirlanmaydi
 */
router.post('/assign', async (req, res) => {
  try {
    const { employeeId, directionId, shift, date } = req.body;

    if (!employeeId || !directionId) {
      return res.status(400).json({ error: 'Xodim va yo\'nalish kerak' });
    }

    const shiftValue = shift === 0.5 || shift === '0.5' ? 0.5 : 1;
    const dateString = date || getTodayString();
    const dateObj = new Date(dateString);

    // Xodim tekshirish
    const employee = await Employee.findOne({
      _id: employeeId,
      ...req.businessScope,
      status: 'active',
    });
    if (!employee) {
      return res.status(404).json({ error: 'Xodim topilmadi' });
    }

    // Yo'nalish tekshirish
    const direction = await Direction.findOne({
      _id: directionId,
      ...req.businessScope,
      status: 'active',
    });
    if (!direction) {
      return res.status(404).json({ error: 'Yo\'nalish topilmadi' });
    }

    // Allaqachon biriktirilganmi?
    const existing = await DailyAssignment.findOne({
      ...req.businessScope,
      employeeId,
      dateString,
    });
    if (existing) {
      return res.status(400).json({
        error: 'Bu xodim bugun allaqachon biriktirilgan',
      });
    }

    // Biriktirish yaratish (narx SNAPSHOT bilan)
    const assignment = await DailyAssignment.create({
      ...req.businessScope,
      employeeId,
      employeeSnapshot: {
        firstName: employee.firstName,
        lastName: employee.lastName,
        code: employee.code,
      },
      directionId,
      directionSnapshot: {
        name: direction.name,
      },
      priceSnapshot: direction.currentPrice, // ⚠️ SNAPSHOT
      shift: shiftValue,
      earning: direction.currentPrice * shiftValue,
      date: dateObj,
      dateString,
    });

    res.status(201).json({ success: true, assignment });
  } catch (err) {
    console.error('POST /assign xato:', err);

    if (err.code === 11000) {
      return res.status(400).json({
        error: 'Bu xodim bugun allaqachon biriktirilgan',
      });
    }

    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * PUT /api/daily-report/assign/:id
 * Biriktirishni yangilash (smena yoki yo'nalish o'zgartirish)
 */
router.put('/assign/:id', async (req, res) => {
  try {
    const assignment = await DailyAssignment.findOne({
      _id: req.params.id,
      ...req.businessScope,
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Biriktirish topilmadi' });
    }

    const { directionId, shift } = req.body;

    // Yo'nalish o'zgarsa
    if (directionId && directionId !== assignment.directionId.toString()) {
      const direction = await Direction.findOne({
        _id: directionId,
        ...req.businessScope,
        status: 'active',
      });
      if (!direction) {
        return res.status(404).json({ error: 'Yo\'nalish topilmadi' });
      }

      assignment.directionId = direction._id;
      assignment.directionSnapshot = { name: direction.name };
      assignment.priceSnapshot = direction.currentPrice;
    }

    // Smena o'zgarsa
    if (shift !== undefined) {
      const shiftValue = shift === 0.5 || shift === '0.5' ? 0.5 : 1;
      assignment.shift = shiftValue;
    }

    // Earning qayta hisoblash
    assignment.earning = assignment.priceSnapshot * assignment.shift;

    await assignment.save();

    res.json({ success: true, assignment });
  } catch (err) {
    console.error('PUT /assign xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * DELETE /api/daily-report/assign/:id
 * Biriktirishni bekor qilish
 */
router.delete('/assign/:id', async (req, res) => {
  try {
    const result = await DailyAssignment.deleteOne({
      _id: req.params.id,
      ...req.businessScope,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Biriktirish topilmadi' });
    }

    res.json({ success: true, message: 'Biriktirish bekor qilindi' });
  } catch (err) {
    console.error('DELETE /assign xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * POST /api/daily-report/products
 * Kunlik mahsulot qo'shish (bugun chiqgan)
 *
 * Body: { productName, quantity, note?, date? }
 */
router.post('/products', async (req, res) => {
  try {
    const { productName, quantity, note, date } = req.body;

    if (!productName || quantity === undefined) {
      return res.status(400).json({
        error: 'Mahsulot nomi va soni kerak',
      });
    }

    const qty = Number(quantity);
    if (isNaN(qty) || qty < 0) {
      return res.status(400).json({ error: 'Soni to\'g\'ri raqam bo\'lishi kerak' });
    }

    const dateString = date || getTodayString();
    const dateObj = new Date(dateString);

    const product = await DailyProduct.create({
      ...req.businessScope,
      productName: productName.trim(),
      quantity: qty,
      note: note || '',
      date: dateObj,
      dateString,
    });

    res.status(201).json({ success: true, product });
  } catch (err) {
    console.error('POST /products xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * PUT /api/daily-report/products/:id
 * Mahsulotni yangilash
 */
router.put('/products/:id', async (req, res) => {
  try {
    const product = await DailyProduct.findOne({
      _id: req.params.id,
      ...req.businessScope,
    });

    if (!product) {
      return res.status(404).json({ error: 'Mahsulot topilmadi' });
    }

    const { productName, quantity, note } = req.body;

    if (productName) product.productName = productName.trim();
    if (quantity !== undefined) {
      const qty = Number(quantity);
      if (!isNaN(qty) && qty >= 0) product.quantity = qty;
    }
    if (note !== undefined) product.note = note;

    await product.save();

    res.json({ success: true, product });
  } catch (err) {
    console.error('PUT /products xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * DELETE /api/daily-report/products/:id
 * Mahsulotni o'chirish
 */
router.delete('/products/:id', async (req, res) => {
  try {
    const result = await DailyProduct.deleteOne({
      _id: req.params.id,
      ...req.businessScope,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Mahsulot topilmadi' });
    }

    res.json({ success: true, message: 'Mahsulot o\'chirildi' });
  } catch (err) {
    console.error('DELETE /products xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

module.exports = router;