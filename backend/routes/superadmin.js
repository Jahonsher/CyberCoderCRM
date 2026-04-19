const express = require('express');
const router = express.Router();

const Business = require('../models/Business');
const Employee = require('../models/Employee');
const Direction = require('../models/Direction');
const DailyAssignment = require('../models/DailyAssignment');
const DailyProduct = require('../models/DailyProduct');
const ReservedCode = require('../models/ReservedCode');
const Archive = require('../models/Archive');

const { verifyToken, requireSuperAdmin } = require('../middleware/auth');
const { upload, deleteLogoFile } = require('../middleware/upload');

// Barcha route'lar SuperAdmin uchun
router.use(verifyToken, requireSuperAdmin);

/**
 * GET /api/superadmin/businesses
 * Barcha bizneslar ro'yxati
 */
router.get('/businesses', async (req, res) => {
  try {
    const businesses = await Business.find().sort({ createdAt: -1 });

    // Har birining statistikasi
    const businessesWithStats = await Promise.all(
      businesses.map(async (b) => {
        const [employeeCount, directionCount] = await Promise.all([
          Employee.countDocuments({ businessId: b._id, status: 'active' }),
          Direction.countDocuments({ businessId: b._id, status: 'active' }),
        ]);

        return {
          ...b.toJSON(),
          stats: {
            employees: employeeCount,
            directions: directionCount,
          },
        };
      })
    );

    res.json(businessesWithStats);
  } catch (err) {
    console.error('GET /businesses xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * GET /api/superadmin/businesses/:id
 * Bitta biznes ma'lumotlari
 */
router.get('/businesses/:id', async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ error: 'Biznes topilmadi' });
    }
    res.json(business);
  } catch (err) {
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * POST /api/superadmin/businesses
 * Yangi biznes yaratish (logo bilan)
 *
 * multipart/form-data:
 *   name, phone, login, password, logo (file), note, defaultLanguage
 */
router.post('/businesses', upload.single('logo'), async (req, res) => {
  try {
    const { name, phone, login, password, note, defaultLanguage } = req.body;

    // Validatsiya
    if (!name || !phone || !login || !password) {
      if (req.file) deleteLogoFile(req.file.filename);
      return res.status(400).json({
        error: 'Nomi, telefon, login va parol majburiy',
      });
    }

    if (password.length < 6) {
      if (req.file) deleteLogoFile(req.file.filename);
      return res.status(400).json({
        error: 'Parol kamida 6 belgi bo\'lishi kerak',
      });
    }

    // Login unique tekshirish
    const existing = await Business.findOne({ login: login.toLowerCase().trim() });
    if (existing) {
      if (req.file) deleteLogoFile(req.file.filename);
      return res.status(400).json({
        error: 'Bu login band, boshqa tanlang',
      });
    }

    // Biznes yaratish
    const business = await Business.create({
      name: name.trim(),
      phone: phone.trim(),
      login: login.toLowerCase().trim(),
      password, // pre-save hash qiladi
      logo: req.file ? req.file.filename : null,
      note: note || '',
      defaultLanguage: defaultLanguage || 'uz-lat',
    });

    res.status(201).json({
      success: true,
      business: business.toJSON(),
    });
  } catch (err) {
    if (req.file) deleteLogoFile(req.file.filename);
    console.error('POST /businesses xato:', err);

    if (err.code === 11000) {
      return res.status(400).json({ error: 'Bu login allaqachon mavjud' });
    }

    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

/**
 * PUT /api/superadmin/businesses/:id
 * Biznesni yangilash (logo bilan)
 */
router.put('/businesses/:id', upload.single('logo'), async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) {
      if (req.file) deleteLogoFile(req.file.filename);
      return res.status(404).json({ error: 'Biznes topilmadi' });
    }

    const { name, phone, login, password, note, defaultLanguage } = req.body;

    // Login o'zgarsa - unique tekshirish
    if (login && login.toLowerCase().trim() !== business.login) {
      const existing = await Business.findOne({
        login: login.toLowerCase().trim(),
        _id: { $ne: business._id },
      });
      if (existing) {
        if (req.file) deleteLogoFile(req.file.filename);
        return res.status(400).json({ error: 'Bu login band' });
      }
      business.login = login.toLowerCase().trim();
    }

    if (name) business.name = name.trim();
    if (phone) business.phone = phone.trim();
    if (note !== undefined) business.note = note;
    if (defaultLanguage) business.defaultLanguage = defaultLanguage;

    // Parol o'zgartirilgan bo'lsa
    if (password && password.length >= 6) {
      business.password = password; // pre-save hash qiladi
    }

    // Yangi logo yuklangan bo'lsa - eskisini o'chirish
    if (req.file) {
      if (business.logo) {
        deleteLogoFile(business.logo);
      }
      business.logo = req.file.filename;
    }

    await business.save();

    res.json({
      success: true,
      business: business.toJSON(),
    });
  } catch (err) {
    if (req.file) deleteLogoFile(req.file.filename);
    console.error('PUT /businesses xato:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

/**
 * POST /api/superadmin/businesses/:id/suspend
 * Biznesni to'xtatish yoki qayta yoqish
 */
router.post('/businesses/:id/suspend', async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ error: 'Biznes topilmadi' });
    }

    business.status = business.status === 'active' ? 'suspended' : 'active';
    await business.save();

    res.json({
      success: true,
      status: business.status,
      message: business.status === 'suspended'
        ? 'Biznes to\'xtatildi'
        : 'Biznes faollashtirildi',
    });
  } catch (err) {
    console.error('Suspend xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * DELETE /api/superadmin/businesses/:id
 * Biznesni to'liq o'chirish (barcha ma'lumotlari bilan)
 * DIQQAT: Bu amal qaytarilmaydi!
 */
router.delete('/businesses/:id', async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ error: 'Biznes topilmadi' });
    }

    // Logo faylini o'chirish
    if (business.logo) {
      deleteLogoFile(business.logo);
    }

    // Barcha bog'liq ma'lumotlarni o'chirish
    const businessId = business._id;
    await Promise.all([
      Employee.deleteMany({ businessId }),
      Direction.deleteMany({ businessId }),
      DailyAssignment.deleteMany({ businessId }),
      DailyProduct.deleteMany({ businessId }),
      ReservedCode.deleteMany({ businessId }),
      Archive.deleteMany({ businessId }),
    ]);

    // Biznesni o'chirish
    await business.deleteOne();

    res.json({
      success: true,
      message: 'Biznes va barcha ma\'lumotlari o\'chirildi',
    });
  } catch (err) {
    console.error('DELETE /businesses xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * GET /api/superadmin/stats
 * Umumiy statistika
 */
router.get('/stats', async (req, res) => {
  try {
    const [totalBusinesses, activeBusinesses, totalEmployees] = await Promise.all([
      Business.countDocuments(),
      Business.countDocuments({ status: 'active' }),
      Employee.countDocuments({ status: 'active' }),
    ]);

    res.json({
      totalBusinesses,
      activeBusinesses,
      suspendedBusinesses: totalBusinesses - activeBusinesses,
      totalEmployees,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server xatosi' });
  }
});

module.exports = router;