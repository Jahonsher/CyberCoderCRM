const express = require('express');
const router = express.Router();

const Employee = require('../models/Employee');
const ReservedCode = require('../models/ReservedCode');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');
const { isValidCode } = require('../utils/helpers');

// Barcha route'lar admin uchun + businessScope
router.use(verifyToken, requireAdmin, businessScope);

/**
 * GET /api/employees
 * Biznes xodimlari (faqat active)
 *
 * Query: ?search=... (ism/familiya/kod bo'yicha)
 */
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;

    const filter = {
      ...req.businessScope,
      status: 'active',
    };

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { code: searchRegex },
        { phone: searchRegex },
      ];
    }

    const employees = await Employee.find(filter).sort({ createdAt: -1 });

    res.json(employees);
  } catch (err) {
    console.error('GET /employees xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * GET /api/employees/:id
 * Bitta xodim ma'lumotlari
 */
router.get('/:id', async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      ...req.businessScope,
    });

    if (!employee) {
      return res.status(404).json({ error: 'Xodim topilmadi' });
    }

    res.json(employee);
  } catch (err) {
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * POST /api/employees
 * Yangi xodim qo'shish
 *
 * Body: { firstName, lastName, code, phone? }
 */
router.post('/', async (req, res) => {
  try {
    const { firstName, lastName, code, phone } = req.body;

    // Validatsiya
    if (!firstName || !lastName || !code) {
      return res.status(400).json({
        error: 'Ism, familiya va kod majburiy',
      });
    }

    if (!isValidCode(code)) {
      return res.status(400).json({
        error: 'Kod noto\'g\'ri (1-50 belgi, bo\'sh bo\'lmasin)',
      });
    }

    const trimmedCode = code.trim();

    // Kod band qilingan emasmi?
    const isReserved = await ReservedCode.isCodeReserved(req.user.businessId, trimmedCode);
    if (isReserved) {
      return res.status(400).json({
        error: 'Bu kod band. Bu oy oxiriga qadar ishlatib bo\'lmaydi (avvalgi xodim o\'chirilgan).',
      });
    }

    // Kod unique tekshirish (active xodimlar ichida)
    const existing = await Employee.findOne({
      ...req.businessScope,
      code: trimmedCode,
      status: 'active',
    });
    if (existing) {
      return res.status(400).json({
        error: 'Bu kod boshqa xodimda mavjud',
      });
    }

    const employee = await Employee.create({
      ...req.businessScope,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      code: trimmedCode,
      phone: phone ? phone.trim() : '',
    });

    res.status(201).json({
      success: true,
      employee,
    });
  } catch (err) {
    console.error('POST /employees xato:', err);

    if (err.code === 11000) {
      return res.status(400).json({ error: 'Bu kod allaqachon mavjud' });
    }

    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

/**
 * PUT /api/employees/:id
 * Xodimni yangilash
 */
router.put('/:id', async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      ...req.businessScope,
    });

    if (!employee) {
      return res.status(404).json({ error: 'Xodim topilmadi' });
    }

    const { firstName, lastName, code, phone } = req.body;

    // Kod o'zgarsa
    if (code && code.trim() !== employee.code) {
      if (!isValidCode(code)) {
        return res.status(400).json({ error: 'Kod noto\'g\'ri' });
      }

      const trimmedCode = code.trim();

      // Reserved tekshirish
      const isReserved = await ReservedCode.isCodeReserved(req.user.businessId, trimmedCode);
      if (isReserved) {
        return res.status(400).json({ error: 'Bu kod band' });
      }

      // Boshqa xodimda bormi
      const existing = await Employee.findOne({
        ...req.businessScope,
        code: trimmedCode,
        status: 'active',
        _id: { $ne: employee._id },
      });
      if (existing) {
        return res.status(400).json({ error: 'Bu kod boshqa xodimda mavjud' });
      }

      employee.code = trimmedCode;
    }

    if (firstName) employee.firstName = firstName.trim();
    if (lastName) employee.lastName = lastName.trim();
    if (phone !== undefined) employee.phone = phone.trim();

    await employee.save();

    res.json({ success: true, employee });
  } catch (err) {
    console.error('PUT /employees xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * DELETE /api/employees/:id
 * Xodimni o'chirish (soft delete + kodni band qilish)
 *
 * MANTIQ:
 * - Xodim DB da qoladi, lekin status="deleted"
 * - Uning kodi ReservedCode ga qo'shiladi (oy oxirigacha)
 * - Eski hisobotlarda ismi saqlanib qoladi
 * - Yangi xodimga shu kod bu oyda berib bo'lmaydi
 */
router.delete('/:id', async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      ...req.businessScope,
      status: 'active',
    });

    if (!employee) {
      return res.status(404).json({ error: 'Xodim topilmadi yoki o\'chirilgan' });
    }

    // Soft delete
    employee.status = 'deleted';
    employee.deletedAt = new Date();
    await employee.save();

    // Kodni band qilish (oy oxirigacha)
    try {
      await ReservedCode.reserveCode(employee);
    } catch (err) {
      // Agar reserved code allaqachon mavjud bo'lsa - xato emas
      if (err.code !== 11000) throw err;
    }

    res.json({
      success: true,
      message: 'Xodim o\'chirildi. Kod oy oxirigacha band qilindi.',
      reservedUntil: (() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      })(),
    });
  } catch (err) {
    console.error('DELETE /employees xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

module.exports = router;