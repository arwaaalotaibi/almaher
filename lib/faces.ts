/** عدّ الأوجه بدقة الربع: نصيب المقطع من كل صفحة = عدد آياته فيها ÷ عدد آيات الصفحة،
    والمجموع يُقرَّب إلى أقرب ربع وجه. الحفظ والمراجعة والتثبيت كلها بميزان واحد.
    والمطلوب يُبنى بالطريقة نفسها: نمشي آيةً آية على المسار حتى يكتمل المقدار. */

import { MUSHAF_PAGES, pageEnd, pageOf, pageStart, refLabel } from "./mushaf";
import { SURAH_AYAHS } from "./surahs";

export type Pos = { surah: number; ayah: number };
export type PathMode = "asc" | "surahDesc" | "pageDesc";

const lastAyah = (s: number): number => SURAH_AYAHS[s - 1] ?? 1;

/** عدد آيات صفحة معيّنة (قد تضمّ أكثر من سورة) */
const pageAyahCache = new Map<number, number>();
export function ayahsOnPage(p: number): number {
  const c = pageAyahCache.get(p);
  if (c !== undefined) return c;
  const st = pageStart(p);
  const en = pageEnd(p);
  let n = 0;
  let s = st.surah;
  let a = st.ayah;
  while (s <= en.surah) {
    const hi = s === en.surah ? en.ayah : lastAyah(s);
    n += hi - a + 1;
    s += 1;
    a = 1;
  }
  pageAyahCache.set(p, Math.max(1, n));
  return Math.max(1, n);
}

/** نصيب آيات السورة s من a1 إلى a2 بالأوجه (كسور الصفحات مجموعة) */
function segmentFaces(s: number, a1: number, a2: number): number {
  if (a2 < a1) return 0;
  let total = 0;
  const p1 = pageOf(s, a1);
  const p2 = pageOf(s, a2);
  for (let p = p1; p <= p2; p++) {
    const ps = pageStart(p);
    const pe = pageEnd(p);
    const lo = Math.max(a1, ps.surah === s ? ps.ayah : 1);
    const hi = Math.min(a2, pe.surah === s ? pe.ayah : lastAyah(s));
    if (hi >= lo) total += (hi - lo + 1) / ayahsOnPage(p);
  }
  return total;
}

export const roundQuarter = (x: number): number => Math.round(x * 4) / 4;

/** أوجه مقطع بين موضعين (مجموعة الآيات نفسها مهما كان اتجاه القراءة):
    سورة واحدة: من آية إلى آية؛ عدّة سور: بقية الأولى + السور بينهما كاملة + أوّل الأخيرة */
export function rangeFaces(from: Pos, to: Pos, mode: PathMode = "asc"): number {
  let total = 0;
  if (from.surah === to.surah) {
    total = segmentFaces(from.surah, Math.min(from.ayah, to.ayah), Math.max(from.ayah, to.ayah));
  } else if (mode === "surahDesc" && from.surah > to.surah) {
    // نازلاً بالسور: بقية السورة الأولى (الأعلى رقماً) + السور بينهما + أوّل الأخيرة إلى «إلى»
    total += segmentFaces(from.surah, from.ayah, lastAyah(from.surah));
    for (let s = from.surah - 1; s > to.surah; s--) total += segmentFaces(s, 1, lastAyah(s));
    total += segmentFaces(to.surah, 1, to.ayah);
  } else {
    // بترتيب المصحف: من الأدنى إلى الأعلى
    const [lo, hi] = from.surah < to.surah ? [from, to] : [to, from];
    total += segmentFaces(lo.surah, lo.ayah, lastAyah(lo.surah));
    for (let s = lo.surah + 1; s < hi.surah; s++) total += segmentFaces(s, 1, lastAyah(s));
    total += segmentFaces(hi.surah, 1, hi.ayah);
  }
  return roundQuarter(total);
}

/** الخطوة التالية على المسار */
export function stepPos(p: Pos, mode: PathMode): Pos | null {
  if (mode === "surahDesc") {
    if (p.ayah < lastAyah(p.surah)) return { surah: p.surah, ayah: p.ayah + 1 };
    return p.surah > 1 ? { surah: p.surah - 1, ayah: 1 } : null;
  }
  if (mode === "pageDesc") {
    if (p.ayah > 1) return { surah: p.surah, ayah: p.ayah - 1 };
    return p.surah > 1 ? { surah: p.surah - 1, ayah: lastAyah(p.surah - 1) } : null;
  }
  if (p.ayah < lastAyah(p.surah)) return { surah: p.surah, ayah: p.ayah + 1 };
  return p.surah < 114 ? { surah: p.surah + 1, ayah: 1 } : null;
}

/** الموضع الذي يكتمل عنده مقدار k وجه ابتداءً من موضع، على المسار.
    يعيد آخر آية داخل المقدار، والموضع الذي يبدأ منه ما بعده (أو null عند نهاية المصحف) */
export function advanceByFaces(from: Pos, k: number, mode: PathMode): { end: Pos; next: Pos | null; faces: number } {
  const target = Math.max(0, k) - 1e-6;
  let cur: Pos | null = from;
  let acc = 0;
  let end: Pos = from;
  let guard = 0;
  while (cur && guard++ < 7000) {
    acc += 1 / ayahsOnPage(pageOf(cur.surah, cur.ayah));
    end = cur;
    if (acc >= target) break;
    cur = stepPos(cur, mode);
  }
  return { end, next: stepPos(end, mode), faces: roundQuarter(acc) };
}

/** نصّ مقطع الحفظ النازل بالسور: «فصلت ٤٧ ← ٥٤ ثم غافر ١ ← ٨» */
export function descRangeLabel(from: Pos, to: Pos): string {
  const parts: string[] = [];
  for (let s = from.surah; s >= to.surah; s--) {
    const a1 = s === from.surah ? from.ayah : 1;
    const a2 = s === to.surah ? to.ayah : lastAyah(s);
    const x = refLabel(s, a1);
    const y = refLabel(s, a2);
    parts.push(a1 === a2 ? x : `${x} ← ${y}`);
  }
  return parts.join(" ثم ");
}

/** الطرف الأعلى للمراجعة النازلة: «الناس ١» (أي من أوّل السورة) يعني السورة كاملة،
    فالحافة الفعلية آخر آية فيها. حافة داخل السورة تبقى كما هي (استئناف من لقاء سابق) */
export function normalizeTopEdge(p: Pos): Pos {
  return p.ayah === 1 ? { surah: p.surah, ayah: lastAyah(p.surah) } : p;
}
/** نصّ الطرف الأعلى: السورة الكاملة تُكتب من آيتها الأولى «الناس ١» */
export function topEdgeLabel(p: Pos): string {
  return p.ayah >= lastAyah(p.surah) ? refLabel(p.surah, 1) : refLabel(p.surah, p.ayah);
}

/* ================== الصياغة ================== */
const arNum = (n: number) => n.toLocaleString("ar-EG");
const FRAC: Record<string, string> = { "0.25": "ربع", "0.5": "نصف", "0.75": "ثلاثة أرباع" };

/** «وجه»، «وجه ونصف»، «وجهان وربع»، «٣ أوجه وثلاثة أرباع»، «نصف وجه»، «١١ وجهاً ونصف» */
export function facesText(n: number, opts: { one?: string; two?: string; few?: string; many?: string } = {}): string {
  const q = roundQuarter(Math.max(0, n));
  const whole = Math.floor(q);
  const frac = FRAC[String(q - whole)] ?? "";
  const one = opts.one ?? "وجه";
  const two = opts.two ?? "وجهان";
  const few = opts.few ?? "أوجه";
  const many = opts.many ?? "وجهاً";
  if (whole === 0) return frac ? `${frac} ${one}` : `٠ ${one}`;
  const base = whole === 1 ? one : whole === 2 ? two : whole <= 10 ? `${arNum(whole)} ${few}` : `${arNum(whole)} ${many}`;
  return frac ? `${base} و${frac}` : base;
}

export { MUSHAF_PAGES };
