/**
 * CyberCoderCRM - Main Server
 * Railway proxy qo'llab-quvvatlaydi
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// Railway proxy orqali ishlaydi — X-Forwarded-For header keladi
app.set('trust proxy', 1);

// ========== SECURITY ==========
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https:", "wss:"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// ========== CORS ==========
const allowedOrigins = [
  process.env.CLIENT_URL,
  /\.railway\.app$/,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isAllowed = allowedOrigins.some((allowed) => {
        if (allowed instanceof RegExp) return allowed.test(origin);
        return allowed === origin;
      });
      if (!isAllowed) console.warn(`⚠️  CORS bloklandi: ${origin}`);
      callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// ========== RATE LIMITING ==========
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Juda ko\'p so\'rov' },
  standardHeaders: true,
  legacyHeaders: false,
  // Railway proxy uchun validatsiyani o'chirish
  validate: { xForwardedForHeader: false, trustProxy: false },
});
app.use('/api/', generalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Juda ko\'p login urinishi' },
  skipSuccessfulRequests: true,
  validate: { xForwardedForHeader: false, trustProxy: false },
});
app.use('/api/auth/login', authLimiter);

app.use((req, res, next) => {
  if (req.url.includes('..') || req.url.includes('%2e%2e')) {
    return res.status(400).json({ error: 'Noto\'g\'ri so\'rov' });
  }
  next();
});

// ========== STATIC FILES ==========
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use('/uploads', express.static(uploadsDir, {
  maxAge: '7d',
  setHeaders: (res) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
  },
}));

// ========== BIZNES LOGOSI (public, DB'dan) ==========
// Logo binary MongoDB'da saqlanadi; <img src> token yubormagani uchun public.
const Business = require('./models/Business');
app.get('/logo/:id', async (req, res) => {
  try {
    const biz = await Business.findById(req.params.id)
      .select('+logoData logoType')
      .lean();
    if (!biz || !biz.logoData) return res.status(404).end();
    const buf = Buffer.isBuffer(biz.logoData)
      ? biz.logoData
      : Buffer.from(biz.logoData.buffer || biz.logoData);
    res.setHeader('Content-Type', biz.logoType || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return res.send(buf);
  } catch (err) {
    return res.status(500).end();
  }
});

app.use('/superadmin', express.static(path.join(__dirname, '..', 'client', 'superadmin')));
app.use('/admin', express.static(path.join(__dirname, '..', 'client', 'admin')));
app.use('/shared', express.static(path.join(__dirname, '..', 'client', 'shared')));

// ========== HEALTH CHECK ==========
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongoStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

app.get('/', (req, res) => {
  res.redirect('/admin/');
});

// ========== START SERVER ==========
async function startServer() {
  try {
    console.log('========================================');
    console.log('🚀 CyberCoderCRM ishga tushmoqda...');

    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI .env da topilmadi');
    }
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET .env da topilmadi');
    }

    console.log('📡 MongoDB ga ulanmoqda...');
    const maxAttempts = 5;
    let attempt = 0;
    while (true) {
      attempt++;
      try {
        await mongoose.connect(process.env.MONGO_URI, {
          serverSelectionTimeoutMS: 30000,
          socketTimeoutMS: 45000,
          family: 4,
        });
        break;
      } catch (err) {
        const short = (err.message || '').split('\n')[0];
        console.warn(`⚠️  Urinish ${attempt}/${maxAttempts}: ${short}`);
        if (attempt >= maxAttempts) throw err;
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    console.log(`✅ MongoDB ulandi: ${mongoose.connection.host}`);
    console.log(`📦 Database: ${mongoose.connection.name}`);

    mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB uzildi'));
    mongoose.connection.on('reconnected', () => console.log('✅ MongoDB qayta ulandi'));
    mongoose.connection.on('error', (err) => console.error('❌ MongoDB xato:', err.message));

    console.log('👤 SuperAdmin tekshirilmoqda...');
    const createSuperAdmin = require('./utils/createSuperAdmin');
    await createSuperAdmin();

    console.log('📋 Routes yuklanmoqda...');
    app.use('/api/auth', require('./routes/auth'));
    app.use('/api/superadmin', require('./routes/superadmin'));
    app.use('/api/employees', require('./routes/employees'));
    app.use('/api/departments', require('./routes/departments'));
    app.use('/api/directions', require('./routes/directions'));
    app.use('/api/daily-report', require('./routes/dailyReport'));
    app.use('/api/monthly-report', require('./routes/monthlyReport'));
    app.use('/api/salary', require('./routes/salary'));
    app.use('/api/archive', require('./routes/archive'));
    console.log('✅ Barcha routes yuklandi');

    app.use((req, res) => {
      res.status(404).json({ error: 'Topilmadi' });
    });

    app.use((err, req, res, next) => {
      console.error('❌ Request xatosi:', err);
      if (err.name === 'ValidationError') {
        return res.status(400).json({ error: err.message });
      }
      if (err.name === 'MulterError') {
        return res.status(400).json({ error: `Fayl xatosi: ${err.message}` });
      }
      res.status(err.status || 500).json({
        error: err.message || 'Server xatosi',
      });
    });

    app.listen(PORT, () => {
      console.log('========================================');
      console.log(`🚀 Server ishlayapti!`);
      console.log(`🌐 Port: ${PORT}`);
      console.log(`🔧 Muhit: ${process.env.NODE_ENV || 'development'}`);
      console.log('========================================');
    });
  } catch (err) {
    console.error('❌ Server start xatosi:', err);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`${signal} qabul qilindi — to'xtatilmoqda...`);
  try { await mongoose.connection.close(); } catch (_) {}
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

startServer();