/**
 * CyberCoderCRM - requireModule Middleware
 * Biznes uchun kerakli modul yoqilganligini tekshiradi
 */

const Business = require('../models/Business');
const { moduleExists } = require('../config/modules');

/**
 * requireModule(moduleKey) - middleware factory
 * Misol: router.get('/', verifyToken, requireModule('employees'), handler)
 */
function requireModule(moduleKey) {
  return async (req, res, next) => {
    try {
      // SuperAdmin har doim o'ta olishi mumkin
      if (req.user && req.user.role === 'superadmin') {
        return next();
      }

      // Admin bo'lmasa - xato
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Ruxsat yo\'q' });
      }

      // Modul mavjudligi
      if (!moduleExists(moduleKey)) {
        return res.status(400).json({ error: `Modul topilmadi: ${moduleKey}` });
      }

      // Biznesni olish
      const business = await Business.findById(req.user.businessId).select('enabledModules status');

      if (!business) {
        return res.status(404).json({ error: 'Biznes topilmadi' });
      }

      if (business.status === 'suspended') {
        return res.status(403).json({ error: "Biznes to'xtatilgan" });
      }

      // Modul yoqilganmi?
      const enabledModules = business.enabledModules || [];
      if (!enabledModules.includes(moduleKey)) {
        return res.status(403).json({
          error: `Bu modul yoqilmagan: ${moduleKey}`
        });
      }

      next();
    } catch (err) {
      console.error('requireModule xatosi:', err);
      res.status(500).json({ error: 'Server xatosi' });
    }
  };
}

module.exports = requireModule;