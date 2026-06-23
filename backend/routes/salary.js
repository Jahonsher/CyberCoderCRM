/**
 * CyberCoderCRM - Salary (v2)
 *
 * Maosh to'lash moduli:
 *  - GET /api/salary                  → xodimlar ro'yxati + jami statistika
 *  - GET /api/salary/:employeeId      → bitta xodim detali (kunlik breakdown)
 *  - POST /api/salary/:employeeId/pay → { untilDate } sanagacha qoldiqni bitta to'lov sifatida saqlash
 */

const express = require('express');
const router = express.Router();

const Employee = require('../models/Employee');
const DailyAssignment = require('../models/DailyAssignment');
const SalaryPayment = require('../models/SalaryPayment');

const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');
const requireModule = require('../middleware/requireModule');

router.use(verifyToken, requireAdmin, businessScope, requireModule('salary'));

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

router.get('/', async (req, res) => {
  try {
    const employees = await Employee.find({
      businessId: req.businessId,
      status: { $ne: 'deleted' },
    })
      .populate('departmentId', 'name')
      .sort('fullName')
      .lean();

    if (employees.length === 0) {
      return res.json({ employees: [], stats: { totalEarned: 0, totalPaid: 0, totalRemaining: 0 } });
    }

    const ids = employees.map(e => e._id);

    const [earnAgg, paidAgg] = await Promise.all([
      DailyAssignment.aggregate([
        { $match: { businessId: req.businessId, employeeId: { $in: ids } } },
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
        { $match: { businessId: req.businessId, employeeId: { $in: ids } } },
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

    res.json({
      employees: result,
      stats: {
        totalEarned,
        totalPaid,
        totalRemaining: Math.max(0, totalEarned - totalPaid),
        totalEmployees: result.length,
      },
    });
  } catch (err) {
    console.error('Salary GET:', err);
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

    const [assignments, payments] = await Promise.all([
      DailyAssignment.find({ businessId: req.businessId, employeeId: emp._id }).sort('-dateString').lean(),
      SalaryPayment.find({ businessId: req.businessId, employeeId: emp._id }).sort('-paidAt').lean(),
    ]);

    const totalEarning = assignments.reduce((s, a) => s + (a.earning || 0), 0);
    const totalShifts = assignments.reduce((s, a) => s + (a.shift || 0), 0);
    const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const remaining = Math.max(0, totalEarning - totalPaid);

    res.json({
      employee: emp,
      assignments,
      payments,
      stats: {
        totalEarning,
        totalShifts,
        totalDays: assignments.length,
        totalPaid,
        remaining,
      },
    });
  } catch (err) {
    console.error('Salary detail GET:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.post('/:employeeId/pay', async (req, res) => {
  try {
    const { untilDate, note } = req.body;
    const untilStr = parseDateStr(untilDate) || todayDateString();

    const emp = await Employee.findOne({
      _id: req.params.employeeId,
      businessId: req.businessId,
    });
    if (!emp) return res.status(404).json({ error: 'Xodim topilmadi' });

    const [earnAgg, paidAgg] = await Promise.all([
      DailyAssignment.aggregate([
        {
          $match: {
            businessId: req.businessId,
            employeeId: emp._id,
            dateString: { $lte: untilStr },
          },
        },
        { $group: { _id: null, total: { $sum: '$earning' } } },
      ]),
      SalaryPayment.aggregate([
        { $match: { businessId: req.businessId, employeeId: emp._id } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    const earningTillDate = earnAgg[0]?.total || 0;
    const paidBefore = paidAgg[0]?.total || 0;
    const remaining = Math.max(0, earningTillDate - paidBefore);

    if (remaining <= 0) {
      return res.status(400).json({ error: "Bu sanagacha qoldiq yo'q" });
    }

    const payment = await SalaryPayment.create({
      businessId: req.businessId,
      employeeId: emp._id,
      untilDate: untilStr,
      amount: remaining,
      paidAt: new Date(),
      note: note ? String(note).trim() : '',
      employeeSnapshot: { fullName: emp.fullName, code: emp.code },
      snapshot: {
        earningTillDate,
        paidBefore,
        remainingBefore: remaining,
      },
    });

    res.status(201).json(payment);
  } catch (err) {
    console.error('Salary pay POST:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

module.exports = router;
