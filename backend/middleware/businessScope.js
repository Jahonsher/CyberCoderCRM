/**
 * CyberCoderCRM - businessScope Middleware
 */

function businessScope(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Autentifikatsiya kerak' });
    }

    if (req.user.role === 'superadmin') {
      const qBusinessId = req.query.businessId || req.body?.businessId;
      req.businessId = qBusinessId || null;
      return next();
    }

    if (req.user.role === 'admin') {
      req.businessId = req.user.businessId;
      return next();
    }

    return res.status(403).json({ error: 'Ruxsat yo\'q' });
  } catch (err) {
    console.error('businessScope xato:', err);
    return res.status(500).json({ error: 'Server xatosi' });
  }
}

module.exports = businessScope;
