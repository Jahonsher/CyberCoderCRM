/**
 * CyberCoderCRM - Archive (v2)
 *
 * Oylik to'lov tarixi: har oy uchun to'liq/qisman to'langanlar ajratiladi.
 * "To'liq" — shu oyga oid jami earned summa to'langan paid summa bilan teng yoki kichik.
 * "Qisman" — qoldiq qoldi.
 */

const express = require('express');
const router = express.Router();

const SalaryPayment = require('../models/SalaryPayment');
const DailyAssignment = require('../models/DailyAssignment');

const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');
const requireModule = require('../middleware/requireModule');

router.use(verifyToken, requireAdmin, businessScope, requireModule('archive'));

router.get('/', async (req, res) => {
  try {
    const payments = await SalaryPayment.find({ businessId: req.businessId })
      .sort('-paidAt')
      .lean();

    if (payments.length === 0) {
      return res.json({ months: [], stats: { totalAmount: 0, totalPayments: 0, monthsCount: 0 } });
    }

    const byMonth = {};
    for (const p of payments) {
      const month = (p.untilDate || '').slice(0, 7);
      if (!byMonth[month]) byMonth[month] = [];
      byMonth[month].push(p);
    }

    const months = [];
    let grandAmount = 0;
    for (const [month, pays] of Object.entries(byMonth)) {
      const employeeIds = [...new Set(pays.map(p => String(p.employeeId)))];
      const [yy, mm] = month.split('-').map(Number);
      const lastDay = new Date(yy, mm, 0).getDate();
      const startStr = `${month}-01`;
      const endStr = `${month}-${String(lastDay).padStart(2, '0')}`;

      const earnAgg = await DailyAssignment.aggregate([
        {
          $match: {
            businessId: req.businessId,
            dateString: { $gte: startStr, $lte: endStr },
            employeeId: { $in: pays.map(p => p.employeeId) },
          },
        },
        { $group: { _id: '$employeeId', earned: { $sum: '$earning' } } },
      ]);
      const earnMap = Object.fromEntries(earnAgg.map(x => [String(x._id), x.earned]));

      const employees = employeeIds.map(eid => {
        const empPays = pays.filter(p => String(p.employeeId) === eid);
        const totalPaid = empPays.reduce((s, p) => s + (p.amount || 0), 0);
        const earned = earnMap[eid] || 0;
        const snap = empPays[0]?.employeeSnapshot || {};
        return {
          employeeId: eid,
          fullName: snap.fullName || '-',
          code: snap.code || '-',
          earned,
          paid: totalPaid,
          remaining: Math.max(0, earned - totalPaid),
          status: earned <= totalPaid ? 'full' : 'partial',
        };
      });

      const totalAmount = pays.reduce((s, p) => s + (p.amount || 0), 0);
      grandAmount += totalAmount;
      months.push({
        month,
        totalAmount,
        employeesCount: employees.length,
        paymentsCount: pays.length,
        fullCount: employees.filter(e => e.status === 'full').length,
        partialCount: employees.filter(e => e.status === 'partial').length,
        employees,
      });
    }

    months.sort((a, b) => b.month.localeCompare(a.month));

    res.json({
      months,
      stats: {
        totalAmount: grandAmount,
        totalPayments: payments.length,
        monthsCount: months.length,
      },
    });
  } catch (err) {
    console.error('Archive GET:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.delete('/payment/:id', async (req, res) => {
  try {
    const p = await SalaryPayment.findOneAndDelete({
      _id: req.params.id,
      businessId: req.businessId,
    });
    if (!p) return res.status(404).json({ error: "To'lov topilmadi" });
    res.json({ success: true });
  } catch (err) {
    console.error('Archive DELETE:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

module.exports = router;
