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
const { MODULES, isValidModule, getDefaultModules } = require('../config/modules');

router.use(verifyToken, requireSuperAdmin);

/**
 * GET /api/superadmin/modules
 * Barcha mavjud modullar ro'yxati
 */
router.get('/modules', (req, res) => {
  res.json(Object.values(MODULES));
});

/**
 * GET /api/superadmin/businesses
 * Barcha bizneslar + statistikasi
 */
router.get('/businesses', async (req, res) => {
  try {
    const businesses = await Business.find().sort({ createdAt: -1 });

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
 * Bitta biznes
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
 * Parse enabledModules from request body
 * Support both array and JSON string (FormData uchun)
 */
function parseEnabledModules(raw) {
  if (!raw) return null;

  let modules;
  if (typeof raw === 'string') {
    try {
      modules = JSON.parse(raw);
    } catch {
      modules = raw.split(',').map((s) => s.trim());
    }
  } else if (Array.isArray(raw)) {
    modules = raw;
  } else {
    return null;
  }

  // Faqat haqiqiy modul key'larni qoldir
  return modules.filter(isValidModule);
}

/**
 * POST /api/superadmin/businesses
 * Yangi biznes yaratish
 */
router.post('/businesses', upload.single('logo'), async (req, res) => {
  try {
    const { name, phone, login, password, note, defaultLanguage, enabledModules } = req.body;

    if (!name || !phone || !login || !password) {
      if (req.file) deleteLogoFile(req.file.filename);
      return res.status(400).json({
        error: 'Nomi, telefon, login va parol majburiy',
      });
    }

    if (password.length < 6) {
      if (req.file) deleteLogoFile(req.file.filename);
      return res.status(400).json({ error: 'Parol kamida 6 belgi' });
    }

    const existing = await Business.findOne({ login: login.toLowerCase().trim() });
    if (existing) {
      if (req.file) deleteLogoFile(req.file.filename);
      return res.status(400).json({ error: 'Bu login band' });
    }

    const modules = parseEnabledModules(enabledModules) || getDefaultModules();

    const business = await Business.create({
      name: name.trim(),
      phone: phone.trim(),
      login: login.toLowerCase().trim(),
      password,
      logo: req.file ? req.file.filename : null,
      note: note || '',
      defaultLanguage: defaultLanguage || 'uz-lat',
      enabledModules: modules,
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
 * Biznesni yangilash
 */
router.put('/businesses/:id', upload.single('logo'), async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) {
      if (req.file) deleteLogoFile(req.file.filename);
      return res.status(404).json({ error: 'Biznes topilmadi' });
    }

    const { name, phone, login, password, note, defaultLanguage, enabledModules } = req.body;

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

    if (password && password.length >= 6) {
      business.password = password;
    }

    // Modullarni yangilash
    if (enabledModules !== undefined) {
      const modules = parseEnabledModules(enabledModules);
      if (modules !== null) {
        business.enabledModules = modules;
      }
    }

    if (req.file) {
      if (business.logo) deleteLogoFile(business.logo);
      business.logo = req.file.filename;
    }

    await business.save();

    res.json({ success: true, business: business.toJSON() });
  } catch (err) {
    if (req.file) deleteLogoFile(req.file.filename);
    console.error('PUT /businesses xato:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

/**
 * PUT /api/superadmin/businesses/:id/modules
 * Faqat modullarni yangilash (tez toggle uchun)
 *
 * Body: { enabledModules: [...] } yoki { moduleKey: 'employees', enabled: true }
 */
router.put('/businesses/:id/modules', async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ error: 'Biznes topilmadi' });
    }

    const { enabledModules, moduleKey, enabled } = req.body;

    // Variant 1: To'liq ro'yxat yuborilgan
    if (Array.isArray(enabledModules)) {
      const modules = enabledModules.filter(isValidModule);
      business.enabledModules = modules;
    }
    // Variant 2: Bitta modulni toggle qilish
    else if (moduleKey && typeof enabled === 'boolean') {
      if (!isValidModule(moduleKey)) {
        return res.status(400).json({ error: 'Noma\'lum modul' });
      }

      const current = new Set(business.enabledModules || []);
      if (enabled) {
        current.add(moduleKey);
      } else {
        current.delete(moduleKey);
      }
      business.enabledModules = Array.from(current);
    } else {
      return res.status(400).json({ error: 'Noto\'g\'ri so\'rov formati' });
    }

    await business.save();

    res.json({
      success: true,
      enabledModules: business.enabledModules,
    });
  } catch (err) {
    console.error('PUT /modules xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * POST /api/superadmin/businesses/:id/suspend
 * Suspend/activate
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
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * DELETE /api/superadmin/businesses/:id
 */
router.delete('/businesses/:id', async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ error: 'Biznes topilmadi' });
    }

    if (business.logo) deleteLogoFile(business.logo);

    const businessId = business._id;
    await Promise.all([
      Employee.deleteMany({ businessId }),
      Direction.deleteMany({ businessId }),
      DailyAssignment.deleteMany({ businessId }),
      DailyProduct.deleteMany({ businessId }),
      ReservedCode.deleteMany({ businessId }),
      Archive.deleteMany({ businessId }),
    ]);

    await business.deleteOne();

    res.json({ success: true, message: 'Biznes o\'chirildi' });
  } catch (err) {
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * GET /api/superadmin/stats
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