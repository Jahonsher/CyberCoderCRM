/**
 * CyberCoderCRM - Excel Archive
 *
 * Yaratilgan Excel buffer'ni diskka (uploads/archives/...) yozadi va
 * ArchiveFile yozuvini yaratadi. DB yozish xatosida fayl o'chiriladi
 * (atomic-ish).
 */

const fs = require('fs');
const path = require('path');
const ArchiveFile = require('../models/ArchiveFile');

const ARCHIVES_ROOT = path.join(process.cwd(), 'uploads', 'archives');

// displayName dan xavfsiz slug yasaymiz. Alfanumerik (lotin/kirill harflari ham
// alfanumerik klassiga kiradi) qoldiriladi, qolganlar "_" ga aylantiriladi.
function slugify(input) {
  if (!input) return 'file';
  const s = String(input)
    .replace(/\s+/g, '_')
    // Faqat lotin a-z A-Z, raqamlar, dash, underscore qolsin.
    // Kirill harflarini ham qoldiramiz (chiroyli displayName kerak bo'lsa)
    .replace(/[^A-Za-z0-9_\-Ѐ-ӿԀ-ԯ]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return s.slice(0, 80) || 'file';
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * @param {Object} params
 * @param {Buffer} params.buffer
 * @param {String|ObjectId} params.businessId
 * @param {'employees'|'dailyReport'|'monthlyReport'|'salary'} params.category
 * @param {String} [params.subType]
 * @param {'uz-lat'|'uz-cyr'|'ru'} params.language
 * @param {String} params.displayName
 * @param {String|null} [params.dateFrom]
 * @param {String|null} [params.dateTo]
 * @param {Number} [params.rowCount]
 * @param {String} [params.generatedBy]
 * @param {Object} [params.meta]
 * @returns {Promise<ArchiveFile>}
 */
async function saveToArchive({
  buffer,
  businessId,
  category,
  subType = '',
  language,
  displayName,
  dateFrom = null,
  dateTo = null,
  rowCount = 0,
  generatedBy = '',
  meta = {},
}) {
  if (!buffer) throw new Error('buffer kerak');
  if (!businessId) throw new Error('businessId kerak');
  if (!category) throw new Error('category kerak');
  if (!language) throw new Error('language kerak');

  const bizDirName = String(businessId);
  const absDir = path.join(ARCHIVES_ROOT, bizDirName, category);
  ensureDir(absDir);

  const ts = Date.now();
  const slug = slugify(displayName || category);
  const fileName = `${ts}_${slug}.xlsx`;
  const absPath = path.join(absDir, fileName);
  const relPath = path.posix.join('archives', bizDirName, category, fileName);

  // Diskka yozish
  fs.writeFileSync(absPath, buffer);
  const stat = fs.statSync(absPath);

  let doc;
  try {
    doc = await ArchiveFile.create({
      businessId,
      category,
      subType,
      language,
      fileName,
      displayName,
      filePath: relPath,
      fileSize: stat.size,
      rowCount,
      dateFrom,
      dateTo,
      generatedBy,
      generatedAt: new Date(),
      meta,
    });
  } catch (err) {
    // DB yozish xato — diskdagi faylni tozalaymiz
    try { fs.unlinkSync(absPath); } catch (_) {}
    console.error('saveToArchive DB xato:', err);
    throw err;
  }

  return doc;
}

function getAbsolutePath(filePathRel) {
  // filePathRel: "archives/{bizId}/{category}/{file}.xlsx"
  return path.join(process.cwd(), 'uploads', filePathRel);
}

function removeFromDisk(filePathRel) {
  try {
    const abs = getAbsolutePath(filePathRel);
    if (fs.existsSync(abs)) {
      fs.unlinkSync(abs);
      return true;
    }
  } catch (err) {
    console.error('removeFromDisk xato:', err);
  }
  return false;
}

module.exports = {
  saveToArchive,
  getAbsolutePath,
  removeFromDisk,
  slugify,
  ARCHIVES_ROOT,
};
