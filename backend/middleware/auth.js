const jwt = require('jsonwebtoken');
const Business = require('../models/Business');

/**
 * JWT ni tekshirish va foydalanuvchini aniqlash
 *
 * Ikkita rol bor:
 * - superadmin: barcha bizneslarni boshqaradi
 * - admin: bitta biznes admini (businessId orqali isolated)
 */
const verifyToken = async (req, res, next) => {
  try {
    // Authorization header'dan token olish
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token topilmadi' });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token noto\'g\'ri formatda' });
    }

    // Tokenni tekshirish
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // req ga foydalanuvchi ma'lumotlarini qo'yish
    req.user = {
      id: decoded.id,
      role: decoded.role, // 'superadmin' yoki 'admin'
      businessId: decoded.businessId || null,
    };

    // Agar admin bo'lsa - biznes statusini tekshirish
    if (decoded.role === 'admin' && decoded.businessId) {
      const business = await Business.findById(decoded.businessId);

      if (!business) {
        return res.status(401).json({ error: 'Biznes topilmadi' });
      }

      if (business.status === 'suspended') {
        return res.status(403).json({
          error: 'Biznes vaqtincha to\'xtatilgan. SuperAdmin bilan bog\'laning.',
        });
      }

      // Biznes ma'lumotlarini req ga qo'shish
      req.business = business;
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token muddati tugagan' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token noto\'g\'ri' });
    }
    console.error('Auth xato:', err);
    return res.status(500).json({ error: 'Server xatosi' });
  }
};

/**
 * Faqat SuperAdmin ga ruxsat
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({
      error: 'Faqat SuperAdmin uchun',
    });
  }
  next();
};

/**
 * Faqat Admin ga ruxsat (biznes admini)
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Faqat Biznes Admini uchun',
    });
  }

  if (!req.user.businessId) {
    return res.status(400).json({
      error: 'Biznes aniqlanmadi',
    });
  }

  next();
};

module.exports = {
  verifyToken,
  requireSuperAdmin,
  requireAdmin,
};