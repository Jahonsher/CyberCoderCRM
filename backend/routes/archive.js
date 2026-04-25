/**
 * CyberCoderCRM - Archive (To'lov tarixi)
 * Endi: SalaryPayment'lar kun bo'yicha
 */

const express = require('express');
const router = express.Router();

const SalaryPayment = require('../models/SalaryPayment');

const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');
const requireModule = require('../middleware/requireModule');

router.use(verifyToken, requireAdmin, businessScope, requireModule('archive'));

/**
 * GET /api/archive?month=YYYY-MM&code=...
 */
router.get('/', async (req, res) => {
  try {
    const { month, code, startDate, endDate } = req.query;

    const filter = { businessId: req.businessId };

    if (month) {
      // dateString boshlanishi shu oy bilan
      filter.dateString = { $regex: `^${month}` };
    }

    if (code) {
      filter['employeeSnapshot.code'] = code.trim();
    }

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
      // dateString'dan oyni olish: "2026-04-15" → "2026-04"
      const monthKey = p.dateString ? p.dateString.slice(0, 7) : 'unknown';
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          periodMonth: monthKey,
          payments: [],
          totalAmount: 0,
          totalEmployees: new Set(),
        };
      }
      grouped[monthKey].payments.push(p);
      grouped[monthKey].totalAmount += p.amount;
      grouped[monthKey].totalEmployees.add(String(p.employeeId));
    }

    const months = Object.values(grouped)
      .map(m => ({
        ...m,
        totalEmployees: m.totalEmployees.size,
      }))
      .sort((a, b) => b.periodMonth.localeCompare(a.periodMonth));

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