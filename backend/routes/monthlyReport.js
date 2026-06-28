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

const { buildMonthlyReportWorkbook } = require('../services/excelGenerator');
const { saveToArchive } = require('../services/excelArchive');
const { tr } = require('../services/excelI18n');

router.use(verifyToken, requireAdmin, businessScope, requireModule('monthlyReport'));

function todayTashkentStr() {
  const now = new Date();
  const tashkent = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  return tashkent.toISOString().split('T')[0];
}

function parseDateStr(s) {
  if (!s || typeof s !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * GET /api/monthly-report/export?startDate=&endDate=&lang=uz-lat
 * Davr bo'yicha xodimlar agregatsiyasini Excel'ga eksport qiladi.
 */
router.get('/export', async (req, res) => {
  try {
    const allowedLangs = ['uz-lat', 'uz-cyr', 'ru'];
    const lang = allowedLangs.includes(String(req.query.lang)) ? String(req.query.lang) : 'uz-lat';

    let startStr = parseDateStr(req.query.startDate);
    let endStr = parseDateStr(req.query.endDate);

    // Default: oy boshi va bugun
    if (!startStr || !endStr) {
      const today = todayTashkentStr();
      const ym = today.slice(0, 7);
      startStr = startStr || `${ym}-01`;
      endStr = endStr || today;
    }

    const filter = {
      businessId: req.businessId,
      dateString: { $gte: startStr, $lte: endStr },
    };

    const assignments = await DailyAssignment.find(filter).lean();

    const grouped = {};
    for (const a of assignments) {
      const id = String(a.employeeId);
      if (!grouped[id]) {
        grouped[id] = {
          employeeId: id,
          fullName: a.employeeSnapshot?.fullName || '-',
          code: a.employeeSnapshot?.code || '-',
          departmentName: a.departmentSnapshot?.name || '-',
          totalDays: 0,
          totalShifts: 0,
          totalProductCount: 0,
          totalEarning: 0,
        };
      }
      grouped[id].totalDays += 1;
      grouped[id].totalShifts += a.shift || 0;
      grouped[id].totalProductCount += a.productCount || 0;
      grouped[id].totalEarning += a.earning || 0;
    }

    const rows = Object.values(grouped).sort((a, b) =>
      String(a.fullName).localeCompare(String(b.fullName))
    );

    const buffer = await buildMonthlyReportWorkbook(lang, {
      startDate: startStr,
      endDate: endStr,
      rows,
    });

    const displayName = `${tr(lang, 'file.monthly')}_${startStr}_${endStr}.xlsx`;
    const generatedBy = req.user?.fullName || req.user?.login || req.user?.username || '';

    try {
      await saveToArchive({
        buffer,
        businessId: req.businessId,
        category: 'monthlyReport',
        subType: '',
        language: lang,
        displayName,
        dateFrom: startStr,
        dateTo: endStr,
        rowCount: rows.length,
        generatedBy,
        meta: { startDate: startStr, endDate: endStr, employeesCount: rows.length },
      });
    } catch (archErr) {
      console.error('MonthlyReport export arxiv xatosi:', archErr);
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(displayName)}"`
    );
    return res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('MonthlyReport EXPORT:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

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
