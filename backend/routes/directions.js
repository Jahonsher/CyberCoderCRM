/**
 * CyberCoderCRM - Direction routes
 * YANGI: Biznes faqat yoqgan ish turlarida yo'nalish yaratishi mumkin
 *
 * Query params:
 *   ?departmentId=...      - bo'lim bo'yicha filter
 *   ?type=piecework|daily  - turga qarab (yoqilganlar)
 */

const express = require('express');
const router = express.Router();

const Direction = require('../models/Direction');
const Department = require('../models/Department');
const Business = require('../models/Business');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');
const requireModule = require('../middleware/requireModule');

router.use(verifyToken, requireAdmin, businessScope, requireModule('directions'));

// Bizness enabledWorkTypes ni olish (cache uchun req'ga qo'yamiz)
async function getBusinessWorkTypes(businessId) {
  const biz = await Business.findById(businessId).select('enabledWorkTypes');
  if (!biz) return { piecework: true, daily: true };
  return biz.enabledWorkTypes || { piecework: true, daily: true };
}

router.get('/', async (req, res) => {
  try {
    const { departmentId, type } = req.query;
    const filter = {
      businessId: req.businessId,
      isArchived: { $ne: true },
    };

    if (departmentId) filter.departmentId = departmentId;

    if (type === 'piecework') {
      filter.pieceworkEnabled = true;
    } else if (type === 'daily') {
      filter.dailyEnabled = true;
    }

    const directions = await Direction.find(filter)
      .populate('departmentId', 'name')
      .sort('-createdAt')
      .lean();

    res.json(directions);
  } catch (err) {
    console.error('Directions xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      name,
      departmentId,
      pieceworkEnabled,
      pieceworkPrice,
      dailyEnabled,
      dailyPrice,
    } = req.body;

    if (!name || !departmentId) {
      return res.status(400).json({ error: "Nom va bo'lim majburiy" });
    }

    // Biznesning yoqgan ish turlarini olamiz
    const businessTypes = await getBusinessWorkTypes(req.businessId);

    let pwEnabled = pieceworkEnabled !== false;
    let dEnabled = dailyEnabled === true;

    // Biznesda yoqilmagan turlarni avtomatik o'chiramiz
    if (!businessTypes.piecework) pwEnabled = false;
    if (!businessTypes.daily) dEnabled = false;

    if (!pwEnabled && !dEnabled) {
      return res.status(400).json({
        error: "Kamida bitta ish turi yoqilgan bo'lishi kerak. Biznesda bunday tur yoqilmagan bo'lsa, SuperAdmin'ga murojaat qiling."
      });
    }

    const dept = await Department.findOne({
      _id: departmentId,
      businessId: req.businessId,
    });
    if (!dept) return res.status(404).json({ error: "Bo'lim topilmadi" });

    const pwPrice = pwEnabled ? Math.max(0, Number(pieceworkPrice) || 0) : 0;
    const dPrice = dEnabled ? Math.max(0, Number(dailyPrice) || 0) : 0;

    const direction = new Direction({
      businessId: req.businessId,
      departmentId,
      name: String(name).trim(),
      pieceworkEnabled: pwEnabled,
      pieceworkPrice: pwPrice,
      dailyEnabled: dEnabled,
      dailyPrice: dPrice,
      currentPrice: pwPrice, // backward compat
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
    const {
      name,
      departmentId,
      pieceworkEnabled,
      pieceworkPrice,
      dailyEnabled,
      dailyPrice,
    } = req.body;

    const direction = await Direction.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });
    if (!direction) return res.status(404).json({ error: "Yo'nalish topilmadi" });

    // Biznesning ruxsati
    const businessTypes = await getBusinessWorkTypes(req.businessId);

    if (name !== undefined) direction.name = String(name).trim();

    if (departmentId !== undefined) {
      const dept = await Department.findOne({
        _id: departmentId,
        businessId: req.businessId,
      });
      if (!dept) return res.status(404).json({ error: "Bo'lim topilmadi" });
      direction.departmentId = departmentId;
    }

    // Pieework
    if (pieceworkEnabled !== undefined) {
      const wantEnable = !!pieceworkEnabled;
      // Biznesda yoqilmagan bo'lsa - false qilamiz
      direction.pieceworkEnabled = wantEnable && businessTypes.piecework;
    }
    if (pieceworkPrice !== undefined && direction.pieceworkEnabled) {
      direction.pieceworkPrice = Math.max(0, Number(pieceworkPrice) || 0);
      direction.currentPrice = direction.pieceworkPrice; // sync
    }

    // Daily
    if (dailyEnabled !== undefined) {
      const wantEnable = !!dailyEnabled;
      direction.dailyEnabled = wantEnable && businessTypes.daily;
    }
    if (dailyPrice !== undefined && direction.dailyEnabled) {
      direction.dailyPrice = Math.max(0, Number(dailyPrice) || 0);
    }

    // Kamida bitta yoqilgan bo'lishi kerak
    if (!direction.pieceworkEnabled && !direction.dailyEnabled) {
      return res.status(400).json({
        error: "Kamida bitta ish turi yoqilgan bo'lishi kerak"
      });
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