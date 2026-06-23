/**
 * CyberCoderCRM - Directions (v2)
 *
 * Faqat ON-bo'limda (allowDirections=true) yo'nalish yaratish mumkin.
 * Har yo'nalish: nomi + price (1 dona uchun).
 * Narx o'zgarsa eski narx priceHistory ga push qilinadi.
 */

const express = require('express');
const router = express.Router();

const Direction = require('../models/Direction');
const Department = require('../models/Department');

const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');
const requireModule = require('../middleware/requireModule');

router.use(verifyToken, requireAdmin, businessScope, requireModule('directions'));

router.get('/', async (req, res) => {
  try {
    const { departmentId } = req.query;
    const filter = { businessId: req.businessId, isArchived: { $ne: true } };
    if (departmentId) filter.departmentId = departmentId;

    const directions = await Direction.find(filter)
      .populate('departmentId', 'name allowDirections')
      .sort('-createdAt')
      .lean();
    res.json(directions);
  } catch (err) {
    console.error('Directions GET:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, departmentId, price } = req.body;
    if (!name || !departmentId) return res.status(400).json({ error: "Nom va bo'lim majburiy" });

    const dept = await Department.findOne({ _id: departmentId, businessId: req.businessId });
    if (!dept) return res.status(404).json({ error: "Bo'lim topilmadi" });
    if (!dept.allowDirections) {
      return res.status(400).json({ error: "Bu bo'lim OFF rejimda — yo'nalish qo'sha olmaydi" });
    }

    const direction = await Direction.create({
      businessId: req.businessId,
      departmentId,
      name: String(name).trim(),
      price: Math.max(0, Number(price) || 0),
    });
    await direction.populate('departmentId', 'name allowDirections');
    res.status(201).json(direction);
  } catch (err) {
    console.error('Direction POST:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const direction = await Direction.findOne({ _id: req.params.id, businessId: req.businessId });
    if (!direction) return res.status(404).json({ error: "Yo'nalish topilmadi" });

    const { name, price } = req.body;
    if (name !== undefined) direction.name = String(name).trim();
    if (price !== undefined) {
      const newPrice = Math.max(0, Number(price) || 0);
      if (newPrice !== direction.price && direction.price > 0) {
        direction.priceHistory = direction.priceHistory || [];
        direction.priceHistory.push({ price: direction.price, changedAt: new Date() });
      }
      direction.price = newPrice;
    }

    await direction.save();
    await direction.populate('departmentId', 'name allowDirections');
    res.json(direction);
  } catch (err) {
    console.error('Direction PUT:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const direction = await Direction.findOne({ _id: req.params.id, businessId: req.businessId });
    if (!direction) return res.status(404).json({ error: "Yo'nalish topilmadi" });

    direction.isArchived = true;
    direction.archivedAt = new Date();
    await direction.save();
    res.json({ success: true });
  } catch (err) {
    console.error('Direction DELETE:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

module.exports = router;
