/**
 * CyberCoderCRM - Employees (v2)
 *
 * fullName + departmentId. Har xodim 1 bo'limga tegishli.
 * Soft delete + ReservedCode (kod oy oxirigacha band).
 */

const express = require('express');
const router = express.Router();

const Employee = require('../models/Employee');
const Department = require('../models/Department');
const ReservedCode = require('../models/ReservedCode');

const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');
const requireModule = require('../middleware/requireModule');

router.use(verifyToken, requireAdmin, businessScope, requireModule('employees'));

router.get('/', async (req, res) => {
  try {
    const { search, departmentId } = req.query;
    const filter = { businessId: req.businessId, status: { $ne: 'deleted' } };
    if (departmentId) filter.departmentId = departmentId;
    if (search) {
      const rx = new RegExp(String(search).trim(), 'i');
      filter.$or = [{ fullName: rx }, { code: rx }, { phone: rx }];
    }
    const employees = await Employee.find(filter)
      .populate('departmentId', 'name allowDirections')
      .sort('-createdAt')
      .lean();
    res.json(employees);
  } catch (err) {
    console.error('Employees GET:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { fullName, code, phone, departmentId } = req.body;
    if (!fullName || !code || !departmentId) {
      return res.status(400).json({ error: "Ism, kod va bo'lim majburiy" });
    }
    const codeTrim = String(code).trim();

    const dept = await Department.findOne({ _id: departmentId, businessId: req.businessId });
    if (!dept) return res.status(404).json({ error: "Bo'lim topilmadi" });

    const exists = await Employee.findOne({
      businessId: req.businessId,
      code: codeTrim,
      status: { $ne: 'deleted' },
    });
    if (exists) return res.status(400).json({ error: 'Bu kod band' });

    const reserved = await ReservedCode.findOne({ businessId: req.businessId, code: codeTrim });
    if (reserved) {
      return res.status(400).json({
        error: `Bu kod ${reserved.reservedUntil.toLocaleDateString()} gacha band`,
      });
    }

    const emp = await Employee.create({
      businessId: req.businessId,
      departmentId,
      fullName: String(fullName).trim(),
      code: codeTrim,
      phone: phone ? String(phone).trim() : '',
    });
    await emp.populate('departmentId', 'name allowDirections');
    res.status(201).json(emp);
  } catch (err) {
    console.error('Employee POST:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const emp = await Employee.findOne({ _id: req.params.id, businessId: req.businessId });
    if (!emp) return res.status(404).json({ error: 'Xodim topilmadi' });

    const { fullName, code, phone, departmentId } = req.body;

    if (code !== undefined && code !== emp.code) {
      const codeTrim = String(code).trim();
      const dup = await Employee.findOne({
        businessId: req.businessId,
        code: codeTrim,
        status: { $ne: 'deleted' },
        _id: { $ne: emp._id },
      });
      if (dup) return res.status(400).json({ error: 'Bu kod band' });
      emp.code = codeTrim;
    }

    if (departmentId !== undefined && departmentId !== String(emp.departmentId)) {
      const dept = await Department.findOne({ _id: departmentId, businessId: req.businessId });
      if (!dept) return res.status(404).json({ error: "Bo'lim topilmadi" });
      emp.departmentId = departmentId;
    }

    if (fullName !== undefined) emp.fullName = String(fullName).trim();
    if (phone !== undefined) emp.phone = String(phone).trim();

    await emp.save();
    await emp.populate('departmentId', 'name allowDirections');
    res.json(emp);
  } catch (err) {
    console.error('Employee PUT:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const emp = await Employee.findOne({ _id: req.params.id, businessId: req.businessId });
    if (!emp) return res.status(404).json({ error: 'Xodim topilmadi' });

    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    await ReservedCode.create({
      businessId: req.businessId,
      code: emp.code,
      reservedUntil: endOfMonth,
      employeeData: { fullName: emp.fullName, phone: emp.phone },
    });

    emp.status = 'deleted';
    emp.deletedAt = now;
    await emp.save();
    res.json({ success: true });
  } catch (err) {
    console.error('Employee DELETE:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

module.exports = router;
