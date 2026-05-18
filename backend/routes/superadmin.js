/**
 * CyberCoderCRM - SuperAdmin Routes
 * YANGI: enabledWorkTypes (piecework + daily) qabul qilinadi
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

const Business = require('../models/Business');
const Employee = require('../models/Employee');
const Direction = require('../models/Direction');
const DailyAssignment = require('../models/DailyAssignment');
const DailyProduct = require('../models/DailyProduct');
const ReservedCode = require('../models/ReservedCode');
const Archive = require('../models/Archive');

const { verifyToken, requireSuperAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { getAllModules } = require('../config/modules');

router.use(verifyToken, requireSuperAdmin);

// enabledWorkTypes ni parse qiluvchi yordamchi
function parseWorkTypes(input) {
  if (!input) {
    return { piecework: true, daily: true };
  }
  // FormData orqali keladi - JSON string yoki object
  let obj = input;
  if (typeof input === 'string') {
    try {
      obj = JSON.parse(input);
    } catch (e) {
      return { piecework: true, daily: true };
    }
  }
  const pw = obj.piecework === true || obj.piecework === 'true';
  const d = obj.daily === true || obj.daily === 'true';
  // Kamida bittasi yoqilgan bo'lishi kerak
  if (!pw && !d) {
    return { piecework: true, daily: true };
  }
  return { piecework: pw, daily: d };
}

router.get('/modules', (req, res) => {
  res.json(getAllModules());
});

router.get('/stats', async (req, res) => {
  try {
    const [total, active, suspended, totalEmployees] = await Promise.all([
      Business.countDocuments(),
      Business.countDocuments({ status: 'active' }),
      Business.countDocuments({ status: 'suspended' }),
      Employee.countDocuments({ status: { $ne: 'deleted' } }),
    ]);

    res.json({
      totalBusinesses: total,
      activeBusinesses: active,
      suspendedBusinesses: suspended,
      totalEmployees,
    });
  } catch (err) {
    console.error('Stats xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.get('/businesses', async (req, res) => {
  try {
    const businesses = await Business.find().select('-password').sort('-createdAt');

    const result = await Promise.all(
      businesses.map(async (biz) => {
        const employeeCount = await Employee.countDocuments({
          businessId: biz._id,
          status: { $ne: 'deleted' },
        });
        const obj = biz.toObject();
        // enabledWorkTypes - default bilan
        if (!obj.enabledWorkTypes) {
          obj.enabledWorkTypes = { piecework: true, daily: true };
        }
        return {
          ...obj,
          stats: { employees: employeeCount },
        };
      })
    );

    res.json(result);
  } catch (err) {
    console.error('Businesses xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.post('/businesses', upload.single('logo'), async (req, res) => {
  try {
    const { name, phone, login, password, defaultLanguage, note, enabledModules, enabledWorkTypes } = req.body;

    console.log('📝 Yangi biznes yaratish:', { name, login, hasPassword: !!password });

    if (!name || !phone || !login || !password) {
      return res.status(400).json({ error: "Barcha majburiy maydonlarni to'ldiring" });
    }

    const passwordStr = String(password).trim();
    if (passwordStr.length < 6) {
      return res.status(400).json({ error: 'Parol kamida 6 belgi' });
    }

    const loginLower = String(login).trim().toLowerCase();
    if (loginLower.length < 3) {
      return res.status(400).json({ error: 'Login kamida 3 belgi' });
    }

    const existing = await Business.findOne({ login: loginLower });
    if (existing) {
      return res.status(400).json({ error: 'Bu login band' });
    }

    let modules = [];
    if (enabledModules) {
      try {
        modules = JSON.parse(enabledModules);
      } catch (e) {
        modules = [];
      }
    }

    if (modules.length === 0) {
      modules = getAllModules().filter(m => m.default).map(m => m.key);
    }

    const workTypes = parseWorkTypes(enabledWorkTypes);
    console.log('🛠 Work types:', workTypes);

    const hashedPassword = await bcrypt.hash(passwordStr, 10);

    const business = new Business({
      name: String(name).trim(),
      phone: String(phone).trim(),
      login: loginLower,
      password: hashedPassword,
      defaultLanguage: defaultLanguage || 'uz-lat',
      note: note ? String(note).trim() : '',
      enabledModules: modules,
      enabledWorkTypes: workTypes,
      logo: req.file ? req.file.filename : null,
      status: 'active',
    });

    await business.save();

    console.log(`✅ Biznes yaratildi: ${business.name} (${loginLower})`);

    const result = business.toObject();
    delete result.password;

    res.status(201).json(result);
  } catch (err) {
    console.error('❌ Business yaratishda xato:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

router.put('/businesses/:id', upload.single('logo'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, login, password, defaultLanguage, note, enabledModules, enabledWorkTypes } = req.body;

    const business = await Business.findById(id);
    if (!business) return res.status(404).json({ error: 'Biznes topilmadi' });

    if (name) business.name = String(name).trim();
    if (phone) business.phone = String(phone).trim();
    if (defaultLanguage) business.defaultLanguage = defaultLanguage;
    if (note !== undefined) business.note = String(note).trim();

    if (login) {
      const loginLower = String(login).trim().toLowerCase();
      if (loginLower !== business.login) {
        const exists = await Business.findOne({ login: loginLower });
        if (exists && exists._id.toString() !== id) {
          return res.status(400).json({ error: 'Bu login band' });
        }
        business.login = loginLower;
      }
    }

    if (password && String(password).trim().length >= 6) {
      business.password = await bcrypt.hash(String(password).trim(), 10);
      console.log(`🔐 Parol yangilandi: ${business.login}`);
    }

    if (enabledModules) {
      try {
        business.enabledModules = JSON.parse(enabledModules);
      } catch (e) {}
    }

    // YANGI: enabledWorkTypes ni yangilash
    if (enabledWorkTypes !== undefined) {
      const workTypes = parseWorkTypes(enabledWorkTypes);
      business.enabledWorkTypes = workTypes;
      console.log('🛠 Work types yangilandi:', workTypes);
    }

    if (req.file) {
      business.logo = req.file.filename;
    }

    await business.save();

    const result = business.toObject();
    delete result.password;

    console.log(`✅ Biznes yangilandi: ${business.name}`);
    res.json(result);
  } catch (err) {
    console.error('❌ Business yangilashda xato:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
});

router.post('/businesses/:id/suspend', async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) return res.status(404).json({ error: 'Biznes topilmadi' });

    business.status = business.status === 'active' ? 'suspended' : 'active';
    await business.save();

    res.json({
      success: true,
      status: business.status,
      message: business.status === 'active' ? 'Biznes faollashtirildi' : "Biznes to'xtatildi",
    });
  } catch (err) {
    console.error('Suspend xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.put('/businesses/:id/modules', async (req, res) => {
  try {
    const { enabledModules } = req.body;
    if (!Array.isArray(enabledModules)) {
      return res.status(400).json({ error: "enabledModules array bo'lishi kerak" });
    }

    const business = await Business.findByIdAndUpdate(
      req.params.id,
      { enabledModules },
      { new: true }
    ).select('-password');

    if (!business) return res.status(404).json({ error: 'Biznes topilmadi' });
    res.json(business);
  } catch (err) {
    console.error('Modules xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

router.delete('/businesses/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await Promise.all([
      Employee.deleteMany({ businessId: id }),
      Direction.deleteMany({ businessId: id }),
      DailyAssignment.deleteMany({ businessId: id }),
      DailyProduct.deleteMany({ businessId: id }),
      ReservedCode.deleteMany({ businessId: id }),
      Archive.deleteMany({ businessId: id }),
      Business.findByIdAndDelete(id),
    ]);

    console.log(`🗑️ Biznes o'chirildi: ${id}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

module.exports = router;