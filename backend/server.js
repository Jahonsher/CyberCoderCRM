/**
 * CyberCoderCRM - Main Server
 * Multi-tenant CRM platform
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

const connectDB = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== DATABASE ==========
connectDB();

// ========== SECURITY MIDDLEWARE ==========

// Helmet - security headers (A+ rating uchun)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.tailwindcss.com",
          "https://cdn.jsdelivr.net",
          "https://unpkg.com",
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.tailwindcss.com",
          "https://fonts.googleapis.com",
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS
app.use(
  cors({
    origin: process.env.CLIENT_URL || '*',
    credentials: true,
  })
);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// NoSQL injection oldini olish
app.use(mongoSanitize());

// XSS hujumlaridan himoya
app.use(xss());

// HTTP parameter pollution
app.use(hpp());

// Rate limiting - umumiy
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 daqiqa
  max: 500, // har IP dan 500 so'rov
  message: { error: 'Juda ko\'p so\'rov yuborildi, keyinroq urinib ko\'ring' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', generalLimiter);

// Login uchun qattiqroq rate limit
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 15 daqiqada faqat 10 ta urinish
  message: { error: 'Juda ko\'p login urinishi, 15 daqiqadan keyin qayta urining' },
  skipSuccessfulRequests: true,
});
app.use('/api/auth/login', authLimiter);

// Path traversal bloklash
app.use((req, res, next) => {
  if (req.url.includes('..') || req.url.includes('%2e%2e')) {
    return res.status(400).json({ error: 'Noto\'g\'ri so\'rov' });
  }
  next();
});

// ========== STATIC FILES ==========

// Uploads papkasini yaratish (agar yo'q bo'lsa)
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Logo fayllarni ochiq qilish
app.use('/uploads', express.static(uploadsDir, {
  maxAge: '7d',
  setHeaders: (res) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  },
}));

// Frontend static files
app.use('/superadmin', express.static(path.join(__dirname, '..', 'client', 'superadmin')));
app.use('/admin', express.static(path.join(__dirname, '..', 'client', 'admin')));
app.use('/shared', express.static(path.join(__dirname, '..', 'client', 'shared')));

// ========== ROUTES ==========

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/superadmin', require('./routes/superadmin'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/directions', require('./routes/directions'));
app.use('/api/daily-report', require('./routes/dailyReport'));
app.use('/api/monthly-report', require('./routes/monthlyReport'));
app.use('/api/archive', require('./routes/archive'));

// Root - redirect
app.get('/', (req, res) => {
  res.redirect('/admin/login.html');
});

// ========== ERROR HANDLING ==========

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Topilmadi' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Xato:', err);

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

// ========== SUPER ADMIN YARATISH ==========
const createSuperAdmin = require('./utils/createSuperAdmin');

// ========== CRON JOBS ==========
const dailyResetJob = require('./services/dailyResetJob');

// ========== SERVER START ==========
app.listen(PORT, async () => {
  console.log('========================================');
  console.log('🚀 CyberCoderCRM server ishga tushdi');
  console.log(`🌐 Port: ${PORT}`);
  console.log(`🔧 Muhit: ${process.env.NODE_ENV || 'development'}`);
  console.log('========================================');

  // SuperAdminni yaratish (agar yo'q bo'lsa)
  await createSuperAdmin();

  // Kunlik reset cron jobni ishga tushirish
  dailyResetJob.start();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal qabul qilindi, server to\'xtatilmoqda...');
  process.exit(0);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});