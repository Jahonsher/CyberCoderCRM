const express = require('express');
const router = express.Router();

const Archive = require('../models/Archive');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');
const requireModule = require('../middleware/requireModule');

router.use(verifyToken, requireAdmin, businessScope, requireModule('archive'));

/**
 * GET /api/archive
 */
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const filter = { ...req.businessScope };

    if (startDate && endDate) {
      filter.$or = [
        {
          periodStart: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        },
        {
          periodEnd: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        },
      ];
    }

    const archives = await Archive.find(filter)
      .select('periodStart periodEnd periodLabel archivedAt stats archivedBy')
      .sort({ archivedAt: -1 });

    res.json(archives);
  } catch (err) {
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * GET /api/archive/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const archive = await Archive.findOne({
      _id: req.params.id,
      ...req.businessScope,
    });

    if (!archive) {
      return res.status(404).json({ error: 'Arxiv topilmadi' });
    }

    res.json(archive);
  } catch (err) {
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * DELETE /api/archive/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const result = await Archive.deleteOne({
      _id: req.params.id,
      ...req.businessScope,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Arxiv topilmadi' });
    }

    res.json({ success: true, message: 'Arxiv o\'chirildi' });
  } catch (err) {
    res.status(500).json({ error: 'Server xatosi' });
  }
});

module.exports = router;