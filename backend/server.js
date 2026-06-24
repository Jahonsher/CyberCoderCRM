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

// ========== TRUST PROXY (Railway, Vercel uchun MUHIM!) ==========
// Railway proxy orqali ishlaydi — X-Forwarded-For header keladi
app.set('trust proxy', 1);

// ========== SECURITY ==========
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'", "'unsafe-inline'",
          "https://cdn.tailwindcss.com",
          "https://cdn.jsdelivr.net",
          "https://unpkg.com",
        ],
        styleSrc: [
          "'self'", "'unsafe-inline'",
          "https://cdn.tailwindcss.com",
          "https://fonts.googleapis.com",
        ],
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
  'https://cybercodercrm-production.up.railway.app',
  /\.vercel\.app$/,
  /\.railway\.app$/,
  /\.koyeb\.app$/,
  'http://localhost:3000',
  'http://localhost:5173',
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
      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`⚠️  CORS bloklandi: ${origin}`);
        callback(null, true);
      }
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

    console.log('📡 MongoDB ga ulanmoqda...');
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
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

process.on('SIGTERM', () => {
  console.log('SIGTERM qabul qilindi');
  mongoose.connection.close();
  process.exit(0);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

startServer();