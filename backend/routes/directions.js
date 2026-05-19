/**
 * CyberCoderCRM - Direction routes
 * YANGI:
 *   - ?type=piecework|daily filter (majburiy GET da)
 *   - POST/PUT body'da type kerak
 *   - Modul ruxsati: piecework -> directionsPiecework, daily -> directionsDaily
 */

const express = require('express');
const router = express.Router();

const Direction = require('../models/Direction');
const Department = require('../models/Department');
const Business = require('../models/Business');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');

router.use(verifyToken, requireAdmin, businessScope);

// Modul ruxsatini tekshirish - turga qarab
async function checkModuleAccess(req, type) {
  const moduleKey = type === 'daily' ? 'directionsDaily' : 'directionsPiecework';
  const biz = await Business.findById(req.businessId).select('enabledModules');
  if (!biz) return false;
  const enabled = biz.enabledModules || [];
  // Yangi modul yoki eski 'directions' yoqilgan bo'lsa - ruxsat
  return enabled.includes(moduleKey) || enabled.includes('directions');
}

router.get('/', async (req, res) => {
  try {
    const { departmentId, type } = req.query;

    // Type majburiy
    if (!type || !['piecework', 'daily'].includes(type)) {
      return res.status(400).json({ error: "type kerak: piecework yoki daily" });
    }

    // Modul ruxsati
    const hasAccess = await checkModuleAccess(req, type);
    if (!hasAccess) {
      return res.status(403).json({ error: `Bu modul yoqilmagan` });
    }

    const filter = {
      businessId: req.businessId,
      isArchived: { $ne: true },
      type,
    };

    if (departmentId) filter.departmentId = departmentId;

    const directions = await Direction.find(filter)
      .populate('departmentId', 'name')
      .sort('-createdAt')
      .lean();

    res.json(directions);
  } catch (err) {
    console.error('Directions GET xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, departmentId, type, price } = req.body;

    if (!name || !departmentId) {
      return res.status(400).json({ error: "Nom va bo'lim majburiy" });
    }

    if (!type || !['piecework', 'daily'].includes(type)) {
      return res.status(400).json({ error: "type: piecework yoki daily" });
    }

    // Modul ruxsati
    const hasAccess = await checkModuleAccess(req, type);
    if (!hasAccess) {
      return res.status(403).json({ error: `Bu tur uchun modul yoqilmagan` });
    }

    const dept = await Department.findOne({
      _id: departmentId,
      businessId: req.businessId,
    });
    if (!dept) return res.status(404).json({ error: "Bo'lim topilmadi" });

    const priceNum = Math.max(0, Number(price) || 0);

    const direction = new Direction({
      businessId: req.businessId,
      departmentId,
      name: String(name).trim(),
      type,
      price: priceNum,
      currentPrice: priceNum, // backward compat
    });

    await direction.save();
    await direction.populate('departmentId', 'name');

    res.status(201).json(direction);
  } catch (err) {
    console.error('Direction POST xato:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, departmentId, type, price } = req.body;

    const direction = await Direction.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });
    if (!direction) return res.status(404).json({ error: "Yo'nalish topilmadi" });

    // Modul ruxsati (turini bilgan holda)
    const hasAccess = await checkModuleAccess(req, direction.type);
    if (!hasAccess) {
      return res.status(403).json({ error: `Bu tur uchun modul yoqilmagan` });
    }

    if (name !== undefined) direction.name = String(name).trim();

    if (departmentId !== undefined) {
      const dept = await Department.findOne({
        _id: departmentId,
        businessId: req.businessId,
      });
      if (!dept) return res.status(404).json({ error: "Bo'lim topilmadi" });
      direction.departmentId = departmentId;
    }

    // Type o'zgartirish ruxsat bermaymiz (uni o'chirib qayta yaratish kerak)
    if (type !== undefined && type !== direction.type) {
      return res.status(400).json({
        error: "Yo'nalish turini o'zgartirib bo'lmaydi. O'chirib qayta yarating."
      });
    }

    if (price !== undefined) {
      const priceNum = Math.max(0, Number(price) || 0);
      // Narx tarixi
      if (priceNum !== direction.price && direction.price > 0) {
        direction.priceHistory = direction.priceHistory || [];
        direction.priceHistory.push({
          price: direction.price,
          changedAt: new Date(),
        });
      }
      direction.price = priceNum;
      direction.currentPrice = priceNum; // backward compat
    }

    await direction.save();
    await direction.populate('departmentId', 'name');

    res.json(direction);
  } catch (err) {
    console.error('Direction PUT xato:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const direction = await Direction.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });
    if (!direction) return res.status(404).json({ error: "Yo'nalish topilmadi" });

    direction.isArchived = true;
    direction.archivedAt = new Date();
    await direction.save();

    res.json({ success: true });
  } catch (err) {
    console.error('Direction DELETE xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

module.exports = router;