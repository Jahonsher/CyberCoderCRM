/**
 * CyberCoderCRM - Auth Middleware
 * JWT token tekshiruv va rol
 */

const jwt = require('jsonwebtoken');

/**
 * verifyToken - tokenni tekshiradi va req.user'ga qo'yadi
 */
function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token yo\'q' });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token yo\'q' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token muddati tugagan' });
    }
    return res.status(401).json({ error: 'Token noto\'g\'ri' });
  }
}

/**
 * requireSuperAdmin - faqat SuperAdmin uchun
 */
function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Faqat SuperAdmin uchun' });
  }
  next();
}

/**
 * requireAdmin - faqat Admin (biznes) uchun
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Faqat Admin uchun' });
  }
  next();
}

module.exports = {
  verifyToken,
  requireSuperAdmin,
  requireAdmin,
};
