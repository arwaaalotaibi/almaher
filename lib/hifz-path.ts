/** مسار الحفظ النازل «بالسور»: الطالبة تحفظ كل سورة من أوّلها إلى آخرها،
    وإذا ختمتها انتقلت إلى السورة التي قبلها في المصحف (فصلت ثم غافر ثم الزمر …).
    الوحدة هي الوجه (الصفحة)، والمقطع لا يتجاوز نهاية السورة إلا بقفزة إلى
    أوّل السورة السابقة، فيُكتب «فصلت ٤٧ ← ٥٤ ثم غافر ١ ← ٨».

    المراجعة النازلة تبقى «بالصفحات» (آخر ١١ صفحة مثلاً) لأن مضمونها واحد. */

import { MUSHAF_PAGES, pageEnd, pageOf, refLabel } from "./mushaf";
import { SURAH_AYAHS } from "./surahs";

export type Pos = { surah: number; ayah: number };
export type Seg = { from: Pos; to: Pos; fromPage: number; toPage: number; pages: number };

export const surahLastAyah = (s: number): number => SURAH_AYAHS[s - 1] ?? 1;
export const surahFirstPage = (s: number): number => pageOf(s, 1);
export const surahLastPage = (s: number): number => pageOf(s, surahLastAyah(s));

/** بداية الحفظ النازل كما أدخلتها الإدارة: «آخر آية في السورة» تعني السورة لم تبدأ بعد
    (بقايا الاصطلاح القديم)، فنبدأ من آيتها الأولى. */
export function normalizeDescStart(p: Pos): Pos {
  if (p.surah < 1) return p;
  return p.ayah >= surahLastAyah(p.surah) && p.ayah > 1 ? { surah: p.surah, ayah: 1 } : p;
}

/** الآية التالية على المسار النازل بالسور: داخل السورة للأمام، وعند آخرها أوّل السورة السابقة */
export function nextPosSurahDesc(p: Pos): Pos | null {
  if (p.ayah < surahLastAyah(p.surah)) return { surah: p.surah, ayah: p.ayah + 1 };
  return p.surah > 1 ? { surah: p.surah - 1, ayah: 1 } : null;
}

/** مقاطع بمقدار k وجه ابتداءً من موضع، على المسار النازل بالسور */
export function descSegments(
  from: Pos,
  k: number
): { segs: Seg[]; pages: number; next: Pos | null; label: string } {
  const segs: Seg[] = [];
  let remaining = Math.max(0, Math.round(k));
  let S = from.surah;
  let a = from.ayah;
  let next: Pos | null = from;
  while (remaining > 0 && S >= 1) {
    const p0 = pageOf(S, a);
    const pLast = surahLastPage(S);
    const take = Math.min(remaining, pLast - p0 + 1);
    const pEnd = p0 + take - 1;
    const endsSurah = pEnd >= pLast;
    const to: Pos = endsSurah ? { surah: S, ayah: surahLastAyah(S) } : pageEnd(pEnd);
    segs.push({ from: { surah: S, ayah: a }, to, fromPage: p0, toPage: pEnd, pages: take });
    remaining -= take;
    if (endsSurah) {
      S -= 1;
      a = 1;
      next = S >= 1 ? { surah: S, ayah: 1 } : null;
    } else {
      next = { surah: to.surah, ayah: Math.min(to.ayah + 1, surahLastAyah(to.surah)) };
      // إن كانت آخر آية في الصفحة هي آخر آية في السورة فقد عولجت أعلاه
    }
  }
  const label = segs
    .map((g) => {
      const x = refLabel(g.from.surah, g.from.ayah);
      const y = refLabel(g.to.surah, g.to.ayah);
      return x === y ? x : `${x} ← ${y}`;
    })
    .join(" ثم ");
  return { segs, pages: segs.reduce((n, g) => n + g.pages, 0), next, label };
}

/** ترتيب موضع على المسار النازل بالسور: رقم الصفحة الترتيبي (١ = أوّل صفحة من البداية) */
export function descPathIndex(start: Pos, pos: Pos): number {
  let idx = 0;
  let S = start.surah;
  let a = start.ayah;
  // سور أعلى من سورة الموضع قُطعت كاملة
  while (S > pos.surah && S >= 1) {
    idx += surahLastPage(S) - pageOf(S, a) + 1;
    S -= 1;
    a = 1;
  }
  if (S < 1) return idx;
  if (S === pos.surah) idx += pageOf(pos.surah, pos.ayah) - pageOf(S, a) + 1;
  return Math.max(0, idx);
}

/** الموضع بعد قطع n وجه من البداية على المسار النازل بالسور (آخر آية في آخر وجه) */
export function descPosAfter(start: Pos, n: number): { pos: Pos; page: number } {
  const r = descSegments(start, n);
  const last = r.segs[r.segs.length - 1];
  return last
    ? { pos: last.to, page: last.toPage }
    : { pos: start, page: Math.min(MUSHAF_PAGES, pageOf(start.surah, start.ayah)) };
}
