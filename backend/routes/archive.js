/**
 * CyberCoderCRM - Archive routes
 */

const express = require('express');
const router = express.Router();

const Archive = require('../models/Archive');

const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');
const requireModule = require('../middleware/requireModule');

router.use(verifyToken, requireAdmin, businessScope, requireModule('archive'));

router.get('/', async (req, res) => {
  try {
    const archives = await Archive.find({
      businessId: req.businessId,
    }).sort('-archivedAt');
    res.json(archives);
  } catch (err) {
    console.error('Archive GET xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const archive = await Archive.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!archive) {
      return res.status(404).json({ error: 'Arxiv topilmadi' });
    }

    res.json(archive);
  } catch (err) {
    console.error('Archive detail xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

module.exports = router;
