/**
 * CyberCoderCRM - Monthly Report (v2)
 *
 * Davr (sana oraliq) bo'yicha xodimlar statistikasi.
 * Read-only: to'lash endi /api/salary modulida.
 */

const express = require('express');
const router = express.Router();

const DailyAssignment = require('../models/DailyAssignment');
const SalaryPayment = require('../models/SalaryPayment');

const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');
const requireModule = require('../middleware/requireModule');

router.use(verifyToken, requireAdmin, businessScope, requireModule('monthlyReport'));

function parseDateStr(s) {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, code, departmentId } = req.query;
    const startStr = parseDateStr(startDate);
    const endStr = parseDateStr(endDate);
    if (!startStr || !endStr) return res.status(400).json({ error: "Sana oralig'i kerak" });

    const filter = {
      businessId: req.businessId,
      dateString: { $gte: startStr, $lte: endStr },
    };
    if (departmentId) filter.departmentId = departmentId;
    if (code && String(code).trim()) filter['employeeSnapshot.code'] = String(code).trim();

    const assignments = await DailyAssignment.find(filter).lean();

    const payments = await SalaryPayment.find({
      businessId: req.businessId,
      untilDate: { $gte: startStr, $lte: endStr },
      ...(code && String(code).trim() ? { 'employeeSnapshot.code': String(code).trim() } : {}),
    }).lean();

    const grouped = {};
    for (const a of assignments) {
      const id = String(a.employeeId);
      if (!grouped[id]) {
        grouped[id] = {
          _id: id,
          fullName: a.employeeSnapshot?.fullName || '-',
          code: a.employeeSnapshot?.code || '-',
          totalDays: 0,
          totalShifts: 0,
          totalEarning: 0,
          totalPaid: 0,
          remaining: 0,
        };
      }
      grouped[id].totalDays += 1;
      grouped[id].totalShifts += a.shift || 0;
      grouped[id].totalEarning += a.earning || 0;
    }

    for (const p of payments) {
      const id = String(p.employeeId);
      if (!grouped[id]) {
        grouped[id] = {
          _id: id,
          fullName: p.employeeSnapshot?.fullName || '-',
          code: p.employeeSnapshot?.code || '-',
          totalDays: 0, totalShifts: 0, totalEarning: 0, totalPaid: 0, remaining: 0,
        };
      }
      grouped[id].totalPaid += p.amount || 0;
    }

    const employees = Object.values(grouped).map(e => {
      e.remaining = Math.max(0, e.totalEarning - e.totalPaid);
      return e;
    });

    res.json({
      period: { startStr, endStr },
      employees,
      stats: {
        totalEarning: assignments.reduce((s, a) => s + (a.earning || 0), 0),
        totalEmployees: employees.length,
        totalAssignments: assignments.length,
        totalPaid: payments.reduce((s, p) => s + (p.amount || 0), 0),
      },
    });
  } catch (err) {
    console.error('Monthly GET:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

module.exports = router;
