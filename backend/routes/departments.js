/**
 * CyberCoderCRM - Departments routes
 */

const express = require('express');
const router = express.Router();

const Department = require('../models/Department');
const Direction = require('../models/Direction');

const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');
const requireModule = require('../middleware/requireModule');

router.use(verifyToken, requireAdmin, businessScope, requireModule('directions'));

/**
 * GET /api/departments
 * Barcha bo'limlar (yo'nalishlar soni bilan)
 */
router.get('/', async (req, res) => {
  try {
    const departments = await Department.find({
      businessId: req.businessId,
      status: 'active',
    }).sort('-createdAt');

    // Har bir bo'lim uchun yo'nalishlar soni
    const result = await Promise.all(
      departments.map(async (d) => {
        const directionCount = await Direction.countDocuments({
          businessId: req.businessId,
          departmentId: d._id,
          status: 'active',
        });
        return { ...d.toObject(), directionCount };
      })
    );

    res.json(result);
  } catch (err) {
    console.error('Departments GET xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * GET /api/departments/:id/directions
 * Bo'limdagi yo'nalishlar
 */
router.get('/:id/directions', async (req, res) => {
  try {
    const directions = await Direction.find({
      businessId: req.businessId,
      departmentId: req.params.id,
      status: 'active',
    }).sort('-createdAt');

    res.json(directions);
  } catch (err) {
    console.error('Department directions xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * POST /api/departments
 */
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Bo'lim nomi kerak" });
    }

    const department = new Department({
      businessId: req.businessId,
      name: String(name).trim(),
      description: description ? String(description).trim() : '',
    });

    await department.save();
    res.status(201).json({ ...department.toObject(), directionCount: 0 });
  } catch (err) {
    console.error('Department POST xato:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

/**
 * PUT /api/departments/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const department = await Department.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!department) {
      return res.status(404).json({ error: "Bo'lim topilmadi" });
    }

    const { name, description } = req.body;
    if (name) department.name = String(name).trim();
    if (description !== undefined) department.description = String(description).trim();

    await department.save();
    res.json(department);
  } catch (err) {
    console.error('Department PUT xato:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

/**
 * DELETE /api/departments/:id
 * Bo'limni arxivlash (yo'nalishlar bor bo'lsa ogohlantirish)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { force } = req.query; // ?force=true - bo'lsa birga o'chiradi

    const directionsCount = await Direction.countDocuments({
      businessId: req.businessId,
      departmentId: req.params.id,
      status: 'active',
    });

    if (directionsCount > 0 && force !== 'true') {
      return res.status(400).json({
        error: `Bu bo'limda ${directionsCount} ta yo'nalish bor. O'chirish uchun "force" qo'shing.`,
        directionsCount,
      });
    }

    // Force: barcha yo'nalishlarni ham arxivlash
    if (force === 'true') {
      await Direction.updateMany(
        { businessId: req.businessId, departmentId: req.params.id },
        { status: 'archived' }
      );
    }

    await Department.findOneAndUpdate(
      { _id: req.params.id, businessId: req.businessId },
      { status: 'archived' }
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Department DELETE xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

module.exports = router;