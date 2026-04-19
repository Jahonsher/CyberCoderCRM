const express = require('express');
const router = express.Router();

const Direction = require('../models/Direction');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');

// Barcha route'lar admin uchun
router.use(verifyToken, requireAdmin, businessScope);

/**
 * GET /api/directions
 * Biznes yo'nalishlari
 *
 * Query: ?includeArchived=true (arxivlanganlarni ham ko'rsatish)
 */
router.get('/', async (req, res) => {
  try {
    const filter = { ...req.businessScope };

    if (req.query.includeArchived !== 'true') {
      filter.status = 'active';
    }

    const directions = await Direction.find(filter).sort({ createdAt: -1 });
    res.json(directions);
  } catch (err) {
    console.error('GET /directions xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * GET /api/directions/:id
 * Bitta yo'nalish + narx tarixi
 */
router.get('/:id', async (req, res) => {
  try {
    const direction = await Direction.findOne({
      _id: req.params.id,
      ...req.businessScope,
    });

    if (!direction) {
      return res.status(404).json({ error: 'Yo\'nalish topilmadi' });
    }

    res.json(direction);
  } catch (err) {
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * POST /api/directions
 * Yangi yo'nalish qo'shish
 *
 * Body: { name, currentPrice }
 */
router.post('/', async (req, res) => {
  try {
    const { name, currentPrice } = req.body;

    if (!name || currentPrice === undefined || currentPrice === null) {
      return res.status(400).json({
        error: 'Nomi va narxi majburiy',
      });
    }

    const price = Number(currentPrice);
    if (isNaN(price) || price < 0) {
      return res.status(400).json({ error: 'Narx to\'g\'ri raqam bo\'lishi kerak' });
    }

    // Nom unique tekshirish (active yo'nalishlar ichida)
    const existing = await Direction.findOne({
      ...req.businessScope,
      name: name.trim(),
      status: 'active',
    });
    if (existing) {
      return res.status(400).json({
        error: 'Bu yo\'nalish allaqachon mavjud',
      });
    }

    const direction = await Direction.create({
      ...req.businessScope,
      name: name.trim(),
      currentPrice: price,
    });

    res.status(201).json({ success: true, direction });
  } catch (err) {
    console.error('POST /directions xato:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

/**
 * PUT /api/directions/:id
 * Yo'nalishni yangilash
 *
 * MUHIM: Narx o'zgartirilsa, TARIXGA qo'shiladi
 * Eski kunlik biriktirishlar eski narxda qoladi (snapshot)
 * Yangi biriktirishlar yangi narxda bo'ladi
 */
router.put('/:id', async (req, res) => {
  try {
    const direction = await Direction.findOne({
      _id: req.params.id,
      ...req.businessScope,
    });

    if (!direction) {
      return res.status(404).json({ error: 'Yo\'nalish topilmadi' });
    }

    const { name, currentPrice } = req.body;

    // Nom o'zgarsa - unique tekshirish
    if (name && name.trim() !== direction.name) {
      const existing = await Direction.findOne({
        ...req.businessScope,
        name: name.trim(),
        status: 'active',
        _id: { $ne: direction._id },
      });
      if (existing) {
        return res.status(400).json({ error: 'Bu nom boshqa yo\'nalishda mavjud' });
      }
      direction.name = name.trim();
    }

    // Narx o'zgarsa
    if (currentPrice !== undefined && currentPrice !== null) {
      const price = Number(currentPrice);
      if (isNaN(price) || price < 0) {
        return res.status(400).json({ error: 'Narx to\'g\'ri raqam bo\'lishi kerak' });
      }

      if (price !== direction.currentPrice) {
        direction.currentPrice = price;
        // priceHistory avtomatik yangilanadi (pre-save hook)
      }
    }

    await direction.save();

    res.json({ success: true, direction });
  } catch (err) {
    console.error('PUT /directions xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * DELETE /api/directions/:id
 * Yo'nalishni arxivlash (soft delete)
 * Eski biriktirishlar saqlanib qoladi
 */
router.delete('/:id', async (req, res) => {
  try {
    const direction = await Direction.findOne({
      _id: req.params.id,
      ...req.businessScope,
      status: 'active',
    });

    if (!direction) {
      return res.status(404).json({ error: 'Yo\'nalish topilmadi' });
    }

    direction.status = 'archived';
    await direction.save();

    res.json({
      success: true,
      message: 'Yo\'nalish arxivlandi',
    });
  } catch (err) {
    console.error('DELETE /directions xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

module.exports = router;