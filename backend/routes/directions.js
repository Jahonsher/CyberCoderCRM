/**
 * CyberCoderCRM - Directions routes (bo'limlar bilan)
 */

const express = require('express');
const router = express.Router();

const Direction = require('../models/Direction');
const Department = require('../models/Department');

const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');
const requireModule = require('../middleware/requireModule');

router.use(verifyToken, requireAdmin, businessScope, requireModule('directions'));

async function ensureDefaultDepartment(businessId) {
  let dept = await Department.findOne({
    businessId,
    name: 'Umumiy',
    status: 'active',
  });

  if (!dept) {
    dept = await Department.create({
      businessId,
      name: 'Umumiy',
      description: "Umumiy yo'nalishlar",
    });
  }

  return dept;
}

router.get('/', async (req, res) => {
  try {
    const { departmentId } = req.query;

    const filter = {
      businessId: req.businessId,
      status: 'active',
    };

    if (departmentId) {
      filter.departmentId = departmentId;
    }

    const directions = await Direction.find(filter)
      .populate('departmentId', 'name')
      .sort('-createdAt');

    res.json(directions);
  } catch (err) {
    console.error('Directions GET xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, currentPrice, departmentId } = req.body;

    if (!name || currentPrice === undefined || currentPrice === null) {
      return res.status(400).json({ error: 'Nom va narx kerak' });
    }

    const price = Number(currentPrice);
    if (isNaN(price) || price < 0) {
      return res.status(400).json({ error: "Narx noto'g'ri" });
    }

    let deptId = departmentId;
    if (deptId) {
      const dept = await Department.findOne({
        _id: deptId,
        businessId: req.businessId,
        status: 'active',
      });
      if (!dept) {
        return res.status(400).json({ error: "Bo'lim topilmadi" });
      }
    } else {
      const defaultDept = await ensureDefaultDepartment(req.businessId);
      deptId = defaultDept._id;
    }

    const direction = new Direction({
      businessId: req.businessId,
      departmentId: deptId,
      name: String(name).trim(),
      currentPrice: price,
      priceHistory: [{ price, changedAt: new Date() }],
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
    const direction = await Direction.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!direction) {
      return res.status(404).json({ error: "Yo'nalish topilmadi" });
    }

    const { name, currentPrice, departmentId } = req.body;

    if (name) direction.name = String(name).trim();

    if (departmentId) {
      const dept = await Department.findOne({
        _id: departmentId,
        businessId: req.businessId,
      });
      if (dept) direction.departmentId = departmentId;
    }

    if (currentPrice !== undefined && currentPrice !== null) {
      const newPrice = Number(currentPrice);
      if (!isNaN(newPrice) && newPrice !== direction.currentPrice) {
        direction.priceHistory.push({
          price: newPrice,
          changedAt: new Date(),
        });
        direction.currentPrice = newPrice;
      }
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
    const direction = await Direction.findOneAndUpdate(
      { _id: req.params.id, businessId: req.businessId },
      { status: 'archived' },
      { new: true }
    );

    if (!direction) {
      return res.status(404).json({ error: "Yo'nalish topilmadi" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Direction DELETE xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

module.exports = router;