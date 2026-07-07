import { SURAHS, SURAH_AYAHS } from "./surahs";
import { PAGE_STARTS } from "./mushaf-data";

export const MUSHAF_PAGES = PAGE_STARTS.length; // 604

/** رقم السورة (1..114) من اسمها، أو 0 */
export function surahNumber(name: string): number {
  const i = SURAHS.indexOf(name);
  return i >= 0 ? i + 1 : 0;
}

export function surahName(num: number): string {
  return num >= 1 && num <= 114 ? SURAHS[num - 1] : "";
}

/** مقارنة موضعين (سورة,آية) */
function cmp(a: [number, number], b: [number, number]): number {
  return a[0] - b[0] || a[1] - b[1];
}

/** رقم الصفحة (الوجه) التي يقع فيها (سورة, آية) — 1..604 */
export function pageOf(surah: number, ayah: number): number {
  if (surah < 1) return 1;
  const target: [number, number] = [surah, ayah];
  // آخر صفحة تبدأ عند/قبل الموضع المطلوب
  let p = 1;
  for (let i = 0; i < PAGE_STARTS.length; i++) {
    if (cmp(PAGE_STARTS[i], target) <= 0) p = i + 1;
    else break;
  }
  return p;
}

/** موضع بداية صفحة معيّنة */
export function pageStart(page: number): { surah: number; ayah: number } {
  const r = PAGE_STARTS[Math.min(Math.max(1, page), MUSHAF_PAGES) - 1];
  return { surah: r[0], ayah: r[1] };
}

/** آخر موضع في صفحة معيّنة (= قبل بداية الصفحة التالية) */
export function pageEnd(page: number): { surah: number; ayah: number } {
  if (page >= MUSHAF_PAGES) return { surah: 114, ayah: SURAH_AYAHS[113] };
  const next = PAGE_STARTS[page]; // بداية الصفحة التالية
  if (next[1] > 1) return { surah: next[0], ayah: next[1] - 1 };
  // بداية سورة جديدة → آخر آية من السورة السابقة
  const prevSurah = next[0] - 1;
  return { surah: prevSurah, ayah: SURAH_AYAHS[prevSurah - 1] };
}

const arNum = (n: number) => n.toLocaleString("ar-EG");

/** وصف موضع «سورة كذا آية كذا» */
export function refLabel(surah: number, ayah: number): string {
  return `${surahName(surah)} ${arNum(ayah)}`;
}

/** وصف مقطع الحفظ من صفحة إلى صفحة: «الملك ١ – القلم ١٥» */
export function hifzRangeLabel(fromPage: number, toPage: number): string {
  const a = pageStart(fromPage);
  const b = pageEnd(toPage);
  const start = refLabel(a.surah, a.ayah);
  const end = refLabel(b.surah, b.ayah);
  return start === end ? start : `${start} ← ${end}`;
}
