/**
 * CyberCoderCRM - Modules Config (v2)
 *
 * Yangi mantiq:
 *  - directionsPiecework, directionsDaily va eski 'directions' parent guruh olib tashlandi.
 *  - Yo'nalishlar endi yagona modul ('directions').
 *  - Yangi 'salary' (Maosh to'lash) moduli qo'shildi.
 */

const MODULES = {
  employees: {
    key: 'employees',
    name: 'Xodimlar',
    description: 'Xodimlarni boshqarish',
    default: true,
    order: 1,
  },
  directions: {
    key: 'directions',
    name: "Yo'nalishlar",
    description: "Bo'limlar va yo'nalishlar (ON/OFF)",
    default: true,
    order: 2,
  },
  dailyReport: {
    key: 'dailyReport',
    name: 'Kunlik Hisobot',
    description: 'Kunlik biriktirish va daromad',
    default: true,
    order: 3,
  },
  monthlyReport: {
    key: 'monthlyReport',
    name: 'Oylik Hisobot',
    description: 'Davr bo\'yicha statistika',
    default: true,
    order: 4,
  },
  salary: {
    key: 'salary',
    name: "Maosh to'lash",
    description: "Xodim maoshi va sanagacha to'lov",
    default: true,
    order: 5,
  },
  archive: {
    key: 'archive',
    name: 'Arxiv',
    description: 'Oylik to\'lovlar tarixi',
    default: false,
    order: 6,
  },
};

function getAllModules() {
  return Object.values(MODULES).sort((a, b) => a.order - b.order);
}

function moduleExists(key) {
  return !!MODULES[key];
}

module.exports = {
  getAllModules,
  moduleExists,
};
