/**
 * CyberCoderCRM - Archive routes
 * Endi Arxiv = To'lov tarixi
 */

const express = require('express');
const router = express.Router();

const SalaryPayment = require('../models/SalaryPayment');

const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');
const requireModule = require('../middleware/requireModule');

router.use(verifyToken, requireAdmin, businessScope, requireModule('archive'));

/**
 * GET /api/archive
 * Filter: ?month=YYYY-MM, ?code=..., ?startDate=..., ?endDate=...
 */
router.get('/', async (req, res) => {
  try {
    const { month, code, startDate, endDate } = req.query;

    const filter = { businessId: req.businessId };

    if (month) filter.periodMonth = month;
    if (code) filter['employeeSnapshot.code'] = code.trim();
    if (startDate && endDate) {
      filter.paidAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const payments = await SalaryPayment.find(filter).sort('-paidAt');

    // Oy bo'yicha guruhlash
    const grouped = {};
    for (const p of payments) {
      const key = p.periodMonth;
      if (!grouped[key]) {
        grouped[key] = {
          periodMonth: key,
          payments: [],
          totalAmount: 0,
          totalEmployees: 0,
        };
      }
      grouped[key].payments.push(p);
      grouped[key].totalAmount += p.amount;
      grouped[key].totalEmployees++;
    }

    const months = Object.values(grouped).sort((a, b) =>
      b.periodMonth.localeCompare(a.periodMonth)
    );

    const totalStats = {
      totalPayments: payments.length,
      totalAmount: payments.reduce((s, p) => s + p.amount, 0),
      uniqueEmployees: new Set(payments.map(p => String(p.employeeId))).size,
      monthsCount: months.length,
    };

    res.json({ months, stats: totalStats });
  } catch (err) {
    console.error('Archive GET xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const payment = await SalaryPayment.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!payment) return res.status(404).json({ error: "To'lov topilmadi" });
    res.json(payment);
  } catch (err) {
    console.error('Archive detail xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const payment = await SalaryPayment.findOneAndDelete({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!payment) return res.status(404).json({ error: "To'lov topilmadi" });
    res.json({ success: true });
  } catch (err) {
    console.error('Archive DELETE xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

module.exports = router;