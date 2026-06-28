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
const Direction = require('../models/Direction');
const ReservedCode = require('../models/ReservedCode');

const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');
const requireModule = require('../middleware/requireModule');

const { buildEmployeesWorkbook } = require('../services/excelGenerator');
const { saveToArchive } = require('../services/excelArchive');
const { tr } = require('../services/excelI18n');

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
      .populate('directionId', 'name price')
      .sort('-createdAt')
      .lean();
    res.json(employees);
  } catch (err) {
    console.error('Employees GET:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * GET /api/employees/export?lang=uz-lat
 * Xodimlar ro'yxatini Excel sifatida yuklab beradi va arxivga saqlaydi.
 */
router.get('/export', async (req, res) => {
  try {
    const allowedLangs = ['uz-lat', 'uz-cyr', 'ru'];
    const lang = allowedLangs.includes(String(req.query.lang)) ? String(req.query.lang) : 'uz-lat';

    const employees = await Employee.find({
      businessId: req.businessId,
      status: { $ne: 'deleted' },
    })
      .populate('departmentId', 'name allowDirections')
      .populate('directionId', 'name price')
      .sort('-createdAt')
      .lean();

    const buffer = await buildEmployeesWorkbook(lang, { employees });

    const today = new Date(new Date().getTime() + 5 * 60 * 60 * 1000)
      .toISOString().split('T')[0];
    const displayName = `${tr(lang, 'file.employees')}_${today}.xlsx`;
    const generatedBy = req.user?.fullName || req.user?.login || req.user?.username || '';

    try {
      await saveToArchive({
        buffer,
        businessId: req.businessId,
        category: 'employees',
        subType: '',
        language: lang,
        displayName,
        dateFrom: null,
        dateTo: null,
        rowCount: employees.length,
        generatedBy,
        meta: { count: employees.length },
      });
    } catch (archErr) {
      console.error('Employees export arxiv xatosi:', archErr);
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
    console.error('Employees EXPORT:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { fullName, code, phone, departmentId, directionId } = req.body;
    if (!fullName || !code || !departmentId) {
      return res.status(400).json({ error: "Ism, kod va bo'lim majburiy" });
    }
    const codeTrim = String(code).trim();

    const dept = await Department.findOne({ _id: departmentId, businessId: req.businessId });
    if (!dept) return res.status(404).json({ error: "Bo'lim topilmadi" });

    let resolvedDirectionId = null;
    if (dept.allowDirections) {
      if (!directionId) {
        return res.status(400).json({ error: "ON bo'lim uchun yo'nalish majburiy" });
      }
      const dir = await Direction.findOne({
        _id: directionId,
        businessId: req.businessId,
        departmentId: dept._id,
        isArchived: { $ne: true },
      });
      if (!dir) return res.status(404).json({ error: "Yo'nalish topilmadi" });
      resolvedDirectionId = dir._id;
    }

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
      directionId: resolvedDirectionId,
      fullName: String(fullName).trim(),
      code: codeTrim,
      phone: phone ? String(phone).trim() : '',
    });
    await emp.populate('departmentId', 'name allowDirections');
    await emp.populate('directionId', 'name price');
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

    const { fullName, code, phone, departmentId, directionId } = req.body;

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

    let nextDeptId = emp.departmentId;
    if (departmentId !== undefined && departmentId !== String(emp.departmentId)) {
      const dept = await Department.findOne({ _id: departmentId, businessId: req.businessId });
      if (!dept) return res.status(404).json({ error: "Bo'lim topilmadi" });
      emp.departmentId = departmentId;
      nextDeptId = dept._id;
      emp.directionId = null;
    }

    if (directionId !== undefined) {
      const deptDoc = await Department.findOne({ _id: nextDeptId, businessId: req.businessId });
      if (!deptDoc) return res.status(404).json({ error: "Bo'lim topilmadi" });
      if (!deptDoc.allowDirections) {
        emp.directionId = null;
      } else if (!directionId) {
        return res.status(400).json({ error: "ON bo'lim uchun yo'nalish majburiy" });
      } else {
        const dir = await Direction.findOne({
          _id: directionId,
          businessId: req.businessId,
          departmentId: deptDoc._id,
          isArchived: { $ne: true },
        });
        if (!dir) return res.status(404).json({ error: "Yo'nalish topilmadi" });
        emp.directionId = dir._id;
      }
    }

    if (fullName !== undefined) emp.fullName = String(fullName).trim();
    if (phone !== undefined) emp.phone = String(phone).trim();

    await emp.save();
    await emp.populate('departmentId', 'name allowDirections');
    await emp.populate('directionId', 'name price');
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
