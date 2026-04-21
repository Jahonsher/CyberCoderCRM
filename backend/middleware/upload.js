/**
 * CyberCoderCRM - Upload Middleware
 * Multer bilan logo va boshqa fayllarni yuklash
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Uploads papka yaratish (agar yo'q bo'lsa)
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Storage konfiguratsiya
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Noyob fayl nom: timestamp + random + ext
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

// Fayl filtri
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Faqat rasm fayllar (PNG, JPG, WEBP, GIF)'));
  }
};

// Max size
const MAX_SIZE = Number(process.env.MAX_UPLOAD_SIZE) || 2 * 1024 * 1024; // 2MB default

// Multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_SIZE,
  },
});

// MUHIM: upload instance ni to'g'ri eksport qilish
module.exports = upload;