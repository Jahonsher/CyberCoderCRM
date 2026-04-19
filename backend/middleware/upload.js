const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * Fayl yuklash (Multer konfiguratsiyasi)
 *
 * - Faqat rasm fayllari (PNG, JPG, JPEG, WEBP)
 * - Maksimum 2MB (o'zgaruvchi .env dan)
 * - Fayl nomi: business_TIMESTAMP.ext
 * - Saqlanish joyi: /uploads
 */

// Uploads papkasini tekshirish/yaratish
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Storage sozlamalari
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Kengaytmani olish
    const ext = path.extname(file.originalname).toLowerCase();

    // Unique nom: business_TIMESTAMP_RANDOM.ext
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    const filename = `business_${timestamp}_${random}${ext}`;

    cb(null, filename);
  },
});

// Fayl turini tekshirish
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  const allowedExts = ['.png', '.jpg', '.jpeg', '.webp'];

  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error('Faqat PNG, JPG, JPEG yoki WEBP formatidagi rasm yuklang'),
      false
    );
  }
};

// Multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_UPLOAD_SIZE) || 2 * 1024 * 1024, // 2MB default
    files: 1,
  },
});

/**
 * Yuklangan logoni o'chirish (yangi yuklanganda yoki biznes o'chirilganda)
 */
const deleteLogoFile = (filename) => {
  if (!filename) return;

  try {
    const filepath = path.join(uploadsDir, filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      console.log(`🗑️  Logo o'chirildi: ${filename}`);
    }
  } catch (err) {
    console.error('Logoni o\'chirishda xato:', err.message);
  }
};

module.exports = {
  upload,
  deleteLogoFile,
  uploadsDir,
};