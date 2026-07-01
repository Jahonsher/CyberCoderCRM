/**
 * CyberCoderCRM - Departments (v2)
 *
 * Bo'lim CRUD. Har bo'limda:
 *  - allowDirections: true/false
 *
 * Bo'lim turi o'zgartirilmaydi — o'chirib qayta yaratish kerak.
 */

const express = require('express');
const router = express.Router();

const Department = require('../models/Department');
const Direction = require('../models/Direction');
const Employee = require('../models/Employee');

const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');
const requireModule = require('../middleware/requireModule');

router.use(verifyToken, requireAdmin, businessScope, requireModule('directions'));

router.get('/', async (req, res) => {
  try {
    const departments = await Department.find({ businessId: req.businessId }).sort('name').lean();
    const ids = departments.map(d => d._id);

    const [dirCounts, empCounts] = await Promise.all([
      Direction.aggregate([
        { $match: { businessId: req.businessId, departmentId: { $in: ids }, isArchived: { $ne: true } } },
        { $group: { _id: '$departmentId', count: { $sum: 1 } } },
      ]),
      Employee.aggregate([
        { $match: { businessId: req.businessId, departmentId: { $in: ids }, status: { $ne: 'deleted' } } },
        { $group: { _id: '$departmentId', count: { $sum: 1 } } },
      ]),
    ]);

    const dirMap = Object.fromEntries(dirCounts.map(c => [String(c._id), c.count]));
    const empMap = Object.fromEntries(empCounts.map(c => [String(c._id), c.count]));

    const result = departments.map(d => ({
      ...d,
      directionCount: dirMap[String(d._id)] || 0,
      employeeCount: empMap[String(d._id)] || 0,
    }));

    res.json(result);
  } catch (err) {
    console.error('Departments GET:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description, allowDirections } = req.body;
    if (!name) return res.status(400).json({ error: "Bo'lim nomi majburiy" });

    const dept = await Department.create({
      businessId: req.businessId,
      name: String(name).trim(),
      description: description ? String(description).trim() : '',
      allowDirections: allowDirections !== false,
    });

    const obj = dept.toObject();
    obj.directionCount = 0;
    obj.employeeCount = 0;
    res.status(201).json(obj);
  } catch (err) {
    console.error('Department POST:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const dept = await Department.findOne({ _id: req.params.id, businessId: req.businessId });
    if (!dept) return res.status(404).json({ error: "Bo'lim topilmadi" });

    const { name, description, allowDirections } = req.body;
    if (name !== undefined) dept.name = String(name).trim();
    if (description !== undefined) dept.description = String(description).trim();

    // allowDirections o'zgartirilsa, ON->OFF da yo'nalishlar arxivlanadi
    if (allowDirections !== undefined && allowDirections !== dept.allowDirections) {
      if (!allowDirections) {
        await Direction.updateMany(
          { businessId: req.businessId, departmentId: dept._id },
          { isArchived: true, archivedAt: new Date() }
        );
      }
      dept.allowDirections = !!allowDirections;
    }

    await dept.save();

    const [dirCount, empCount] = await Promise.all([
      Direction.countDocuments({ businessId: req.businessId, departmentId: dept._id, isArchived: { $ne: true } }),
      Employee.countDocuments({ businessId: req.businessId, departmentId: dept._id, status: { $ne: 'deleted' } }),
    ]);

    const obj = dept.toObject();
    obj.directionCount = dirCount;
    obj.employeeCount = empCount;
    res.json(obj);
  } catch (err) {
    console.error('Department PUT:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const dept = await Department.findOne({ _id: req.params.id, businessId: req.businessId });
    if (!dept) return res.status(404).json({ error: "Bo'lim topilmadi" });

    const empCount = await Employee.countDocuments({
      businessId: req.businessId,
      departmentId: dept._id,
      status: { $ne: 'deleted' },
    });
    if (empCount > 0) {
      return res.status(400).json({
        error: `Bu bo'limda ${empCount} ta xodim bor. Avval ularni o'chiring yoki ko'chiring.`,
        employeeCount: empCount,
      });
    }

    await Direction.updateMany(
      { businessId: req.businessId, departmentId: dept._id },
      { isArchived: true, archivedAt: new Date() }
    );
    await dept.deleteOne();

    res.json({ success: true });
  } catch (err) {
    console.error('Department DELETE:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

module.exports = router;
