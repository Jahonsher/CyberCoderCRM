/**
 * CyberCoderCRM - Auth routes (v2)
 *  - enabledWorkTypes olib tashlandi (piecework/daily ajratish endi yo'q).
 *  - /me admin uchun enabledModules + modulesInfo qaytaradi.
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const router = express.Router();

const SuperAdmin = require('../models/SuperAdmin');
const Business = require('../models/Business');
const { verifyToken } = require('../middleware/auth');
const { getAllModules } = require('../config/modules');
const { logoUrl } = require('../utils/logo');

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, error: "Parol kerak" });
    }

    const passwordStr = String(password);
    const usernameLower = username
      ? String(username).trim().toLowerCase()
      : passwordStr.trim().toLowerCase();
    console.log(`🔐 Login urinishi: ${usernameLower}`);

    // ========== SUPERADMIN ==========
    const superAdmin = await SuperAdmin.findOne({ username: usernameLower }).select('+password');

    if (superAdmin) {
      if (!superAdmin.password) {
        console.log(`❌ SuperAdmin paroli yo'q DB'da`);
        return res.status(500).json({ success: false, error: "Server konfiguratsiya xatosi" });
      }

      const isMatch = await bcrypt.compare(passwordStr, superAdmin.password);
      if (!isMatch) {
        console.log(`❌ SuperAdmin parol xato`);
        return res.status(401).json({ success: false, error: "Login yoki parol noto'g'ri" });
      }

      const token = jwt.sign(
        { id: superAdmin._id, role: 'superadmin', username: superAdmin.username },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
      );

      console.log(`✅ SuperAdmin kirdi: ${usernameLower}`);
      return res.json({
        success: true, token,
        user: { id: superAdmin._id, username: superAdmin.username, role: 'superadmin' }
      });
    }

    // ========== BUSINESS ADMIN ==========
    const business = await Business.findOne({ login: usernameLower }).select('+password');

    if (!business) {
      console.log(`❌ Biznes topilmadi: ${usernameLower}`);
      return res.status(401).json({ success: false, error: "Login yoki parol noto'g'ri" });
    }

    if (!business.password) {
      console.log(`❌ Biznesning paroli DB'da yo'q: ${usernameLower}`);
      return res.status(500).json({
        success: false,
        error: "Biznes parol noto'g'ri saqlangan. SuperAdmin orqali yangilang."
      });
    }

    if (business.status === 'suspended') {
      return res.status(403).json({ success: false, error: "Biznes to'xtatilgan" });
    }

    const isMatch = await bcrypt.compare(passwordStr, business.password);
    if (!isMatch) {
      console.log(`❌ Admin parol xato`);
      return res.status(401).json({ success: false, error: "Login yoki parol noto'g'ri" });
    }

    const token = jwt.sign(
      { id: business._id, role: 'admin', businessId: business._id, login: business.login },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
    );

    console.log(`✅ Admin kirdi: ${business.name}`);

    return res.json({
      success: true, token,
      user: {
        id: business._id,
        login: business.login,
        name: business.name,
        logo: logoUrl(business),
        role: 'admin',
        enabledModules: business.enabledModules || [],
        defaultLanguage: business.defaultLanguage || 'uz-lat',
      }
    });
  } catch (err) {
    console.error('❌ Login xatosi:', err);
    return res.status(500).json({ success: false, error: "Server xatosi" });
  }
});

router.get('/me', verifyToken, async (req, res) => {
  try {
    if (req.user.role === 'superadmin') {
      const superAdmin = await SuperAdmin.findById(req.user.id).select('-password');
      if (!superAdmin) return res.status(404).json({ error: 'Topilmadi' });
      return res.json({
        id: superAdmin._id,
        username: superAdmin.username,
        role: 'superadmin',
      });
    }

    if (req.user.role === 'admin') {
      const business = await Business.findById(req.user.businessId).select('-password');
      if (!business) return res.status(404).json({ error: 'Biznes topilmadi' });
      if (business.status === 'suspended') {
        return res.status(403).json({ error: "Biznes to'xtatilgan" });
      }

      const allModules = getAllModules();
      const modulesInfo = allModules.filter(m =>
        (business.enabledModules || []).includes(m.key)
      );

      return res.json({
        id: business._id,
        login: business.login,
        name: business.name,
        logo: logoUrl(business),
        phone: business.phone,
        role: 'admin',
        enabledModules: business.enabledModules || [],
        modulesInfo,
        defaultLanguage: business.defaultLanguage || 'uz-lat',
      });
    }

    return res.status(400).json({ error: "Noto'g'ri rol" });
  } catch (err) {
    console.error('/me xatosi:', err);
    return res.status(500).json({ error: 'Server xatosi' });
  }
});

module.exports = router;