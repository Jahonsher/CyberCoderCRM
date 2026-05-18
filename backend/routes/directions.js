/**
 * CyberCoderCRM - Directions routes
 * Endi piecework va daily turlari bilan
 */

const express = require('express');
const router = express.Router();

const Direction = require('../models/Direction');
const Department = require('../models/Department');
const DailyAssignment = require('../models/DailyAssignment');

const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');
const requireModule = require('../middleware/requireModule');

router.use(verifyToken, requireAdmin, businessScope, requireModule('directions'));

/**
 * GET /api/directions
 * ?departmentId=...  - bo'limga qarab filter
 * ?type=piecework | daily  - turga qarab filter (yoqilganlar)
 */
router.get('/', async (req, res) => {
  try {
    const { departmentId, type } = req.query;

    const filter = {
      businessId: req.businessId,
      status: 'active',
    };

    if (departmentId) {
      filter.departmentId = departmentId;
    }

    // Type bo'yicha filter - faqat yoqilganlar
    if (type === 'piecework') {
      filter.pieceworkEnabled = true;
    } else if (type === 'daily') {
      filter.dailyEnabled = true;
    }

    const directions = await Direction.find(filter)
      .populate('departmentId', 'name')
      .sort('name');

    res.json(directions);
  } catch (err) {
    console.error('Directions GET xato:', err);
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
      return res.status(400).json({ error: "Nom va bo'lim kerak" });
    }

    const pwEnabled = pieceworkEnabled !== false; // default true
    const dEnabled = dailyEnabled === true;       // default false
    const pwPrice = Number(pieceworkPrice || 0);
    const dPrice = Number(dailyPrice || 0);

    // Kamida bittasi yoqilgan bo'lishi kerak
    if (!pwEnabled && !dEnabled) {
      return res.status(400).json({ error: "Kamida bitta ish turi yoqilgan bo'lishi kerak" });
    }

    // Bo'lim tekshirish
    const department = await Department.findOne({
      _id: departmentId,
      businessId: req.businessId,
    });
    if (!department) {
      return res.status(404).json({ error: "Bo'lim topilmadi" });
    }

    const direction = new Direction({
      businessId: req.businessId,
      departmentId,
      name: String(name).trim(),
      pieceworkEnabled: pwEnabled,
      pieceworkPrice: pwPrice,
      dailyEnabled: dEnabled,
      dailyPrice: dPrice,
      currentPrice: pwPrice, // backward compatibility
    });

    await direction.save();
    const populated = await Direction.findById(direction._id).populate('departmentId', 'name');
    res.status(201).json(populated);
  } catch (err) {
    console.error('Directions POST xato:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const direction = await Direction.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!direction) {
      return res.status(404).json({ error: "Yo'nalish topilmadi" });
    }

    const {
      name,
      departmentId,
      pieceworkEnabled,
      pieceworkPrice,
      dailyEnabled,
      dailyPrice,
    } = req.body;

    if (name !== undefined) direction.name = String(name).trim();
    if (departmentId !== undefined) direction.departmentId = departmentId;
    if (pieceworkEnabled !== undefined) direction.pieceworkEnabled = !!pieceworkEnabled;
    if (pieceworkPrice !== undefined) {
      direction.pieceworkPrice = Number(pieceworkPrice);
      direction.currentPrice = Number(pieceworkPrice); // backward compat
    }
    if (dailyEnabled !== undefined) direction.dailyEnabled = !!dailyEnabled;
    if (dailyPrice !== undefined) direction.dailyPrice = Number(dailyPrice);

    // Kamida bittasi yoqilgan bo'lishi
    if (!direction.pieceworkEnabled && !direction.dailyEnabled) {
      return res.status(400).json({ error: "Kamida bitta ish turi yoqilgan bo'lishi kerak" });
    }

    await direction.save();
    const populated = await Direction.findById(direction._id).populate('departmentId', 'name');
    res.json(populated);
  } catch (err) {
    console.error('Directions PUT xato:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { force } = req.query;
    const direction = await Direction.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!direction) {
      return res.status(404).json({ error: "Yo'nalish topilmadi" });
    }

    // Tekshirish - hech kim biriktirilganmi
    const assigned = await DailyAssignment.countDocuments({
      businessId: req.businessId,
      directionId: direction._id,
    });

    if (assigned > 0 && force !== 'true') {
      return res.status(400).json({
        error: "Bu yo'nalishga xodimlar biriktirilgan. Avval ularni o'chiring yoki force=true qiling",
        assignedCount: assigned,
      });
    }

    await Direction.findByIdAndDelete(direction._id);
    res.json({ success: true });
  } catch (err) {
    console.error('Directions DELETE xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

module.exports = router;