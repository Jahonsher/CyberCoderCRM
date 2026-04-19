const express = require('express');
const router = express.Router();

const DailyAssignment = require('../models/DailyAssignment');
const DailyProduct = require('../models/DailyProduct');
const Archive = require('../models/Archive');

const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');
const requireModule = require('../middleware/requireModule');
const { toDateString } = require('../utils/helpers');

router.use(verifyToken, requireAdmin, businessScope, requireModule('monthlyReport'));

/**
 * GET /api/monthly-report
 */
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, code } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate va endDate kerak' });
    }

    const startStr = toDateString(startDate);
    const endStr = toDateString(endDate);

    const filter = {
      ...req.businessScope,
      dateString: { $gte: startStr, $lte: endStr },
    };

    if (code && code.trim()) {
      filter['employeeSnapshot.code'] = code.trim();
    }

    const assignments = await DailyAssignment.find(filter).sort({ date: 1 });

    const employeeMap = new Map();

    for (const a of assignments) {
      const empId = a.employeeId.toString();

      if (!employeeMap.has(empId)) {
        employeeMap.set(empId, {
          employeeId: a.employeeId,
          firstName: a.employeeSnapshot.firstName,
          lastName: a.employeeSnapshot.lastName,
          code: a.employeeSnapshot.code,
          totalEarning: 0,
          totalDays: 0,
          totalShifts: 0,
          assignments: [],
        });
      }

      const emp = employeeMap.get(empId);
      emp.totalEarning += a.earning;
      emp.totalDays += 1;
      emp.totalShifts += a.shift;
      emp.assignments.push({
        _id: a._id,
        date: a.date,
        dateString: a.dateString,
        directionName: a.directionSnapshot.name,
        priceSnapshot: a.priceSnapshot,
        shift: a.shift,
        earning: a.earning,
      });
    }

    const employees = Array.from(employeeMap.values()).sort(
      (a, b) => b.totalEarning - a.totalEarning
    );

    const totalEarning = employees.reduce((sum, e) => sum + e.totalEarning, 0);

    const products = await DailyProduct.find({
      ...req.businessScope,
      dateString: { $gte: startStr, $lte: endStr },
    }).sort({ date: 1 });

    const productMap = new Map();
    for (const p of products) {
      if (!productMap.has(p.productName)) {
        productMap.set(p.productName, { name: p.productName, totalQuantity: 0, count: 0 });
      }
      const item = productMap.get(p.productName);
      item.totalQuantity += p.quantity;
      item.count += 1;
    }
    const productStats = Array.from(productMap.values());

    res.json({
      startDate: startStr,
      endDate: endStr,
      employees,
      products,
      productStats,
      stats: {
        totalEmployees: employees.length,
        totalEarning,
        totalAssignments: assignments.length,
        totalProductCount: products.reduce((s, p) => s + p.quantity, 0),
      },
    });
  } catch (err) {
    console.error('GET /monthly-report xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * POST /api/monthly-report/archive
 */
router.post('/archive', async (req, res) => {
  try {
    const { startDate, endDate, label } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate va endDate kerak' });
    }

    const startStr = toDateString(startDate);
    const endStr = toDateString(endDate);

    const [assignments, products] = await Promise.all([
      DailyAssignment.find({
        ...req.businessScope,
        dateString: { $gte: startStr, $lte: endStr },
      }).lean(),
      DailyProduct.find({
        ...req.businessScope,
        dateString: { $gte: startStr, $lte: endStr },
      }).lean(),
    ]);

    if (assignments.length === 0 && products.length === 0) {
      return res.status(400).json({
        error: 'Bu sanalar oralig\'ida ma\'lumot yo\'q',
      });
    }

    const employeeMap = new Map();
    for (const a of assignments) {
      const empId = a.employeeId.toString();
      if (!employeeMap.has(empId)) {
        employeeMap.set(empId, {
          employeeId: a.employeeId,
          firstName: a.employeeSnapshot.firstName,
          lastName: a.employeeSnapshot.lastName,
          code: a.employeeSnapshot.code,
          totalEarning: 0,
          totalDays: 0,
          totalShifts: 0,
        });
      }
      const emp = employeeMap.get(empId);
      emp.totalEarning += a.earning;
      emp.totalDays += 1;
      emp.totalShifts += a.shift;
    }

    const employeeSummary = Array.from(employeeMap.values());

    const archive = await Archive.create({
      ...req.businessScope,
      periodStart: new Date(startStr),
      periodEnd: new Date(endStr),
      periodLabel: label || `${startStr} — ${endStr}`,
      archivedAt: new Date(),
      employeeSummary,
      assignments: assignments.map((a) => ({
        employeeId: a.employeeId,
        employeeSnapshot: a.employeeSnapshot,
        directionId: a.directionId,
        directionSnapshot: a.directionSnapshot,
        priceSnapshot: a.priceSnapshot,
        shift: a.shift,
        earning: a.earning,
        date: a.date,
        dateString: a.dateString,
      })),
      products: products.map((p) => ({
        productName: p.productName,
        quantity: p.quantity,
        date: p.date,
        dateString: p.dateString,
        note: p.note,
      })),
      stats: {
        totalEarnings: employeeSummary.reduce((s, e) => s + e.totalEarning, 0),
        totalAssignments: assignments.length,
        totalEmployeesWorked: employeeSummary.length,
        totalProducts: products.length,
        totalProductQuantity: products.reduce((s, p) => s + p.quantity, 0),
      },
      archivedBy: 'admin',
    });

    res.status(201).json({
      success: true,
      archive: {
        _id: archive._id,
        periodLabel: archive.periodLabel,
        archivedAt: archive.archivedAt,
        stats: archive.stats,
      },
      message: `${assignments.length} ta biriktirish va ${products.length} ta mahsulot arxivlandi`,
    });
  } catch (err) {
    console.error('POST /archive xato:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

module.exports = router;