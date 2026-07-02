/**
 * CyberCoderCRM - Upload Middleware
 * Multer bilan logo va boshqa fayllarni yuklash
 */

const multer = require('multer');

// Storage: xotira (memory) — fayl diskka yozilmaydi, req.file.buffer orqali
// bevosita MongoDB'ga saqlanadi. Shu bois deploy'da yo'qolmaydi.
const storage = multer.memoryStorage();

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
