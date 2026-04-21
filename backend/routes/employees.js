/**
 * CyberCoderCRM - Employees routes
 */

const express = require('express');
const router = express.Router();

const Employee = require('../models/Employee');
const ReservedCode = require('../models/ReservedCode');

const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');
const requireModule = require('../middleware/requireModule');

// Barcha route'lar uchun
router.use(verifyToken, requireAdmin, businessScope, requireModule('employees'));

/**
 * GET /api/employees
 * Barcha xodimlar ro'yxati
 */
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const filter = {
      businessId: req.businessId,
      status: { $ne: 'deleted' }
    };

    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { firstName: regex },
        { lastName: regex },
        { code: regex },
        { phone: regex },
      ];
    }

    const employees = await Employee.find(filter).sort('-createdAt');
    res.json(employees);
  } catch (err) {
    console.error('Employees GET xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * POST /api/employees
 * Yangi xodim qo'shish
 */
router.post('/', async (req, res) => {
  try {
    const { firstName, lastName, code, phone } = req.body;

    if (!firstName || !lastName || !code) {
      return res.status(400).json({ error: 'Ism, familiya va kod kerak' });
    }

    const codeTrim = String(code).trim();

    // Kod band emasligini tekshirish (aktiv xodimlar)
    const existing = await Employee.findOne({
      businessId: req.businessId,
      code: codeTrim,
      status: { $ne: 'deleted' },
    });
    if (existing) {
      return res.status(400).json({ error: 'Bu kod band' });
    }

    // ReservedCode (o'chirilgan xodim kodi) tekshirish
    const reserved = await ReservedCode.findOne({
      businessId: req.businessId,
      code: codeTrim,
    });
    if (reserved) {
      return res.status(400).json({
        error: `Bu kod oy oxirigacha band: ${reserved.reservedUntil.toLocaleDateString()}`
      });
    }

    const employee = new Employee({
      businessId: req.businessId,
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      code: codeTrim,
      phone: phone ? String(phone).trim() : '',
    });

    await employee.save();
    res.status(201).json(employee);
  } catch (err) {
    console.error('Employee POST xato:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

/**
 * PUT /api/employees/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!employee) {
      return res.status(404).json({ error: 'Xodim topilmadi' });
    }

    const { firstName, lastName, code, phone } = req.body;

    if (code && code !== employee.code) {
      const codeTrim = String(code).trim();
      const existing = await Employee.findOne({
        businessId: req.businessId,
        code: codeTrim,
        status: { $ne: 'deleted' },
        _id: { $ne: employee._id },
      });
      if (existing) {
        return res.status(400).json({ error: 'Bu kod band' });
      }
      employee.code = codeTrim;
    }

    if (firstName) employee.firstName = String(firstName).trim();
    if (lastName) employee.lastName = String(lastName).trim();
    if (phone !== undefined) employee.phone = String(phone).trim();

    await employee.save();
    res.json(employee);
  } catch (err) {
    console.error('Employee PUT xato:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

/**
 * DELETE /api/employees/:id
 * Soft delete + ReservedCode
 */
router.delete('/:id', async (req, res) => {
  try {
    const employee = await Employee.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!employee) {
      return res.status(404).json({ error: 'Xodim topilmadi' });
    }

    // Oy oxirigacha band qilish
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    await ReservedCode.create({
      businessId: req.businessId,
      code: employee.code,
      reservedUntil: endOfMonth,
      employeeData: {
        firstName: employee.firstName,
        lastName: employee.lastName,
        phone: employee.phone,
      },
    });

    employee.status = 'deleted';
    employee.deletedAt = now;
    await employee.save();

    res.json({ success: true });
  } catch (err) {
    console.error('Employee DELETE xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

module.exports = router;
