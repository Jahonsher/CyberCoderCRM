/**
 * CyberCoderCRM - Archive (v3)
 *
 * Oylik to'lov tarixi: har oy uchun to'liq/qisman to'langanlar ajratiladi.
 * "To'liq" — shu oyga oid jami earned summa to'langan paid summa bilan teng yoki kichik.
 * "Qisman" — qoldiq qoldi.
 *
 * Oyga guruhlash uchun yangi SalaryPayment.monthKey ishlatiladi.
 * Eski yozuvlarda monthKey bo'sh bo'lsa, untilDate.slice(0,7) ga fallback qilamiz —
 * eski to'lovlar arxivda saqlanib qoladi.
 */

const express = require('express');
const router = express.Router();

const fs = require('fs');

const SalaryPayment = require('../models/SalaryPayment');
const DailyAssignment = require('../models/DailyAssignment');
const ArchiveFile = require('../models/ArchiveFile');

const { verifyToken, requireAdmin } = require('../middleware/auth');
const businessScope = require('../middleware/businessScope');
const requireModule = require('../middleware/requireModule');

const { getAbsolutePath, removeFromDisk } = require('../services/excelArchive');

router.use(verifyToken, requireAdmin, businessScope, requireModule('archive'));

// Eksport fayllari bo'yicha umumiy statistika
async function computeFilesStats(businessId) {
  const agg = await ArchiveFile.aggregate([
    { $match: { businessId: businessId } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        size: { $sum: '$fileSize' },
      },
    },
  ]);
  const stats = {
    employeesCount: 0,
    dailyCount: 0,
    monthlyCount: 0,
    salaryCount: 0,
    totalSize: 0,
  };
  for (const row of agg) {
    if (row._id === 'employees') stats.employeesCount = row.count;
    else if (row._id === 'dailyReport') stats.dailyCount = row.count;
    else if (row._id === 'monthlyReport') stats.monthlyCount = row.count;
    else if (row._id === 'salary') stats.salaryCount = row.count;
    stats.totalSize += row.size || 0;
  }
  return stats;
}

router.get('/', async (req, res) => {
  try {
    const payments = await SalaryPayment.find({ businessId: req.businessId })
      .sort('-paidAt')
      .lean();

    if (payments.length === 0) {
      const filesStats = await computeFilesStats(req.businessId);
      return res.json({
        months: [],
        stats: { totalAmount: 0, totalPayments: 0, monthsCount: 0 },
        filesStats,
      });
    }

    const byMonth = {};
    for (const p of payments) {
      // Yangi tizimda monthKey saqlanadi; eski yozuvlar uchun untilDate fallback.
      const month = p.monthKey || (p.untilDate || '').slice(0, 7);
      if (!month) continue;
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

    const filesStats = await computeFilesStats(req.businessId);

    res.json({
      months,
      stats: {
        totalAmount: grandAmount,
        totalPayments: payments.length,
        monthsCount: months.length,
      },
      filesStats,
    });
  } catch (err) {
    console.error('Archive GET:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * GET /api/archive/files?category=&from=&to=
 * ArchiveFile yozuvlari ro'yxati (eksport tarixi).
 */
router.get('/files', async (req, res) => {
  try {
    const { category, from, to } = req.query;
    const filter = { businessId: req.businessId };

    const allowedCats = ['employees', 'dailyReport', 'monthlyReport', 'salary'];
    if (category && allowedCats.includes(String(category))) {
      filter.category = String(category);
    }

    if (from || to) {
      filter.generatedAt = {};
      if (from) {
        const d = new Date(String(from));
        if (!isNaN(d.getTime())) filter.generatedAt.$gte = d;
      }
      if (to) {
        const d = new Date(String(to));
        if (!isNaN(d.getTime())) {
          // To kunni kun oxirigacha kengaytirish
          d.setHours(23, 59, 59, 999);
          filter.generatedAt.$lte = d;
        }
      }
      if (Object.keys(filter.generatedAt).length === 0) delete filter.generatedAt;
    }

    const files = await ArchiveFile.find(filter).sort('-generatedAt').lean();
    res.json({ files, total: files.length });
  } catch (err) {
    console.error('Archive files GET:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * GET /api/archive/files/:id/download
 * Saqlangan Excel faylni yuklab beradi.
 */
router.get('/files/:id/download', async (req, res) => {
  try {
    const doc = await ArchiveFile.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    }).select('+data').lean();
    if (!doc) return res.status(404).json({ error: 'Fayl topilmadi' });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(doc.displayName || doc.fileName)}"`
    );

    // Yangi yozuvlar: binary DB'da
    if (doc.data && doc.data.length) {
      return res.send(Buffer.isBuffer(doc.data) ? doc.data : Buffer.from(doc.data.buffer || doc.data));
    }

    // Legacy: eski diskdagi fayl (deploy'dan keyin mavjud bo'lmasligi mumkin)
    if (doc.filePath) {
      const abs = getAbsolutePath(doc.filePath);
      if (fs.existsSync(abs)) {
        const stream = fs.createReadStream(abs);
        stream.on('error', (err) => {
          console.error('Archive download stream xato:', err);
          if (!res.headersSent) res.status(500).end();
        });
        return stream.pipe(res);
      }
    }

    return res.status(404).json({ error: 'Fayl maʼlumoti topilmadi' });
  } catch (err) {
    console.error('Archive download GET:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * DELETE /api/archive/files/:id
 * Arxiv yozuvini va shu yozuvga tegishli faylni o'chiradi.
 */
router.delete('/files/:id', async (req, res) => {
  try {
    const doc = await ArchiveFile.findOneAndDelete({
      _id: req.params.id,
      businessId: req.businessId,
    });
    if (!doc) return res.status(404).json({ error: 'Fayl topilmadi' });

    if (doc.filePath) removeFromDisk(doc.filePath);
    res.json({ success: true });
  } catch (err) {
    console.error('Archive file DELETE:', err);
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

    // Shu to'lovga bog'langan kunlarni paid=false qilib qaytaramiz —
    // aks holda ular qayta to'lanmaydigan "yetim" yozuvlar bo'lib qoladi.
    await DailyAssignment.updateMany(
      { businessId: req.businessId, paymentId: p._id },
      { $set: { paid: false, paymentId: null, paidAt: null } }
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Archive DELETE:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

module.exports = router;
