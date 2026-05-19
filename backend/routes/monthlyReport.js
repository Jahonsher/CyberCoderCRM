/**
 * CyberCoderCRM - Monthly Report routes
 * v2: ?year=&month= qabul qiladi, daysData strukturasi qaytaradi
 */

const express = require('express');
const router = express.Router();

const Employee = require('../models/Employee');
const DailyAssignment = require('../models/DailyAssignment');
const DailyProduct = require('../models/DailyProduct');
const SalaryPayment = require('../models/SalaryPayment');
const Archive = require('../models/Archive');

const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');
const requireModule = require('../middleware/requireModule');

router.use(verifyToken, requireAdmin, businessScope, requireModule('monthlyReport'));

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * GET /api/monthly-report?year=2025&month=1
 */
router.get('/', async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);

    if (month < 1 || month > 12) {
      return res.status(400).json({ error: 'Oy 1-12 oralig\'ida bo\'lishi kerak' });
    }

    const totalDays = daysInMonth(year, month);

    // Sana oralig'i (string)
    const monthStr = String(month).padStart(2, '0');
    const startDateStr = `${year}-${monthStr}-01`;
    const endDateStr = `${year}-${monthStr}-${String(totalDays).padStart(2, '0')}`;

    // Barcha xodimlar
    const employees = await Employee.find({
      businessId: req.businessId,
      status: { $ne: 'deleted' },
    }).sort('firstName').lean();

    // Oydagi barcha biriktirishlar
    const assignments = await DailyAssignment.find({
      businessId: req.businessId,
      dateString: { $gte: startDateStr, $lte: endDateStr },
    }).lean();

    // To'lovlar (agar SalaryPayment model bor bo'lsa)
    let payments = [];
    try {
      payments = await SalaryPayment.find({
        businessId: req.businessId,
        dateString: { $gte: startDateStr, $lte: endDateStr },
      }).lean();
    } catch (e) {
      payments = [];
    }

    // Kunlar ro'yxati
    const days = [];
    for (let d = 1; d <= totalDays; d++) {
      days.push({
        day: d,
        dateString: `${year}-${monthStr}-${String(d).padStart(2, '0')}`,
      });
    }

    // Har bir xodim uchun daysData yig'ish
    const employeesData = employees.map((emp) => {
      const empAssignments = assignments.filter(a => {
        return String(a.employeeId) === String(emp._id);
      });

      const empPayments = payments.filter(p => {
        return String(p.employeeId) === String(emp._id);
      });

      const daysData = {};
      let totalShift = 0;
      let totalEarning = 0;

      for (let d = 1; d <= totalDays; d++) {
        const dateStr = `${year}-${monthStr}-${String(d).padStart(2, '0')}`;
        const dayAssignments = empAssignments.filter(a => a.dateString === dateStr);
        const dayPayments = empPayments.filter(p => p.dateString === dateStr);

        const dayShift = dayAssignments.reduce((s, a) => s + (a.shift || 0), 0);
        const dayEarning = dayAssignments.reduce((s, a) => s + (a.earning || 0), 0);
        const dayPaid = dayPayments.reduce((s, p) => s + (p.amount || 0), 0);

        if (dayShift > 0 || dayPaid > 0) {
          daysData[d] = {
            totalShift: dayShift,
            totalEarning: dayEarning,
            paid: dayPaid > 0 || dayPayments.length > 0,
            paidAmount: dayPaid,
          };
        }

        totalShift += dayShift;
        totalEarning += dayEarning;
      }

      const totalPaid = empPayments.reduce((s, p) => s + (p.amount || 0), 0);
      const remaining = Math.max(0, totalEarning - totalPaid);

      return {
        _id: emp._id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        code: emp.code,
        daysData,
        totalShift,
        totalEarning,
        totalPaid,
        remaining,
      };
    });

    res.json({
      year,
      month,
      days,
      employees: employeesData,
    });
  } catch (err) {
    console.error('Monthly report GET xato:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

/**
 * POST /api/monthly-report/pay
 * Body: { employeeIds, year, month, amount }
 */
router.post('/pay', async (req, res) => {
  try {
    const { employeeIds, year, month, amount } = req.body;

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({ error: 'employeeIds kerak' });
    }

    const y = parseInt(year);
    const m = parseInt(month);
    const amt = Math.max(0, Number(amount) || 0);

    if (!y || !m || m < 1 || m > 12) {
      return res.status(400).json({ error: 'Yil/oy noto\'g\'ri' });
    }

    if (amt <= 0) {
      return res.status(400).json({ error: 'Summa 0 dan katta bo\'lishi kerak' });
    }

    const today = new Date();
    const monthStr = String(m).padStart(2, '0');
    const dayStr = String(today.getDate()).padStart(2, '0');
    const dateString = `${y}-${monthStr}-${dayStr}`;

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
        dateString,
        date: new Date(),
        employeeSnapshot: {
          firstName: emp.firstName,
          lastName: emp.lastName || '-',
          code: emp.code,
        },
        year: y,
        month: m,
      });
    }

    if (payments.length === 0) {
      return res.status(404).json({ error: 'Xodim topilmadi' });
    }

    try {
      await SalaryPayment.insertMany(payments);
    } catch (e) {
      console.error('SalaryPayment insertMany xato:', e);
      return res.status(500).json({ error: 'To\'lov saqlanmadi: ' + e.message });
    }

    res.status(201).json({ success: true, count: payments.length });
  } catch (err) {
    console.error('Pay POST xato:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

/**
 * POST /api/monthly-report/archive (eski endpoint - saqlangan)
 */
router.post('/archive', async (req, res) => {
  try {
    const { year, month } = req.body;
    const y = parseInt(year);
    const m = parseInt(month);

    if (!y || !m || m < 1 || m > 12) {
      return res.status(400).json({ error: 'Yil/oy noto\'g\'ri' });
    }

    const totalDays = daysInMonth(y, m);
    const monthStr = String(m).padStart(2, '0');
    const startDateStr = `${y}-${monthStr}-01`;
    const endDateStr = `${y}-${monthStr}-${String(totalDays).padStart(2, '0')}`;

    const [assignments, products] = await Promise.all([
      DailyAssignment.find({
        businessId: req.businessId,
        dateString: { $gte: startDateStr, $lte: endDateStr },
      }).lean(),
      DailyProduct.find({
        businessId: req.businessId,
        dateString: { $gte: startDateStr, $lte: endDateStr },
      }).lean(),
    ]);

    const totalEarnings = assignments.reduce((s, a) => s + (a.earning || 0), 0);
    const totalShifts = assignments.reduce((s, a) => s + a.shift, 0);
    const uniqueEmployees = new Set(assignments.map(a => a.employeeSnapshot?.code)).size;
    const totalProducts = products.reduce((s, p) => s + (p.quantity || 0), 0);

    const periodLabel = `${y}-${monthStr}`;

    const archive = new Archive({
      businessId: req.businessId,
      year: y,
      month: m,
      periodLabel,
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