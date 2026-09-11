/** طباعة بطاقات رموز الدخول لتوزيعها يدوياً — الحمولة عبر sessionStorage إلى /print-codes
    (نفس أسلوب جدول الحفظ: بلا window.open حتى تعمل داخل التطبيق المثبّت) */

export interface PrintCodesPayload {
  halaqaLabel: string;
  rows: { name: string; code: string }[];
}

export const PRINT_CODES_KEY = "almaher-print-codes";

export function printCodeCards(halaqaLabel: string, rows: { name: string; code: string }[]) {
  const payload: PrintCodesPayload = {
    halaqaLabel,
    rows: rows.filter((r) => r.code),
  };
  try {
    window.sessionStorage.setItem(PRINT_CODES_KEY, JSON.stringify(payload));
  } catch {
    /* تخزين غير متاح — الصفحة ستعرض رسالة */
  }
  window.location.assign("/print-codes");
}
