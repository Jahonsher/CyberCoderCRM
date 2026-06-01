const express = require('express');
const router = express.Router();

const Department = require('../models/Department');
const Direction = require('../models/Direction');
const Business = require('../models/Business');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');

router.use(verifyToken, requireAdmin, businessScope);

// Modul ruxsatini tekshirish
async function checkModuleAccess(req, type) {
  const moduleKey = type === 'daily' ? 'directionsDaily' : 'directionsPiecework';
  const biz = await Business.findById(req.businessId).select('enabledModules');
  if (!biz) return false;
  const enabled = biz.enabledModules || [];
  return enabled.includes(moduleKey) || enabled.includes('directions');
}

// ============================================
// GET /api/departments?type=piecework|daily
// ============================================
router.get('/', async (req, res) => {
  try {
    const { type } = req.query;

    // Type majburiy
    if (!type || !['piecework', 'daily'].includes(type)) {
      return res.status(400).json({ error: "type kerak: piecework yoki daily" });
    }

    // Modul ruxsati
    const hasAccess = await checkModuleAccess(req, type);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Bu modul yoqilmagan' });
    }

    // QATTIQ FILTER
    const filter = {
      businessId: req.businessId,
      type: type, // aniq match
    };

    const [departments, dirCounts] = await Promise.all([
      Department.find(filter).sort('name').lean(),
      Direction.aggregate([
        { $match: { businessId: req.businessId, type: type, isArchived: { $ne: true } } },
        { $group: { _id: '$departmentId', count: { $sum: 1 } } },
      ]),
    ]);

    const countMap = {};
    dirCounts.forEach(c => { countMap[String(c._id)] = c.count; });

    const result = departments.map(d => ({
      ...d,
      directionCount: countMap[String(d._id)] || 0,
    }));

    res.json(result);
  } catch (err) {
    console.error('Departments GET xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

// ============================================
// POST /api/departments
// Body: { name, description, type }
// ============================================
router.post('/', async (req, res) => {
  try {
    const { name, description, type } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Bo\'lim nomi majburiy' });
    }

    if (!type || !['piecework', 'daily'].includes(type)) {
      return res.status(400).json({ error: "type: piecework yoki daily" });
    }

    // Modul ruxsati
    const hasAccess = await checkModuleAccess(req, type);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Bu tur uchun modul yoqilmagan' });
    }

    const dept = new Department({
      businessId: req.businessId,
      name: String(name).trim(),
      description: description ? String(description).trim() : '',
      type,
    });

    await dept.save();

    const obj = dept.toObject();
    obj.directionCount = 0;
    res.status(201).json(obj);
  } catch (err) {
    console.error('Department POST xato:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

// ============================================
// PUT /api/departments/:id
// ============================================
router.put('/:id', async (req, res) => {
  try {
    const { name, description } = req.body;

    const dept = await Department.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });
    if (!dept) return res.status(404).json({ error: "Bo'lim topilmadi" });

    // Modul ruxsati (bo'limning o'z type bo'yicha)
    const hasAccess = await checkModuleAccess(req, dept.type);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }

    if (name !== undefined) dept.name = String(name).trim();
    if (description !== undefined) dept.description = String(description).trim();

    await dept.save();

    const obj = dept.toObject();
    const count = await Direction.countDocuments({
      businessId: req.businessId,
      departmentId: dept._id,
      isArchived: { $ne: true },
      type: dept.type,
    });
    obj.directionCount = count;

    res.json(obj);
  } catch (err) {
    console.error('Department PUT xato:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

// ============================================
// DELETE /api/departments/:id?force=true
// ============================================
router.delete('/:id', async (req, res) => {
  try {
    const { force } = req.query;
    const dept = await Department.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });
    if (!dept) return res.status(404).json({ error: "Bo'lim topilmadi" });

    const directionsCount = await Direction.countDocuments({
      businessId: req.businessId,
      departmentId: dept._id,
      isArchived: { $ne: true },
    });

    if (directionsCount > 0 && force !== 'true') {
      return res.status(400).json({
        error: `Bu bo'limda ${directionsCount} ta yo'nalish bor`,
        directionsCount,
      });
    }

    // Force bo'lsa, barcha yo'nalishlarni arxivlash
    if (force === 'true') {
      await Direction.updateMany(
        { businessId: req.businessId, departmentId: dept._id },
        { isArchived: true, archivedAt: new Date() }
      );
    }

    await dept.deleteOne();

    res.json({ success: true });
  } catch (err) {
    console.error('Department DELETE xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

module.exports = router;