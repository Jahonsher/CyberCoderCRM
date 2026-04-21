/**
 * CyberCoderCRM - Monthly Report routes
 */

const express = require('express');
const router = express.Router();

const Employee = require('../models/Employee');
const DailyAssignment = require('../models/DailyAssignment');
const DailyProduct = require('../models/DailyProduct');
const Archive = require('../models/Archive');

const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');
const requireModule = require('../middleware/requireModule');

router.use(verifyToken, requireAdmin, businessScope, requireModule('monthlyReport'));

/**
 * GET /api/monthly-report?startDate=...&endDate=...&code=...
 */
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, code } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Sana oralig\'i kerak' });
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const filter = {
      businessId: req.businessId,
      date: { $gte: start, $lte: end },
    };

    if (code) {
      filter['employeeSnapshot.code'] = code.trim();
    }

    const assignments = await DailyAssignment.find(filter).sort('date');
    const products = await DailyProduct.find({
      businessId: req.businessId,
      date: { $gte: start, $lte: end },
    });

    // Xodimlar bo'yicha guruhlash
    const grouped = {};
    for (const a of assignments) {
      const key = a.employeeSnapshot.code;
      if (!grouped[key]) {
        grouped[key] = {
          firstName: a.employeeSnapshot.firstName,
          lastName: a.employeeSnapshot.lastName,
          code: a.employeeSnapshot.code,
          totalDays: 0,
          totalShifts: 0,
          totalEarning: 0,
        };
      }
      grouped[key].totalDays++;
      grouped[key].totalShifts += a.shift;
      grouped[key].totalEarning += a.earning;
    }

    const employees = Object.values(grouped);

    const totalEarning = assignments.reduce((s, a) => s + (a.earning || 0), 0);
    const totalProductCount = products.reduce((s, p) => s + (p.quantity || 0), 0);

    res.json({
      period: { startDate: start, endDate: end },
      employees,
      stats: {
        totalEarning,
        totalEmployees: employees.length,
        totalProductCount,
        totalAssignments: assignments.length,
      },
    });
  } catch (err) {
    console.error('Monthly report GET xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * POST /api/monthly-report/archive
 */
router.post('/archive', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Sana oralig\'i kerak' });
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const [assignments, products] = await Promise.all([
      DailyAssignment.find({
        businessId: req.businessId,
        date: { $gte: start, $lte: end },
      }).lean(),
      DailyProduct.find({
        businessId: req.businessId,
        date: { $gte: start, $lte: end },
      }).lean(),
    ]);

    const totalEarnings = assignments.reduce((s, a) => s + (a.earning || 0), 0);
    const totalShifts = assignments.reduce((s, a) => s + a.shift, 0);
    const uniqueEmployees = new Set(assignments.map(a => a.employeeSnapshot?.code)).size;
    const totalProducts = products.reduce((s, p) => s + (p.quantity || 0), 0);

    const periodLabel = `${start.toLocaleDateString('uz')} - ${end.toLocaleDateString('uz')}`;

    const archive = new Archive({
      businessId: req.businessId,
      periodLabel,
      startDate: start,
      endDate: end,
      archivedAt: new Date(),
      data: {
        assignments,
        products,
      },
      stats: {
        totalEarnings,
        totalEmployeesWorked: uniqueEmployees,
        totalShifts,
        totalProducts,
      },
    });

    await archive.save();
    res.status(201).json({ success: true, archiveId: archive._id });
  } catch (err) {
    console.error('Archive POST xato:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

module.exports = router;