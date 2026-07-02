/**
 * CyberCoderCRM - Kod bo'yicha tabiiy (natural) tartiblash
 *
 * Xodim kodlari "harf + raqam" ko'rinishida (masalan A1, A2, A10, B3).
 * localeCompare({ numeric: true }) harflarni alifbo, raqamlarni son
 * qiymati bo'yicha to'g'ri tartiblaydi: A1 < A2 < A10 < B1.
 */

function codeCompare(ca, cb) {
  return String(ca || '')
    .trim()
    .localeCompare(String(cb || '').trim(), 'en', {
      numeric: true,
      sensitivity: 'base',
    });
}

// Obyektlar massivini `.code` maydoni bo'yicha joyida tartiblaydi
function sortByCode(arr, getCode = (x) => (x && x.code) || '') {
  return arr.sort((a, b) => codeCompare(getCode(a), getCode(b)));
}

module.exports = { codeCompare, sortByCode };
