const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const Business = require('../models/Business');
const createSuperAdmin = require('../utils/createSuperAdmin');
const SuperAdmin = createSuperAdmin.SuperAdmin;
const { verifyToken } = require('../middleware/auth');
const { MODULES } = require('../config/modules');

/**
 * JWT token yaratish
 */
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
};

/**
 * POST /api/auth/login
 * Login (superadmin yoki admin)
 */
router.post('/login', async (req, res) => {
  try {
    const { username, login, password } = req.body;
    const loginValue = (username || login || '').toLowerCase().trim();

    if (!loginValue || !password) {
      return res.status(400).json({ error: 'Login va parol kerak' });
    }

    // ========== 1. SUPERADMIN ==========
    const superAdmin = await SuperAdmin.findOne({ username: loginValue }).select('+password');

    if (superAdmin) {
      const isMatch = await superAdmin.comparePassword(password);

      if (!isMatch) {
        return res.status(401).json({ error: 'Login yoki parol noto\'g\'ri' });
      }

      superAdmin.lastLogin = new Date();
      await superAdmin.save();

      const token = generateToken({
        id: superAdmin._id,
        role: 'superadmin',
      });

      return res.json({
        success: true,
        token,
        user: {
          id: superAdmin._id,
          username: superAdmin.username,
          role: 'superadmin',
        },
      });
    }

    // ========== 2. BUSINESS ADMIN ==========
    const business = await Business.findOne({ login: loginValue }).select('+password');

    if (!business) {
      return res.status(401).json({ error: 'Login yoki parol noto\'g\'ri' });
    }

    if (business.status === 'suspended') {
      return res.status(403).json({
        error: 'Biznes vaqtincha to\'xtatilgan. SuperAdmin bilan bog\'laning.',
      });
    }

    const isMatch = await business.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Login yoki parol noto\'g\'ri' });
    }

    const token = generateToken({
      id: business._id,
      role: 'admin',
      businessId: business._id.toString(),
    });

    return res.json({
      success: true,
      token,
      user: {
        id: business._id,
        login: business.login,
        name: business.name,
        phone: business.phone,
        logo: business.logo,
        role: 'admin',
        businessId: business._id,
        defaultLanguage: business.defaultLanguage,
        enabledModules: business.enabledModules || [],
      },
    });
  } catch (err) {
    console.error('Login xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * GET /api/auth/me
 * Joriy foydalanuvchi + modullar
 */
router.get('/me', verifyToken, async (req, res) => {
  try {
    if (req.user.role === 'superadmin') {
      const superAdmin = await SuperAdmin.findById(req.user.id);
      if (!superAdmin) {
        return res.status(404).json({ error: 'SuperAdmin topilmadi' });
      }

      return res.json({
        id: superAdmin._id,
        username: superAdmin.username,
        role: 'superadmin',
        // SuperAdmin uchun barcha modullar
        allModules: Object.values(MODULES),
      });
    }

    // Admin
    const business = await Business.findById(req.user.businessId);
    if (!business) {
      return res.status(404).json({ error: 'Biznes topilmadi' });
    }

    // Yoqilgan modullar haqida to'liq ma'lumot
    const enabledModulesInfo = (business.enabledModules || [])
      .filter((key) => MODULES[key])
      .map((key) => MODULES[key]);

    res.json({
      id: business._id,
      login: business.login,
      name: business.name,
      phone: business.phone,
      logo: business.logo,
      status: business.status,
      role: 'admin',
      businessId: business._id,
      defaultLanguage: business.defaultLanguage,
      enabledModules: business.enabledModules || [],
      modulesInfo: enabledModulesInfo,
    });
  } catch (err) {
    console.error('GET /me xato:', err);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Chiqildi' });
});

module.exports = router;