/**
 * CyberCoderCRM - Modules Config
 * YANGI: directionsPiecework va directionsDaily 2 ta alohida modul
 * Eski 'directions' moduli backward compat uchun saqlangan
 */

const MODULES = {
  employees: {
    key: 'employees',
    name: 'Xodimlar',
    description: 'Xodimlarni boshqarish',
    default: true,
    order: 1,
  },
  directionsPiecework: {
    key: 'directionsPiecework',
    name: 'Dona ish',
    description: "Dona (shtuk) yo'nalishlar — narx × mahsulot",
    default: true,
    order: 2,
    parent: 'directions',
  },
  directionsDaily: {
    key: 'directionsDaily',
    name: 'Kunlik ish',
    description: "Kunlik yo'nalishlar — smenaga belgilangan summa",
    default: true,
    order: 3,
    parent: 'directions',
  },
  dailyReport: {
    key: 'dailyReport',
    name: 'Kunlik Hisobot',
    description: 'Kunlik biriktirish va hisobot',
    default: true,
    order: 4,
  },
  monthlyReport: {
    key: 'monthlyReport',
    name: 'Oylik Hisobot',
    description: 'Oylik daromad va to\'lov',
    default: true,
    order: 5,
  },
  archive: {
    key: 'archive',
    name: 'Arxiv',
    description: 'To\'langan oylik arxivi',
    default: false,
    order: 6,
  },
  // Backward compat - eski yagona direction moduli
  directions: {
    key: 'directions',
    name: "Yo'nalishlar (eski)",
    description: 'Eski yagona direction moduli',
    default: false,
    order: 99,
    hidden: true, // Yangi bizneslar uchun ko'rinmasin
  },
};

function getAllModules() {
  return Object.values(MODULES)
    .filter(m => !m.hidden)
    .sort((a, b) => a.order - b.order);
}

function moduleExists(key) {
  return !!MODULES[key];
}

function getModuleByKey(key) {
  return MODULES[key] || null;
}

module.exports = {
  MODULES,
  getAllModules,
  moduleExists,
  getModuleByKey,
};