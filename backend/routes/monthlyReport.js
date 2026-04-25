/**
 * CyberCoderCRM - Monthly Report routes
 * Yangi: kun bo'yicha to'lov, paid/remaining hisoblash
 */

const express = require('express');
const router = express.Router();

const Employee = require('../models/Employee');
const DailyAssignment = require('../models/DailyAssignment');
const DailyProduct = require('../models/DailyProduct');
const SalaryPayment = require('../models/SalaryPayment');

const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');
const requireModule = require('../middleware/requireModule');

router.use(verifyToken, requireAdmin, businessScope, requireModule('monthlyReport'));

/**
 * GET /api/monthly-report?startDate=&endDate=&code=
 */
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, code } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Sana oralig'i kerak" });
    }

    // dateString format
    const startStr = String(startDate).slice(0, 10);
    const endStr = String(endDate).slice(0, 10);

    const filter = {
      businessId: req.businessId,
      dateString: { $gte: startStr, $lte: endStr },
    };

    if (code) {
      filter['employeeSnapshot.code'] = code.trim();
    }

    const assignments = await DailyAssignment.find(filter).sort('dateString');

    // To'lovlarni olish (shu davr uchun)
    const assignmentIds = assignments.map(a => a._id);
    const payments = await SalaryPayment.find({
      businessId: req.businessId,
      assignmentId: { $in: assignmentIds },
    });

    // assignment_id → paid map
    const paidMap = {};
    for (const p of payments) {
      paidMap[String(p.assignmentId)] = {
        paymentId: p._id,
        amount: p.amount,
        paidAt: p.paidAt,
      };
    }

    // Xodimlar bo'yicha guruhlash
    const grouped = {};
    for (const a of assignments) {
      const key = a.employeeSnapshot.code;
      const aId = String(a._id);
      const paid = paidMap[aId];

      if (!grouped[key]) {
        grouped[key] = {
          employeeId: a.employeeId,
          firstName: a.employeeSnapshot.firstName,
          lastName: a.employeeSnapshot.lastName,
          code: a.employeeSnapshot.code,
          totalDays: 0,
          totalShifts: 0,
          totalEarning: 0,
          paidAmount: 0,
          paidDays: 0,
          remainingAmount: 0,
          remainingDays: 0,
          days: [],
        };
      }

      grouped[key].totalDays++;
      grouped[key].totalShifts += a.shift;
      grouped[key].totalEarning += a.earning;

      if (paid) {
        grouped[key].paidAmount += paid.amount;
        grouped[key].paidDays++;
      } else {
        grouped[key].remainingAmount += a.earning;
        grouped[key].remainingDays++;
      }

      grouped[key].days.push({
        assignmentId: a._id,
        date: a.date,
        dateString: a.dateString,
        directionName: a.directionSnapshot?.name || '',
        departmentName: a.directionSnapshot?.departmentName || '',
        shift: a.shift,
        earning: a.earning,
        type: a.type || 'piecework',
        isPaid: !!paid,
        paidAmount: paid?.amount || 0,
        paidAt: paid?.paidAt || null,
        paymentId: paid?.paymentId || null,
      });
    }

    const employees = Object.values(grouped);

    const products = await DailyProduct.find({
      businessId: req.businessId,
      dateString: { $gte: startStr, $lte: endStr },
    });

    const totalEarning = assignments.reduce((s, a) => s + (a.earning || 0), 0);
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const totalRemaining = totalEarning - totalPaid;
    const totalProductCount = products.reduce((s, p) => s + (p.quantity || 0), 0);

    res.json({
      period: { startDate: startStr, endDate: endStr },
      employees,
      stats: {
        totalEarning,
        totalPaid,
        totalRemaining,
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
 * POST /api/monthly-report/pay-days
 * Aniq kunlar uchun to'lov
 * body: { assignmentIds: [], note? }
 */
router.post('/pay-days', async (req, res) => {
  try {
    const { assignmentIds, note } = req.body;

    if (!Array.isArray(assignmentIds) || assignmentIds.length === 0) {
      return res.status(400).json({ error: 'Kamida 1 kun tanlang' });
    }

    // Assignmentlarni olish
    const assignments = await DailyAssignment.find({
      _id: { $in: assignmentIds },
      businessId: req.businessId,
    });

    if (assignments.length === 0) {
      return res.status(404).json({ error: 'Topilmadi' });
    }

    const paid = [];
    const errors = [];

    for (const a of assignments) {
      try {
        // Tekshirish - allaqachon to'langanmi
        const existing = await SalaryPayment.findOne({
          businessId: req.businessId,
          assignmentId: a._id,
        });

        if (existing) {
          errors.push({ assignmentId: a._id, reason: "Allaqachon to'langan" });
          continue;
        }

        const payment = await SalaryPayment.create({
          businessId: req.businessId,
          employeeId: a.employeeId,
          assignmentId: a._id,
          dateString: a.dateString,
          employeeSnapshot: a.employeeSnapshot,
          amount: a.earning,
          note: note || '',
        });

        paid.push(payment);
      } catch (err) {
        if (err.code === 11000) {
          errors.push({ assignmentId: a._id, reason: "Allaqachon to'langan" });
        } else {
          errors.push({ assignmentId: a._id, reason: err.message });
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
    console.error('Pay-days xato:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

/**
 * POST /api/monthly-report/pay-remaining
 * Xodimning qolgan kunlari uchun to'lov (oddiy "hammasini to'lash")
 * body: { employeeIds: [], startDate, endDate, note? }
 */
router.post('/pay-remaining', async (req, res) => {
  try {
    const { employeeIds, startDate, endDate, note } = req.body;

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({ error: 'Kamida 1 xodim tanlang' });
    }

    const startStr = String(startDate).slice(0, 10);
    const endStr = String(endDate).slice(0, 10);

    // Tanlangan xodimlarning to'lanmagan kunlarini topish
    const assignments = await DailyAssignment.find({
      businessId: req.businessId,
      employeeId: { $in: employeeIds },
      dateString: { $gte: startStr, $lte: endStr },
    });

    const assignmentIds = assignments.map(a => a._id);
    const existingPayments = await SalaryPayment.find({
      businessId: req.businessId,
      assignmentId: { $in: assignmentIds },
    });
    const paidIds = new Set(existingPayments.map(p => String(p.assignmentId)));

    const unpaidAssignments = assignments.filter(a => !paidIds.has(String(a._id)));

    const paid = [];
    const errors = [];

    for (const a of unpaidAssignments) {
      try {
        const payment = await SalaryPayment.create({
          businessId: req.businessId,
          employeeId: a.employeeId,
          assignmentId: a._id,
          dateString: a.dateString,
          employeeSnapshot: a.employeeSnapshot,
          amount: a.earning,
          note: note || '',
        });
        paid.push(payment);
      } catch (err) {
        if (err.code !== 11000) {
          errors.push({ assignmentId: a._id, reason: err.message });
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
    console.error('Pay-remaining xato:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

/**
 * DELETE /api/monthly-report/pay/:id
 * Bitta kunning to'lovini bekor qilish
 */
router.delete('/pay/:id', async (req, res) => {
  try {
    const payment = await SalaryPayment.findOneAndDelete({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!payment) {
      return res.status(404).json({ error: "To'lov topilmadi" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Pay DELETE xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

module.exports = router;