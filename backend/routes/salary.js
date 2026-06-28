/**
 * CyberCoderCRM - Salary (v3)
 *
 * Maosh to'lash moduli — "tanlangan kunlar" rejimi:
 *  - GET  /api/salary                  → xodimlar ro'yxati + jami statistika
 *  - GET  /api/salary/:employeeId      → bitta xodim detali:
 *      * currentMonth.days — joriy oy ishlangan kunlari (har biri paid bilan)
 *      * unpaidPrevious   — oldingi oylardan to'lanmagan kunlar
 *      * payments         — to'lov tarixi
 *  - POST /api/salary/:employeeId/pay → { dates: ["YYYY-MM-DD", ...], note? }
 *      Tanlangan kunlar uchun bitta SalaryPayment yaratadi va shu
 *      DailyAssignment yozuvlarini paid=true qilib belgilaydi.
 */

const express = require('express');
const router = express.Router();

const Employee = require('../models/Employee');
const DailyAssignment = require('../models/DailyAssignment');
const SalaryPayment = require('../models/SalaryPayment');

const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');
const requireModule = require('../middleware/requireModule');

const { buildSalaryWorkbook, buildSalaryEmployeeWorkbook } = require('../services/excelGenerator');
const { saveToArchive } = require('../services/excelArchive');
const { tr } = require('../services/excelI18n');

router.use(verifyToken, requireAdmin, businessScope, requireModule('salary'));

// Tashkent (UTC+5) bo'yicha bugungi sana "YYYY-MM-DD"
function todayDateString() {
  const now = new Date();
  const tashkent = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  return tashkent.toISOString().split('T')[0];
}

function parseDateStr(s) {
  if (!s || typeof s !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

// Sanalar ichidan eng kattasining "YYYY-MM" qismi
function monthKeyFromDates(dates) {
  return dates.reduce((a, b) => (a > b ? a : b)).slice(0, 7);
}

router.get('/', async (req, res) => {
  try {
    const { startDate, endDate, code } = req.query;
    const startStr = parseDateStr(startDate);
    const endStr = parseDateStr(endDate);

    const empFilter = {
      businessId: req.businessId,
      status: { $ne: 'deleted' },
    };
    if (code && String(code).trim()) {
      empFilter.code = String(code).trim();
    }

    const employees = await Employee.find(empFilter)
      .populate('departmentId', 'name')
      .sort('fullName')
      .lean();

    if (employees.length === 0) {
      return res.json({ employees: [], stats: { totalEarned: 0, totalPaid: 0, totalRemaining: 0, totalEmployees: 0 } });
    }

    const ids = employees.map(e => e._id);

    const earnMatch = { businessId: req.businessId, employeeId: { $in: ids } };
    const paidMatch = { businessId: req.businessId, employeeId: { $in: ids } };
    if (startStr && endStr) {
      earnMatch.dateString = { $gte: startStr, $lte: endStr };
      // Eski yozuvlar ham (untilDate), yangilari ham (monthKey/paidAt orqali)
      // shu oraliqqa to'g'ri kelishi uchun untilDate filtri saqlandi.
      paidMatch.untilDate = { $gte: startStr, $lte: endStr };
    }

    const [earnAgg, paidAgg] = await Promise.all([
      DailyAssignment.aggregate([
        { $match: earnMatch },
        {
          $group: {
            _id: '$employeeId',
            totalEarning: { $sum: '$earning' },
            totalShifts: { $sum: '$shift' },
            totalDays: { $sum: 1 },
            lastDate: { $max: '$dateString' },
          },
        },
      ]),
      SalaryPayment.aggregate([
        { $match: paidMatch },
        {
          $group: {
            _id: '$employeeId',
            totalPaid: { $sum: '$amount' },
            lastPaidAt: { $max: '$paidAt' },
          },
        },
      ]),
    ]);

    const earnMap = Object.fromEntries(earnAgg.map(x => [String(x._id), x]));
    const paidMap = Object.fromEntries(paidAgg.map(x => [String(x._id), x]));

    let totalEarned = 0, totalPaid = 0;

    const result = employees.map(e => {
      const earn = earnMap[String(e._id)] || { totalEarning: 0, totalShifts: 0, totalDays: 0, lastDate: null };
      const paid = paidMap[String(e._id)] || { totalPaid: 0, lastPaidAt: null };
      const remaining = Math.max(0, earn.totalEarning - paid.totalPaid);
      totalEarned += earn.totalEarning;
      totalPaid += paid.totalPaid;
      return {
        _id: e._id,
        fullName: e.fullName,
        code: e.code,
        phone: e.phone,
        department: e.departmentId ? { _id: e.departmentId._id, name: e.departmentId.name } : null,
        totalEarning: earn.totalEarning,
        totalShifts: earn.totalShifts,
        totalDays: earn.totalDays,
        totalPaid: paid.totalPaid,
        remaining,
        lastWorkDate: earn.lastDate,
        lastPaidAt: paid.lastPaidAt,
      };
    });

    // Faqat ishlagan/biriktirilgan xodimlar: davromdi yoki to'lovi bo'lganlar
    const visible = result.filter(
      (e) => (e.totalEarning || 0) > 0 || (e.totalPaid || 0) > 0 || (e.totalDays || 0) > 0
    );

    res.json({
      employees: visible,
      stats: {
        totalEarned,
        totalPaid,
        totalRemaining: Math.max(0, totalEarned - totalPaid),
        totalEmployees: visible.length,
      },
    });
  } catch (err) {
    console.error('Salary GET:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * GET /api/salary/export?lang=uz-lat&filter=all|paid|unpaid&startDate=&endDate=
 * Maosh hisobotini filtrlangan holda Excel'ga eksport qiladi.
 */
router.get('/export', async (req, res) => {
  try {
    const allowedLangs = ['uz-lat', 'uz-cyr', 'ru'];
    const lang = allowedLangs.includes(String(req.query.lang)) ? String(req.query.lang) : 'uz-lat';

    const allowedFilters = ['all', 'paid', 'unpaid'];
    const filter = allowedFilters.includes(String(req.query.filter))
      ? String(req.query.filter)
      : 'all';

    const startStr = parseDateStr(req.query.startDate);
    const endStr = parseDateStr(req.query.endDate);

    const empFilter = {
      businessId: req.businessId,
      status: { $ne: 'deleted' },
    };

    const employees = await Employee.find(empFilter)
      .populate('departmentId', 'name')
      .sort('fullName')
      .lean();

    let result = [];
    let stats = { totalEarned: 0, totalPaid: 0, totalRemaining: 0, totalEmployees: 0 };

    if (employees.length > 0) {
      const ids = employees.map((e) => e._id);

      const earnMatch = { businessId: req.businessId, employeeId: { $in: ids } };
      const paidMatch = { businessId: req.businessId, employeeId: { $in: ids } };
      if (startStr && endStr) {
        earnMatch.dateString = { $gte: startStr, $lte: endStr };
        paidMatch.untilDate = { $gte: startStr, $lte: endStr };
      }

      const [earnAgg, paidAgg] = await Promise.all([
        DailyAssignment.aggregate([
          { $match: earnMatch },
          {
            $group: {
              _id: '$employeeId',
              totalEarning: { $sum: '$earning' },
              totalShifts: { $sum: '$shift' },
              totalDays: { $sum: 1 },
            },
          },
        ]),
        SalaryPayment.aggregate([
          { $match: paidMatch },
          { $group: { _id: '$employeeId', totalPaid: { $sum: '$amount' } } },
        ]),
      ]);

      const earnMap = Object.fromEntries(earnAgg.map((x) => [String(x._id), x]));
      const paidMap = Object.fromEntries(paidAgg.map((x) => [String(x._id), x]));

      let totalEarned = 0;
      let totalPaid = 0;
      result = employees.map((e) => {
        const earn = earnMap[String(e._id)] || { totalEarning: 0, totalShifts: 0, totalDays: 0 };
        const paid = paidMap[String(e._id)] || { totalPaid: 0 };
        const remaining = Math.max(0, earn.totalEarning - paid.totalPaid);
        totalEarned += earn.totalEarning;
        totalPaid += paid.totalPaid;
        return {
          _id: e._id,
          code: e.code,
          fullName: e.fullName,
          department: e.departmentId ? { _id: e.departmentId._id, name: e.departmentId.name } : null,
          totalEarning: earn.totalEarning,
          totalShifts: earn.totalShifts,
          totalDays: earn.totalDays,
          totalPaid: paid.totalPaid,
          remaining,
        };
      });

      // Faqat ishlagan/biriktirilgan xodimlar — bo'sh qatorlar Excelga tushmasin
      result = result.filter(
        (e) => (e.totalEarning || 0) > 0 || (e.totalPaid || 0) > 0 || (e.totalDays || 0) > 0
      );

      stats = {
        totalEarned,
        totalPaid,
        totalRemaining: Math.max(0, totalEarned - totalPaid),
        totalEmployees: result.length,
      };
    }

    const buffer = await buildSalaryWorkbook(lang, {
      filter,
      startDate: startStr || null,
      endDate: endStr || null,
      employees: result,
      stats,
    });

    const dateSuffix =
      startStr && endStr ? `_${startStr}_${endStr}` : `_${todayDateString()}`;
    const displayName = `${tr(lang, 'file.salary')}_${filter}${dateSuffix}.xlsx`;
    const generatedBy = req.user?.fullName || req.user?.login || req.user?.username || '';

    // rowCount = filtrlangan qatorlar
    let filteredCount = result.length;
    if (filter === 'paid') {
      filteredCount = result.filter((e) => e.remaining <= 0 && e.totalEarning > 0).length;
    } else if (filter === 'unpaid') {
      filteredCount = result.filter((e) => e.remaining > 0).length;
    }

    try {
      await saveToArchive({
        buffer,
        businessId: req.businessId,
        category: 'salary',
        subType: filter,
        language: lang,
        displayName,
        dateFrom: startStr || null,
        dateTo: endStr || null,
        rowCount: filteredCount,
        generatedBy,
        meta: { startDate: startStr || null, endDate: endStr || null, filter },
      });
    } catch (archErr) {
      console.error('Salary export arxiv xatosi:', archErr);
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
    console.error('Salary EXPORT:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.get('/:employeeId', async (req, res) => {
  try {
    const emp = await Employee.findOne({
      _id: req.params.employeeId,
      businessId: req.businessId,
    })
      .populate('departmentId', 'name allowDirections')
      .lean();
    if (!emp) return res.status(404).json({ error: 'Xodim topilmadi' });

    // Joriy oy kalitlari (Tashkent vaqti bo'yicha)
    const today = todayDateString();          // "YYYY-MM-DD"
    const currentMonthKey = today.slice(0, 7); // "YYYY-MM"
    const [yearStr, monthStr] = currentMonthKey.split('-');
    const monthStart = `${currentMonthKey}-01`;
    const lastDay = new Date(Number(yearStr), Number(monthStr), 0).getDate();
    const monthEnd = `${currentMonthKey}-${String(lastDay).padStart(2, '0')}`;

    const [assignments, payments] = await Promise.all([
      DailyAssignment.find({ businessId: req.businessId, employeeId: emp._id })
        .sort('-dateString')
        .lean(),
      SalaryPayment.find({ businessId: req.businessId, employeeId: emp._id })
        .sort('-paidAt')
        .lean(),
    ]);

    // Yordamchi: assignment dan ko'rinish uchun yengil obyekt yasash
    const mapDay = (a) => ({
      _id: a._id,
      date: a.dateString,
      shift: a.shift,
      earning: a.earning,
      productCount: a.productCount,
      paid: !!a.paid,
      paymentId: a.paymentId || null,
      paidAt: a.paidAt || null,
      departmentName: a.departmentSnapshot?.name || null,
      directionName: a.directionSnapshot?.name || null,
    });

    // 1) Joriy oy: faqat ishlangan kunlar (DailyAssignment mavjudlari)
    const currentMonthAssignments = assignments.filter(
      a => a.dateString >= monthStart && a.dateString <= monthEnd
    );
    const currentMonthDays = currentMonthAssignments.map(mapDay);

    // 2) Oldingi oylardan to'lanmagan kunlar
    const unpaidPrevAssignments = assignments.filter(
      a => a.dateString < monthStart && !a.paid
    );
    const unpaidPrevious = unpaidPrevAssignments.map(a => ({
      _id: a._id,
      date: a.dateString,
      shift: a.shift,
      earning: a.earning,
      productCount: a.productCount,
      departmentName: a.departmentSnapshot?.name || null,
      directionName: a.directionSnapshot?.name || null,
      monthKey: (a.dateString || '').slice(0, 7),
    }));

    // Umumiy statistika
    const totalEarning = assignments.reduce((s, a) => s + (a.earning || 0), 0);
    const totalShifts = assignments.reduce((s, a) => s + (a.shift || 0), 0);
    const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const remaining = Math.max(0, totalEarning - totalPaid);

    // Joriy oy bo'yicha
    const currentMonthEarning = currentMonthAssignments.reduce((s, a) => s + (a.earning || 0), 0);
    const currentMonthPaid = currentMonthAssignments
      .filter(a => a.paid)
      .reduce((s, a) => s + (a.earning || 0), 0);

    // Oldingi oydan qoldiq
    const unpaidPreviousAmount = unpaidPrevAssignments.reduce((s, a) => s + (a.earning || 0), 0);
    const unpaidPreviousCount = unpaidPrevAssignments.length;

    res.json({
      employee: emp,
      currentMonth: {
        monthKey: currentMonthKey,
        year: Number(yearStr),
        month: Number(monthStr),
        days: currentMonthDays,
      },
      unpaidPrevious,
      payments,
      stats: {
        totalEarning,
        totalShifts,
        totalDays: assignments.length,
        totalPaid,
        remaining,
        currentMonthEarning,
        currentMonthPaid,
        unpaidPreviousCount,
        unpaidPreviousAmount,
      },
    });
  } catch (err) {
    console.error('Salary detail GET:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * GET /api/salary/:employeeId/export?lang=uz-lat
 * Bitta xodimning ishlangan kunlari va to'lov tarixini Excelga eksport qiladi.
 */
router.get('/:employeeId/export', async (req, res) => {
  try {
    const allowedLangs = ['uz-lat', 'uz-cyr', 'ru'];
    const lang = allowedLangs.includes(String(req.query.lang)) ? String(req.query.lang) : 'uz-lat';

    const emp = await Employee.findOne({
      _id: req.params.employeeId,
      businessId: req.businessId,
    })
      .populate('departmentId', 'name allowDirections')
      .lean();
    if (!emp) return res.status(404).json({ error: 'Xodim topilmadi' });

    const [assignments, payments] = await Promise.all([
      DailyAssignment.find({ businessId: req.businessId, employeeId: emp._id })
        .sort('-dateString')
        .lean(),
      SalaryPayment.find({ businessId: req.businessId, employeeId: emp._id })
        .sort('-paidAt')
        .lean(),
    ]);

    const days = assignments.map((a) => ({
      date: a.dateString,
      shift: a.shift,
      productCount: a.productCount,
      earning: a.earning,
      paid: !!a.paid,
      departmentName: (a.departmentSnapshot && a.departmentSnapshot.name) || null,
      directionName: (a.directionSnapshot && a.directionSnapshot.name) || null,
    }));

    const totalEarning = days.reduce((s, d) => s + (d.earning || 0), 0);
    const totalShifts = days.reduce((s, d) => s + (d.shift || 0), 0);
    const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);

    const buffer = await buildSalaryEmployeeWorkbook(lang, {
      employee: emp,
      days,
      payments,
      stats: { totalEarning, totalShifts, totalDays: days.length, totalPaid },
    });

    const today = todayDateString();
    const safeCode = String(emp.code || 'X').replace(/[^A-Za-z0-9_\-]/g, '_');
    const displayName = `${tr(lang, 'file.salaryEmployee')}_${safeCode}_${today}.xlsx`;
    const generatedBy = req.user?.fullName || req.user?.login || req.user?.username || '';

    const firstDate = days.length > 0 ? days[days.length - 1].date : null;
    const lastDate = days.length > 0 ? days[0].date : null;

    try {
      await saveToArchive({
        buffer,
        businessId: req.businessId,
        category: 'salary',
        subType: 'employee',
        language: lang,
        displayName,
        dateFrom: firstDate,
        dateTo: lastDate,
        rowCount: days.length,
        generatedBy,
        meta: {
          employeeId: String(emp._id),
          fullName: emp.fullName,
          code: emp.code,
          totalEarning,
          totalPaid,
        },
      });
    } catch (archErr) {
      console.error('Salary employee export arxiv xatosi:', archErr);
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
    console.error('Salary employee EXPORT:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.post('/:employeeId/pay', async (req, res) => {
  try {
    const { dates, note } = req.body || {};

    // 1) dates ni validatsiya qilish
    if (!Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({ error: "dates massivi bo'sh bo'lmasligi kerak" });
    }
    const uniqueDates = [...new Set(dates.map(d => String(d).trim()))];
    for (const d of uniqueDates) {
      if (!parseDateStr(d)) {
        return res.status(400).json({ error: `Sana formati noto'g'ri: ${d}` });
      }
    }

    // 2) Xodimni topish
    const emp = await Employee.findOne({
      _id: req.params.employeeId,
      businessId: req.businessId,
    });
    if (!emp) return res.status(404).json({ error: 'Xodim topilmadi' });

    // 3) Shu kunlardagi DailyAssignment yozuvlarini topish
    const dayDocs = await DailyAssignment.find({
      businessId: req.businessId,
      employeeId: emp._id,
      dateString: { $in: uniqueDates },
    });

    // 4) Hamma tanlangan kunlar topilishi shart
    if (dayDocs.length !== uniqueDates.length) {
      return res.status(400).json({ error: "Ba'zi kunlar topilmadi" });
    }

    // 5) Hammasi to'lanmagan bo'lishi shart
    const alreadyPaid = dayDocs.find(d => d.paid);
    if (alreadyPaid) {
      return res.status(400).json({ error: "Ba'zi kunlar allaqachon to'langan" });
    }

    // 6) Jami summa
    const amount = dayDocs.reduce((s, d) => s + (d.earning || 0), 0);
    if (amount <= 0) {
      return res.status(400).json({ error: "To'lov summasi 0 ga teng" });
    }

    // 7) SalaryPayment yaratish
    const maxDate = uniqueDates.reduce((a, b) => (a > b ? a : b));
    const mKey = monthKeyFromDates(uniqueDates);

    const payment = await SalaryPayment.create({
      businessId: req.businessId,
      employeeId: emp._id,
      paidDates: uniqueDates,
      untilDate: maxDate, // eski indekslar uchun saqlanadi
      monthKey: mKey,
      amount,
      paidAt: new Date(),
      note: note ? String(note).trim() : '',
      employeeSnapshot: { fullName: emp.fullName, code: emp.code },
      snapshot: {
        earningTillDate: amount,
        paidBefore: 0,
        remainingBefore: amount,
      },
    });

    // 8) DailyAssignment yozuvlarini paid=true qilib belgilash
    // MongoDB tranzaksiyalari replica set talab qiladi, shuning uchun
    // sodda yondashuv: avval payment.create, keyin updateMany. Agar
    // updateMany muvaffaqiyatsiz bo'lsa, paymentni o'chirib (rollback)
    // qilib yuboramiz.
    try {
      await DailyAssignment.updateMany(
        {
          businessId: req.businessId,
          employeeId: emp._id,
          dateString: { $in: uniqueDates },
        },
        {
          $set: {
            paid: true,
            paymentId: payment._id,
            paidAt: payment.paidAt,
          },
        }
      );
    } catch (updateErr) {
      console.error('Salary pay updateMany xatosi, rollback:', updateErr);
      try {
        await SalaryPayment.deleteOne({ _id: payment._id });
      } catch (rbErr) {
        console.error('Rollback xatosi:', rbErr);
      }
      return res.status(500).json({ error: "Kunlarni belgilashda xato (rollback bajarildi)" });
    }

    res.status(201).json(payment);
  } catch (err) {
    console.error('Salary pay POST:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

module.exports = router;
