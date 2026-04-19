/**
 * Module Registry
 *
 * Tizimda mavjud bo'lgan barcha modullar (sidebar tab'lari).
 * Har bir biznesga individual ravishda yoqish/o'chirish mumkin.
 *
 * Yangi modul qo'shish uchun:
 * 1. Shu yerga qo'shing
 * 2. Frontend modules.js ga qo'shing (icon + translations)
 * 3. Backend route ga requireModule('moduleKey') qo'shing
 */

const MODULES = {
  // ========== ASOSIY MODULLAR ==========
  employees: {
    key: 'employees',
    name: 'Xodimlar',
    nameRu: 'Сотрудники',
    nameCyr: 'Ходимлар',
    category: 'core',
    default: true, // Yangi bizneslar uchun default yoqilgan
  },

  directions: {
    key: 'directions',
    name: 'Yo\'nalishlar',
    nameRu: 'Направления',
    nameCyr: 'Йўналишлар',
    category: 'core',
    default: true,
  },

  dailyReport: {
    key: 'dailyReport',
    name: 'Kunlik Hisobot',
    nameRu: 'Ежедневный отчёт',
    nameCyr: 'Кунлик Ҳисобот',
    category: 'core',
    default: true,
  },

  monthlyReport: {
    key: 'monthlyReport',
    name: 'Oylik Hisobot',
    nameRu: 'Месячный отчёт',
    nameCyr: 'Ойлик Ҳисобот',
    category: 'core',
    default: true,
  },

  archive: {
    key: 'archive',
    name: 'Arxiv',
    nameRu: 'Архив',
    nameCyr: 'Архив',
    category: 'core',
    default: true,
  },

  // ========== KELAJAK MODULLARI (hozircha o'chirilgan) ==========
  // Kerak bo'lganda default: true qilsa bo'ladi

  // voiceAgent: {
  //   key: 'voiceAgent',
  //   name: 'Voice Agent',
  //   category: 'premium',
  //   default: false,
  // },
  //
  // aiAccountant: {
  //   key: 'aiAccountant',
  //   name: 'AI Accountant',
  //   category: 'premium',
  //   default: false,
  // },
};

/**
 * Barcha modul key'lari
 */
const getAllModuleKeys = () => Object.keys(MODULES);

/**
 * Default yoqilgan modullar (yangi biznes yaratilganda)
 */
const getDefaultModules = () =>
  Object.values(MODULES)
    .filter((m) => m.default)
    .map((m) => m.key);

/**
 * Modul kaliti haqiqiy ekanligini tekshirish
 */
const isValidModule = (key) => !!MODULES[key];

/**
 * Modul nomi (til bo'yicha)
 */
const getModuleName = (key, lang = 'uz-lat') => {
  const mod = MODULES[key];
  if (!mod) return key;

  if (lang === 'ru') return mod.nameRu || mod.name;
  if (lang === 'uz-cyr') return mod.nameCyr || mod.name;
  return mod.name;
};

module.exports = {
  MODULES,
  getAllModuleKeys,
  getDefaultModules,
  isValidModule,
  getModuleName,
};