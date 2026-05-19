/**
 * CyberCoderCRM - Monthly Report routes
 * v2: ?startDate=&endDate=&code= qabul qiladi
 * Har xodim uchun: totalShifts, totalEarning, totalPaid, remaining
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

// SalaryPayment optional
let SalaryPayment;
try {
  SalaryPayment = require('../models/SalaryPayment');
} catch (e) {
  SalaryPayment = null;
}

router.use(verifyToken, requireAdmin, businessScope, requireModule('monthlyReport'));

function parseDate(d) {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return dt;
}

function dateToString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * GET /api/monthly-report?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&code=...
 */
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, code } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Sana oralig'i kerak" });
    }

    const start = parseDate(startDate);
    const end = parseDate(endDate);
    if (!start || !end) {
      return res.status(400).json({ error: "Sana noto'g'ri" });
    }

    const startStr = dateToString(start);
    const endStr = dateToString(end);

    const assignFilter = {
      businessId: req.businessId,
      dateString: { $gte: startStr, $lte: endStr },
    };
    if (code && String(code).trim()) {
      assignFilter['employeeSnapshot.code'] = String(code).trim();
    }

    const assignments = await DailyAssignment.find(assignFilter).lean();

    const products = await DailyProduct.find({
      businessId: req.businessId,
      dateString: { $gte: startStr, $lte: endStr },
    }).lean();

    let payments = [];
    if (SalaryPayment) {
      try {
        payments = await SalaryPayment.find({
          businessId: req.businessId,
          dateString: { $gte: startStr, $lte: endStr },
        }).lean();
      } catch (e) {
        payments = [];
      }
    }

    // Xodimlar bo'yicha guruhlash
    const grouped = {};
    for (const a of assignments) {
      const empId = String(a.employeeId);
      if (!grouped[empId]) {
        grouped[empId] = {
          _id: empId,
          firstName: a.employeeSnapshot?.firstName || '-',
          lastName: a.employeeSnapshot?.lastName || '-',
          code: a.employeeSnapshot?.code || '-',
          totalDays: 0,
          totalShifts: 0,
          totalEarning: 0,
          totalPaid: 0,
          remaining: 0,
          assignments: [],
        };
      }
      grouped[empId].totalDays++;
      grouped[empId].totalShifts += a.shift || 0;
      grouped[empId].totalEarning += a.earning || 0;
      grouped[empId].assignments.push(a);
    }

    for (const p of payments) {
      const empId = String(p.employeeId);
      if (grouped[empId]) {
        grouped[empId].totalPaid += p.amount || 0;
      } else if (p.employeeSnapshot) {
        grouped[empId] = {
          _id: empId,
          firstName: p.employeeSnapshot.firstName || '-',
          lastName: p.employeeSnapshot.lastName || '-',
          code: p.employeeSnapshot.code || '-',
          totalDays: 0,
          totalShifts: 0,
          totalEarning: 0,
          totalPaid: p.amount || 0,
          remaining: 0,
          assignments: [],
        };
      }
    }

    const employees = Object.values(grouped).map(e => {
      e.remaining = Math.max(0, e.totalEarning - e.totalPaid);
      return e;
    });

    const totalEarning = assignments.reduce((s, a) => s + (a.earning || 0), 0);
    const totalProductCount = products.reduce((s, p) => s + (p.quantity || 0), 0);
    const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);

    res.json({
      period: { startDate: start, endDate: end, startStr, endStr },
      employees,
      stats: {
        totalEarning,
        totalEmployees: employees.length,
        totalProductCount,
        totalAssignments: assignments.length,
        totalPaid,
      },
    });
  } catch (err) {
    console.error('Monthly report GET xato:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

/**
 * POST /api/monthly-report/pay
 * Body: { employeeIds: [], amount, dateString? }
 */
router.post('/pay', async (req, res) => {
  try {
    if (!SalaryPayment) {
      return res.status(500).json({ error: "SalaryPayment model topilmadi" });
    }

    const { employeeIds, amount, dateString } = req.body;

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({ error: 'employeeIds kerak' });
    }

    const amt = Math.max(0, Number(amount) || 0);
    if (amt <= 0) {
      return res.status(400).json({ error: "Summa 0 dan katta bo'lishi kerak" });
    }

    const payDateString = dateString || dateToString(new Date());

    const payments = [];
    for (const empId of employeeIds) {
      const emp = await Employee.findOne({
        _id: empId,
        businessId: req.businessId,
      });
      if (!emp) continue;

      payments.push({
        businessId: req.businessId,
        employeeId: empId,
        amount: amt,
        dateString: payDateString,
        date: new Date(),
        employeeSnapshot: {
          firstName: emp.firstName,
          lastName: emp.lastName || '-',
          code: emp.code,
        },
      });
    }

    if (payments.length === 0) {
      return res.status(404).json({ error: 'Xodim topilmadi' });
    }

    await SalaryPayment.insertMany(payments);
    res.status(201).json({ success: true, count: payments.length });
  } catch (err) {
    console.error('Pay POST xato:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

/**
 * POST /api/monthly-report/archive
 */
router.post('/archive', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Sana oralig'i kerak" });
    }

    const start = parseDate(startDate);
    const end = parseDate(endDate);
    if (!start || !end) {
      return res.status(400).json({ error: "Sana noto'g'ri" });
    }

    const startStr = dateToString(start);
    const endStr = dateToString(end);

    const [assignments, products] = await Promise.all([
      DailyAssignment.find({
        businessId: req.businessId,
        dateString: { $gte: startStr, $lte: endStr },
      }).lean(),
      DailyProduct.find({
        businessId: req.businessId,
        dateString: { $gte: startStr, $lte: endStr },
      }).lean(),
    ]);

    const totalEarnings = assignments.reduce((s, a) => s + (a.earning || 0), 0);
    const totalShifts = assignments.reduce((s, a) => s + a.shift, 0);
    const uniqueEmployees = new Set(assignments.map(a => a.employeeSnapshot?.code)).size;
    const totalProducts = products.reduce((s, p) => s + (p.quantity || 0), 0);

    const periodLabel = `${startStr} → ${endStr}`;

    const archive = new Archive({
      businessId: req.businessId,
      periodLabel,
      startDate: start,
      endDate: end,
      archivedAt: new Date(),
      data: { assignments, products },
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