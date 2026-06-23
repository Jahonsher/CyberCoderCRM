/**
 * CyberCoderCRM - businessScope Middleware
 * req.businessId ni ObjectId sifatida saqlaydi (aggregate uchun ham mos).
 */

const mongoose = require('mongoose');

function toObjectId(id) {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  try { return new mongoose.Types.ObjectId(String(id)); }
  catch { return null; }
}

function businessScope(req, res, next) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Autentifikatsiya kerak' });

    if (req.user.role === 'superadmin') {
      const q = req.query.businessId || req.body?.businessId || null;
      req.businessId = toObjectId(q);
      return next();
    }
    if (req.user.role === 'admin') {
      req.businessId = toObjectId(req.user.businessId);
      if (!req.businessId) return res.status(400).json({ error: "businessId noto'g'ri" });
      return next();
    }
    return res.status(403).json({ error: "Ruxsat yo'q" });
  } catch (err) {
    console.error('businessScope:', err);
    return res.status(500).json({ error: 'Server xatosi' });
  }
}

module.exports = businessScope;
