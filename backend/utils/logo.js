/**
 * CyberCoderCRM - Logo URL helper
 *
 * Biznes logosi endi DB'da (logoData/logoType) saqlanadi va `/logo/:id`
 * public endpoint orqali beriladi. Eski yozuvlarda logo diskdagi fayl nomi
 * bo'lishi mumkin (legacy) — bunda `/uploads/<fayl>` ga fallback qilinadi.
 *
 * `?v=<updatedAt>` — logo yangilanganda brauzer keshini yangilash uchun.
 */
function logoUrl(biz) {
  if (!biz) return null;
  if (biz.logoType) {
    const v = biz.updatedAt ? new Date(biz.updatedAt).getTime() : Date.now();
    return `/logo/${biz._id}?v=${v}`;
  }
  if (biz.logo) return `/uploads/${biz.logo}`; // legacy disk fayli
  return null;
}

module.exports = { logoUrl };
