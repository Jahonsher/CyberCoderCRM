/**
 * CyberCoderCRM - Monthly Report routes
 * Oylik to'lov tizimi + kod bilan batafsil qidirish
 */

const express = require('express');
const router = express.Router();

const Employee = require('../models/Employee');
const DailyAssignment = require('../models/DailyAssignment');
const DailyProduct = require('../models/DailyProduct');
const Archive = require('../models/Archive');
const SalaryPayment = require('../models/SalaryPayment');

const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');
const requireModule = require('../middleware/requireModule');

router.use(verifyToken, requireAdmin, businessScope, requireModule('monthlyReport'));

/**
 * periodMonth formatda (YYYY-MM) olish
 */
function getPeriodMonth(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * GET /api/monthly-report?startDate=...&endDate=...&code=...
 * Oylik hisobot - xodimlar bo'yicha
 */
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, code } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Sana oralig'i kerak" });
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
          employeeId: a.employeeId,
          firstName: a.employeeSnapshot.firstName,
          lastName: a.employeeSnapshot.lastName,
          code: a.employeeSnapshot.code,
          totalDays: 0,
          totalShifts: 0,
          totalEarning: 0,
          days: [],
        };
      }
      grouped[key].totalDays++;
      grouped[key].totalShifts += a.shift;
      grouped[key].totalEarning += a.earning;

      // Har kun detali
      grouped[key].days.push({
        assignmentId: a._id,
        date: a.date,
        directionName: a.directionSnapshot?.name || '',
        departmentName: a.directionSnapshot?.departmentName || '',
        shift: a.shift,
        earning: a.earning,
      });
    }

    const employees = Object.values(grouped);

    // Oy davomida to'lov olinganlarini tekshirish
    const periodMonth = getPeriodMonth(start);
    const payments = await SalaryPayment.find({
      businessId: req.businessId,
      periodMonth,
    });
    const paidEmployeeIds = new Set(payments.map(p => String(p.employeeId)));

    // Har xodimga isPaid maydoni qo'shish
    employees.forEach(e => {
      e.isPaid = paidEmployeeIds.has(String(e.employeeId));
      if (e.isPaid) {
        const payment = payments.find(p => String(p.employeeId) === String(e.employeeId));
        e.paidAmount = payment?.amount || 0;
        e.paidAt = payment?.paidAt;
      }
    });

    const totalEarning = assignments.reduce((s, a) => s + (a.earning || 0), 0);
    const totalProductCount = products.reduce((s, p) => s + (p.quantity || 0), 0);

    res.json({
      period: { startDate: start, endDate: end, periodMonth },
      employees,
      stats: {
        totalEarning,
        totalEmployees: employees.length,
        totalProductCount,
        totalAssignments: assignments.length,
        totalPaid: payments.length,
      },
    });
  } catch (err) {
    console.error('Monthly report GET xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * POST /api/monthly-report/pay
 * Oylik to'lov qilish
 * body: { employeeIds: [], startDate, endDate, note? }
 */
router.post('/pay', async (req, res) => {
  try {
    const { employeeIds, startDate, endDate, note } = req.body;

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({ error: 'Kamida 1 xodim tanlang' });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Sana oralig'i kerak" });
    }

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    const periodMonth = getPeriodMonth(start);

    // Har bir xodimning daromadini hisoblash
    const assignments = await DailyAssignment.find({
      businessId: req.businessId,
      employeeId: { $in: employeeIds },
      date: { $gte: start, $lte: end },
    });

    const earningsByEmployee = {};
    for (const a of assignments) {
      const key = String(a.employeeId);
      if (!earningsByEmployee[key]) {
        earningsByEmployee[key] = {
          employeeId: a.employeeId,
          amount: 0,
          snapshot: a.employeeSnapshot,
        };
      }
      earningsByEmployee[key].amount += a.earning;
    }

    // Har bir xodim uchun SalaryPayment yaratish
    const paid = [];
    const errors = [];

    for (const employeeId of employeeIds) {
      const data = earningsByEmployee[String(employeeId)];
      if (!data || data.amount === 0) {
        errors.push({ employeeId, reason: 'Daromad yo\'q' });
        continue;
      }

      try {
        // Takrorlanmasligi uchun tekshirish
        const existing = await SalaryPayment.findOne({
          businessId: req.businessId,
          employeeId,
          periodMonth,
        });

        if (existing) {
          errors.push({ employeeId, reason: 'Allaqachon to\'langan' });
          continue;
        }

        const payment = await SalaryPayment.create({
          businessId: req.businessId,
          employeeId,
          employeeSnapshot: data.snapshot,
          periodMonth,
          periodStart: start,
          periodEnd: end,
          amount: data.amount,
          note: note || '',
        });

        paid.push(payment);
      } catch (err) {
        if (err.code === 11000) {
          errors.push({ employeeId, reason: 'Allaqachon to\'langan' });
        } else {
          errors.push({ employeeId, reason: err.message });
        }
      }
    }

    res.json({
      success: true,
      paidCount: paid.length,
      errorsCount: errors.length,
      paid,
      errors,
    });
  } catch (err) {
    console.error('Pay xato:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

/**
 * POST /api/monthly-report/archive
 * (eski) - arxivlash
 */
router.post('/archive', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Sana oralig'i kerak" });
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