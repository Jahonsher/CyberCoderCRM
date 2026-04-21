/**
 * CyberCoderCRM - Module Registry
 * Mavjud modullar ro'yxati
 */

const MODULES = {
  employees: {
    key: 'employees',
    name: 'Xodimlar',
    nameRu: 'Сотрудники',
    icon: 'users',
    default: true,
  },
  directions: {
    key: 'directions',
    name: "Yo'nalishlar",
    nameRu: 'Направления',
    icon: 'compass',
    default: true,
  },
  dailyReport: {
    key: 'dailyReport',
    name: 'Kunlik Hisobot',
    nameRu: 'Ежедневный отчёт',
    icon: 'calendar',
    default: true,
  },
  monthlyReport: {
    key: 'monthlyReport',
    name: 'Oylik Hisobot',
    nameRu: 'Месячный отчёт',
    icon: 'trending-up',
    default: true,
  },
  archive: {
    key: 'archive',
    name: 'Arxiv',
    nameRu: 'Архив',
    icon: 'archive',
    default: false,
  },
};

function getAllModules() {
  return Object.values(MODULES);
}

function getModule(key) {
  return MODULES[key] || null;
}

function getDefaultModules() {
  return Object.values(MODULES)
    .filter((m) => m.default)
    .map((m) => m.key);
}

function moduleExists(key) {
  return !!MODULES[key];
}

module.exports = {
  MODULES,
  getAllModules,
  getModule,
  getDefaultModules,
  moduleExists,
};