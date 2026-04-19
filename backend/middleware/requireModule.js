const Business = require('../models/Business');
const { isValidModule } = require('../config/modules');

/**
 * requireModule Middleware
 *
 * Biznes admin ma'lum bir modulga kirish huquqini tekshiradi.
 *
 * Ishlashi:
 * 1. verifyToken va requireAdmin dan keyin ishlaydi
 * 2. req.business ni tekshiradi (yoki qayta yuklaydi)
 * 3. Modul enabledModules ro'yxatida bormi - tekshiradi
 * 4. Yo'q bo'lsa - 403 qaytaradi
 *
 * Foydalanish:
 *   router.use(requireModule('employees'));
 *   router.get('/', ...);
 */
const requireModule = (moduleKey) => {
  // Dev-time tekshiruv
  if (!isValidModule(moduleKey)) {
    throw new Error(`Noma'lum modul: ${moduleKey}`);
  }

  return async (req, res, next) => {
    try {
      // SuperAdmin uchun barcha modullarga ruxsat
      if (req.user && req.user.role === 'superadmin') {
        return next();
      }

      // req.business bo'lmasa (verifyToken dan keyin bo'lishi kerak)
      let business = req.business;
      if (!business && req.user && req.user.businessId) {
        business = await Business.findById(req.user.businessId);
      }

      if (!business) {
        return res.status(401).json({ error: 'Biznes topilmadi' });
      }

      // Modul yoqilganmi?
      if (!business.hasModule(moduleKey)) {
        return res.status(403).json({
          error: 'Bu modul sizning biznesingiz uchun yoqilmagan. SuperAdmin bilan bog\'laning.',
          moduleKey,
        });
      }

      next();
    } catch (err) {
      console.error('requireModule xato:', err);
      res.status(500).json({ error: 'Server xatosi' });
    }
  };
};

module.exports = requireModule;