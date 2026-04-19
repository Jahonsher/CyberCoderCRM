/**
 * Business Scope Middleware
 *
 * Multi-tenant isolation - har bir biznes faqat o'zining ma'lumotlarini ko'radi
 *
 * Foydalanish:
 * - verifyToken dan keyin ishlatiladi
 * - req.user.businessId ni tekshiradi
 * - req.businessScope ga qo'yadi (barcha MongoDB query larda ishlatiladi)
 *
 * Masalan:
 *   const employees = await Employee.find({ ...req.businessScope, status: 'active' });
 */
const businessScope = (req, res, next) => {
  // Admin bo'lmasa (masalan SuperAdmin) - scope yo'q
  if (req.user.role !== 'admin') {
    return next();
  }

  // businessId bo'lmasa - xato
  if (!req.user.businessId) {
    return res.status(400).json({
      error: 'Biznes aniqlanmadi',
    });
  }

  // Har bir query uchun businessId filter tayyorlash
  req.businessScope = {
    businessId: req.user.businessId,
  };

  next();
};

module.exports = businessScope;