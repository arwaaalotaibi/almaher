import {
  MUSHAF_PAGES,
  pageEnd,
  pageOf,
  pageStart,
  refLabel,
  surahNumber,
} from "./mushaf";
import { SURAH_AYAHS } from "./surahs";
import {
  descPathIndex,
  descPosAfter,
  descSegments,
  nextPosSurahDesc,
  normalizeDescStart,
  surahLastAyah,
} from "./hifz-path";
import {
  buildSchedule,
  currentSessionIndex,
  isDesc,
  isMurDesc,
  recitePartLabel,
  type CoursePlan,
  type Halaqa,
  type RecitationLog,
  type RecitePart,
  type ScheduleRow,
  type Student,
} from "./store";

/* ================== الاتجاه ==================
   الحفظ الصاعد (الافتراضي) يمشي من البقرة نحو الناس: «حافة التقدّم» هي
   أبعد موضع «إلى» سُمّع، والمطلوب القادم يبدأ من الآية التي تليه.
   الحفظ النازل (من الناس) يمشي صفحةً صفحة نحو البقرة، وكل صفحة تُقرأ
   بترتيب المصحف: الحافة هي أدنى موضع «من» سُمّع، والمطلوب القادم ينتهي
   عند الآية التي تسبقه ويمتدّ نزولاً بمقدار أوجه الخطة. */

type Pos = { surah: number; ayah: number };
export type PosRange = { from: Pos; to: Pos };

/** اتجاه المسار: صاعد · نازل بالسور (الحفظ: كل سورة من أوّلها ثم التي قبلها) ·
    نازل بالصفحات (المراجعة: آخر الصفحات ثم ما قبلها) */
export type PathMode = "asc" | "surahDesc" | "pageDesc";
export const hifzMode = (plan?: Pick<CoursePlan, "direction"> | null): PathMode =>
  isDesc(plan) ? "surahDesc" : "asc";
export const murMode = (
  plan?: Pick<CoursePlan, "direction" | "murDirection"> | null
): PathMode => (isMurDesc(plan) ? "pageDesc" : "asc");
const modeOf = (desc: boolean, kind: "hifz" | "muraja"): PathMode =>
  desc ? (kind === "muraja" ? "pageDesc" : "surahDesc") : "asc";

/** الآية التي تلي موضعاً معيّناً (تنتقل للسورة التالية عند نهاية السورة) */
function ayahAfter(p: Pos): Pos {
  const count = SURAH_AYAHS[p.surah - 1] ?? 1;
  if (p.ayah < count) return { surah: p.surah, ayah: p.ayah + 1 };
  if (p.surah < 114) return { surah: p.surah + 1, ayah: 1 };
  return p;
}

/** الآية التي تسبق موضعاً معيّناً (تنتقل لآخر السورة السابقة عند أوّلها) */
function ayahBefore(p: Pos): Pos {
  if (p.ayah > 1) return { surah: p.surah, ayah: p.ayah - 1 };
  if (p.surah > 1) return { surah: p.surah - 1, ayah: SURAH_AYAHS[p.surah - 2] };
  return p;
}

/** الموضع الذي يلي/يسبق حافةً حسب الاتجاه */
function stepPos(p: Pos, mode: PathMode): Pos {
  if (mode === "surahDesc") return nextPosSurahDesc(p) ?? p;
  return mode === "pageDesc" ? ayahBefore(p) : ayahAfter(p);
}

function cmpPos(a: Pos, b: Pos): number {
  return a.surah - b.surah || a.ayah - b.ayah;
}

/** حافة التقدّم عبر السجلات: صاعداً أبعد «إلى»، ونازلاً أدنى «من» */
function furthestEnd(
  logs: { part: RecitePart }[],
  mode: PathMode = "asc"
): Pos | null {
  let best: Pos | null = null;
  for (const { part } of logs) {
    if (part.status !== "done") continue;
    let pos: Pos;
    if (mode === "pageDesc") {
      if (!part.fromSurah) continue;
      pos = { surah: surahNumber(part.fromSurah), ayah: part.fromAyah ?? 1 };
    } else {
      if (!part.toSurah && !part.fromSurah) continue;
      pos = {
        surah: surahNumber(part.toSurah || part.fromSurah!),
        ayah: part.toAyah ?? part.fromAyah ?? 1,
      };
    }
    let better: boolean;
    if (mode === "pageDesc") better = cmpPos(pos, best ?? pos) < 0;
    else if (mode === "surahDesc")
      // نازل بالسور: السورة الأدنى أبعد، وداخل السورة نفسها الآية الأعلى
      better = !best || pos.surah < best.surah || (pos.surah === best.surah && pos.ayah > best.ayah);
    else better = cmpPos(pos, best ?? pos) > 0;
    if (!best || better) best = pos;
  }
  return best;
}

/** نص المطلوب القادم بمقدار perH أوجه من الحافة — صاعداً من (الآية
    التالية) إلى نهاية آخر وجه، ونازلاً من أول أدنى وجه إلى (الآية السابقة).
    النص يُقرأ دائماً بترتيب المصحف. */
function nextLabel(
  from: Pos | null,
  perH: number,
  mode: PathMode = "asc"
): {
  label: string;
  fromPage: number;
  toPage: number;
  range: PosRange | null;
  next?: Pos | null; // (نازل بالسور) موضع بداية المقطع التالي
} {
  if (!from || perH <= 0) return { label: "", fromPage: 0, toPage: 0, range: null };
  if (mode === "surahDesc") {
    const r = descSegments(from, perH);
    const last = r.segs[r.segs.length - 1];
    if (!last) return { label: "", fromPage: 0, toPage: 0, range: null, next: null };
    return {
      label: r.label,
      fromPage: r.segs[0].fromPage,
      toPage: last.toPage,
      range: { from, to: last.to },
      next: r.next,
    };
  }
  if (mode === "pageDesc") {
    const toPage = pageOf(from.surah, from.ayah);
    const fromPage = Math.max(1, toPage - perH + 1);
    const start = pageStart(fromPage);
    // المراجعة النازلة تُكتب من حيث تبدأ الطالبة فعلاً: «الناس ١ ← الملك ٣٠»
    const a = refLabel(from.surah, from.ayah);
    const b = refLabel(start.surah, start.ayah);
    return {
      label: a === b ? a : `${a} ← ${b}`,
      fromPage,
      toPage,
      range: { from: start, to: from },
    };
  }
  const fromPage = pageOf(from.surah, from.ayah);
  const toPage = Math.min(MUSHAF_PAGES, fromPage + perH - 1);
  const end = pageEnd(toPage);
  const a = refLabel(from.surah, from.ayah);
  const b = refLabel(end.surah, end.ayah);
  return {
    label: a === b ? a : `${a} ← ${b}`,
    fromPage,
    toPage,
    range: { from, to: end },
  };
}

/** مقطع بمقدار k وجه ابتداءً من موضع على مسار معيّن — للتسجيل السريع (زيادة/نقصان) */
export function rangeForFaces(from: Pos | null, k: number, mode: PathMode): PosRange | null {
  return nextLabel(from, k, mode).range;
}

/** الحافة التي يبدأ منها المقطع الذي يلي مقطعاً محسوباً (للإسقاط) */
function edgeAfter(
  nl: { fromPage: number; toPage: number; next?: Pos | null },
  mode: PathMode
): Pos | null {
  if (mode === "surahDesc") return nl.next ?? null;
  if (mode === "pageDesc") return nl.fromPage > 1 ? ayahBefore(pageStart(nl.fromPage)) : null;
  return nl.toPage > 0 && nl.toPage < MUSHAF_PAGES
    ? ayahAfter(pageEnd(nl.toPage))
    : null;
}

/* ================== خريطة الأجزاء ================== */
/** صفحة بداية كل جزء في مصحف المدينة (٦٠٤ صفحة) */
export const JUZ_STARTS = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322,
  342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
];

export function juzOfPage(page: number): number {
  let j = 1;
  for (let i = 0; i < 30; i++) {
    if (page >= JUZ_STARTS[i]) j = i + 1;
    else break;
  }
  return j;
}

export function juzStartPage(juz: number): number {
  return JUZ_STARTS[Math.min(30, Math.max(1, juz)) - 1];
}

export function juzEndPage(juz: number): number {
  return juz >= 30 ? MUSHAF_PAGES : JUZ_STARTS[juz] - 1;
}

export function juzLabel(juz: number): string {
  if (juz === 30) return "جزء عمّ";
  if (juz === 29) return "جزء تبارك";
  return `الجزء ${juz.toLocaleString("ar-EG")}`;
}

/** صفحة نهاية المقطع (موضع «إلى») */
function partEndPage(part?: RecitePart): number {
  if (!part || part.status !== "done" || !part.fromSurah) return 0;
  const s = part.toSurah || part.fromSurah;
  const a = part.toAyah ?? part.fromAyah ?? 1;
  return pageOf(surahNumber(s), a);
}

/** الصفحة المكتملة عند حافةٍ ما.
    صاعداً: صفحتُها إن كانت آخرَ آيةٍ فيها، وإلا السابقة.
    نازلاً: صفحتُها إن كانت أوّلَ آيةٍ فيها، وإلا التالية (أدنى صفحة مكتملة). */
function completedPageOf(pos: Pos, mode: PathMode = "asc"): number {
  const p = pageOf(pos.surah, pos.ayah);
  if (mode === "pageDesc") {
    const ps = pageStart(p);
    return pos.surah === ps.surah && pos.ayah <= ps.ayah ? p : p + 1;
  }
  const pe = pageEnd(p);
  // نازلاً بالسور: بلوغ آخر آية في السورة يُتمّ الوجه ولو بقي من الصفحة سورة أخرى
  const surahEnd = mode === "surahDesc" && pos.ayah >= surahLastAyah(pos.surah);
  return surahEnd || (pos.surah === pe.surah && pos.ayah >= pe.ayah) ? p : p - 1;
}

/** عدد الأوجه المكتملة في المقطع.
    الوجه لا يُحسب إلا إذا سُمّع حتى آخر آية فيه — الوقوف في منتصف
    صفحة لا يجعلها وجهاً (آية من أول ص٦٢ ≠ وجه كامل).
    البداية من منتصف صفحة تُحسب صفحتها، لأن المطلوب نفسه يُبنى هكذا.
    نازلاً تنعكس القاعدة: الوجه يكتمل ببلوغ أوّل آيةٍ فيه. */
function facesInfo(
  part?: RecitePart,
  mode: PathMode = "asc"
): { done: number; partial: boolean } {
  if (!part || part.status !== "done" || !part.fromSurah)
    return { done: 0, partial: false };
  const fromSurah = surahNumber(part.fromSurah);
  const fromAyah = part.fromAyah ?? 1;
  const a = pageOf(fromSurah, fromAyah);
  const endPage = partEndPage(part);
  // نازلاً بالسور: مقطع يختم سورة (أو سوراً) ويدخل التي قبلها («الحجرات ١٥ ← الفتح ٩»،
  // «الناس ١ ← الأعلى ١٩») = عدد الأوجه على المسار نفسه الذي يُبنى به «المطلوب»
  // (كل سورة بصفحاتها، ولو تشاركت السور القصيرة صفحة واحدة)، ناقص وجهاً إن وقفت
  // النهاية في منتصف وجه
  if (mode === "surahDesc" && part.toSurah && surahNumber(part.toSurah) < fromSurah) {
    const to = { surah: surahNumber(part.toSurah), ayah: part.toAyah ?? 1 };
    const idx = descPathIndex({ surah: fromSurah, ayah: fromAyah }, to);
    const pe = pageEnd(pageOf(to.surah, to.ayah));
    const reachedEnd =
      to.ayah >= surahLastAyah(to.surah) || (to.surah === pe.surah && to.ayah >= pe.ayah);
    return { done: Math.max(0, reachedEnd ? idx : idx - 1), partial: !reachedEnd };
  }
  if (mode === "pageDesc") {
    // الحافة النازلة هي «من»: هل بلغت أوّل آية في صفحتها؟
    const ps = pageStart(a);
    const reachedStart =
      fromSurah < ps.surah || (fromSurah === ps.surah && fromAyah <= ps.ayah);
    const completed = reachedStart ? a : a + 1;
    return { done: Math.max(0, endPage - completed + 1), partial: !reachedStart };
  }
  const pe = pageEnd(endPage);
  const toSurah = surahNumber(part.toSurah || part.fromSurah);
  const toAyah = part.toAyah ?? part.fromAyah ?? 1;
  const reachedEnd =
    toSurah > pe.surah ||
    (toSurah === pe.surah && toAyah >= pe.ayah) ||
    // نازلاً بالسور: ختم السورة يُتمّ وجهها الأخير
    (mode === "surahDesc" && toAyah >= surahLastAyah(toSurah));
  const completed = reachedEnd ? endPage : endPage - 1;
  return {
    done: Math.max(0, completed - a + 1),
    // بدأت وجهاً آخر ولم تبلغي آخر آيةٍ فيه
    partial: !reachedEnd,
  };
}

function faces(part?: RecitePart, mode: PathMode = "asc"): number {
  return facesInfo(part, mode).done;
}

/** أوجه مكتملة لقسم تسميع — للاستخدام خارج المحرّك (نقاط المنافسة).
    desc + kind يحدّدان المسار: الحفظ النازل بالسور، والمراجعة النازلة بالصفحات */
export function partFaces(part?: RecitePart, desc = false, kind: "hifz" | "muraja" = "hifz"): number {
  return facesInfo(part, modeOf(desc, kind)).done;
}

/** أوجه السجلّ الثلاثة رقماً — تُحفظ مع السجلّ عند التسجيل ليُحسب السباق
    منها دون كشف المقاطع لغيرها */
export function logFaces(
  log: Pick<RecitationLog, "tasmi" | "tathbit" | "muraja">,
  plan?: Pick<CoursePlan, "direction" | "murDirection"> | null
): NonNullable<RecitationLog["faces"]> {
  const d = isDesc(plan);
  return {
    tasmi: partFaces(log.tasmi, d, "hifz"),
    tathbit: partFaces(log.tathbit, d, "hifz"),
    muraja: partFaces(log.muraja, isMurDesc(plan), "muraja"),
  };
}

/* ================== مقارنة المُنجَز بالمطلوب ================== */

/** حكم قسم واحد في لقاء: ما سُمّع فعلاً مقابل المطلوب (بالأوجه) */
export interface PartVerdict {
  done: number; // أوجه مكتملة سُمّعت فعلاً
  required: number; // أوجه المطلوب في اللقاء
  diff: number; // + زيادة عن المطلوب / − نقص
  partialFace: boolean; // بدأت وجهاً إضافياً ولم تكمليه (سُمّع أوله)
  status: "exceeded" | "met" | "partial";
}

export function partVerdict(
  part: RecitePart | undefined,
  required: number,
  desc = false,
  kind: "hifz" | "muraja" = "hifz"
): PartVerdict | null {
  // لا حكم إلا على قسم سُمّع فعلاً (وإن لم يكتمل منه وجه واحد)
  if (!part || part.status !== "done" || !part.fromSurah) return null;
  const { done, partial } = facesInfo(part, modeOf(desc, kind));
  const req = Math.max(0, Math.round(required || 0));
  const diff = done - req;
  return {
    done,
    required: req,
    diff,
    partialFace: partial,
    status: diff > 0 ? "exceeded" : diff === 0 ? "met" : "partial",
  };
}

/** حكم اللقاء كاملاً عبر الأقسام الثلاثة: الحفظ والتثبيت والمراجعة */
export function sessionVerdict(
  log: RecitationLog,
  row: Pick<ScheduleRow, "hifz" | "tathbit" | "murajaah">,
  desc = false,
  murDesc = desc
): PartVerdict["status"] | null {
  const pairs: [RecitePart | undefined, number, boolean, "hifz" | "muraja"][] = [
    [log.tasmi, row.hifz, desc, "hifz"],
    [log.tathbit, row.tathbit, desc, "hifz"],
    [log.muraja, row.murajaah, murDesc, "muraja"],
  ];
  let any = false;
  let exceeded = false;
  let short = false;
  for (const [part, req, d, kind] of pairs) {
    const v = partVerdict(part, req, d, kind);
    if (v) any = true;
    if (v?.status === "exceeded") exceeded = true;
    // قسم مطلوب لم يُسمَّع، أو سُمّع أقل من مطلوبه ⇒ لم يكتمل
    if ((req > 0 && !v) || v?.status === "partial") short = true;
  }
  if (!any) return null;
  if (short) return "partial";
  return exceeded ? "exceeded" : "met";
}

/* ================== حساب التقدّم ================== */

export interface Progress {
  hasData: boolean;
  desc: boolean; // الحفظ نازل (من الناس)
  murDesc: boolean; // المراجعة نازلة
  currentPage: number; // صفحة حافة الحفظ (أبعد صفحة بلغتها في اتجاهها)
  pagesReached: number; // صفحات قُطعت من بداية المصحف في اتجاهها (١..٦٠٤)
  juz: number;
  juzPct: number; // نسبة إتمام الجزء الحالي
  mushafPct: number;
  pagesToJuzEnd: number; // = أوجه متبقية لإتمام الجزء
  nearJuzEnd: boolean; // قريبة جداً من ختم الجزء
  // المطلوب في اللقاء القادم — يُحسب من موضعها الفعلي + أوجه كل لقاء
  nextFromPage: number;
  nextToPage: number;
  nextHifzLabel: string;
  // مقطعا الورد القادم بدقة الآية (للمسمّع) — بترتيب المصحف دائماً
  nextHifzRange: PosRange | null;
  nextMurRange: PosRange | null;
  // موضعا الاستئناف (لبدء فصل جديد من حيث وصلت) — حافة الحفظ في اتجاهها
  nextHifzFrom: { surah: number; ayah: number } | null;
  nextMurFrom: { surah: number; ayah: number } | null;
  currentTasmiLabel: string; // آخر موضع حُفظ (لتوضيح أساس الحساب)
  // المطلوب القادم للمراجعة — من موضع المراجعة الفعلي + أوجه المراجعة
  nextMurLabel: string;
  currentMurLabel: string; // آخر موضع رُوجع
  // إسقاط الخطة على اللقاءات المتبقية من الموضع الفعلي —
  // ليطابق الجدولُ بطاقةَ «المطلوب القادم» (مفتاحها رقم اللقاء)
  projected: Record<
    number,
    { hifzLabel: string; tathbitLabel: string; murajaahLabel: string }
  >;
  expectedPage: number; // المتوقّع اليوم حسب الخطة
  aheadPages: number; // + متقدّمة، − متأخّرة (بالصفحات المكتملة)
  termGoalJuz: number; // الجزء الذي تبلغه بإتمام حفظ خطة الفصل (0 = بلا خطة)
  // المراجعة مقابل خطتها (تراكمياً)
  aheadMurPages: number;
  hasMurPlan: boolean;
  // «سباق خطة الفصل» — إتمام خطة الفصل كاملة (حفظاً ومراجعة)
  termPlan: {
    pct: number; // نسبة إنجاز الخطة كاملة
    remHifz: number; // أوجه حفظ متبقية من الخطة
    remMur: number; // أوجه مراجعة متبقية
    meetingsLeft: number;
    needHifz: number; // المطلوب حفظاً كل لقاء متبقٍّ للإتمام
    needMur: number;
    extraHifz: number; // الزيادة عن وتيرة الخطة
    extraMur: number;
    status: "done" | "onTrack" | "boost" | "ended";
  } | null;
  facesPerSession: number; // وتيرة الحفظ
  sessionsToJuzEnd: number;
  sessionsToJuzEndBoost: number; // لو زادت وجهين
  boostFaces: number;
  termSessionsLeft: number; // حصص متبقية لإنهاء الفصل
  // تنافس مع النفس
  streak: number;
  personalBest: number;
  completedJuz: number;
}

export function computeProgress(
  student: Student,
  recitations: RecitationLog[],
  halaqa: Halaqa | undefined
): Progress {
  const plan: CoursePlan = student.plan;
  const desc = isDesc(plan);
  const mdesc = isMurDesc(plan);
  const hMode = hifzMode(plan);
  const mMode = murMode(plan);
  const mine = recitations
    .filter((r) => r.studentId === student.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  // حافة الحفظ (آية) من سجلّ التسميع، وصفحتها
  const lastTasmi = furthestEnd(mine.map((r) => ({ part: r.tasmi })), hMode);
  const currentPage = lastTasmi ? pageOf(lastTasmi.surah, lastTasmi.ayah) : 0;
  // صفحات قُطعت من أوّل المصحف في اتجاهها (نازلاً: من ٦٠٤ هبوطاً)
  const pagesReached = currentPage
    ? desc
      ? MUSHAF_PAGES - currentPage + 1
      : currentPage
    : 0;

  const juz = currentPage ? juzOfPage(currentPage) : desc ? 30 : 1;
  const jStart = juzStartPage(juz);
  const jEnd = juzEndPage(juz);
  const juzLen = jEnd - jStart + 1;
  const juzPct = currentPage
    ? Math.round(
        ((desc ? jEnd - currentPage + 1 : currentPage - jStart + 1) / juzLen) * 100
      )
    : 0;
  const mushafPct = Math.round((pagesReached / MUSHAF_PAGES) * 100);
  const pagesToJuzEnd = currentPage
    ? Math.max(0, desc ? currentPage - jStart : jEnd - currentPage)
    : 0;

  // صفحة الوصول بعد قطع cum صفحة من صفحة البداية في الاتجاه المعطى
  const advance = (from: number, cum: number, d = desc) =>
    d ? Math.max(1, from - cum + 1) : Math.min(MUSHAF_PAGES, from + cum - 1);

  // المتوقّع حسب الخطة + الحصص المتبقية
  const schedule = halaqa ? buildSchedule(halaqa, plan) : null;
  let expectedPage = 0;
  let expectedCum = 0; // أوجه الحفظ المتوقّعة تراكمياً حتى آخر لقاء مضى
  let termSessionsLeft = 0;
  let nextIdx = 0; // اللقاء القادم بعد آخر مسجَّل (0 = انتهى)
  let termGoalJuz = 0;
  if (schedule && schedule.length) {
    nextIdx = currentSessionIndex(schedule, mine);
    const passed = nextIdx > 0 ? nextIdx - 1 : schedule.length;
    termSessionsLeft = nextIdx > 0 ? schedule.length - passed : 0;
    const startPage = plan.startSurah
      ? pageOf(surahNumber(plan.startSurah), plan.startAyah || 1)
      : desc
        ? MUSHAF_PAGES
        : 1;
    const cum = passed > 0 ? schedule[passed - 1].cumHifz : 0;
    expectedCum = cum;
    const totalH = schedule[schedule.length - 1].cumHifz;
    if (hMode === "surahDesc" && plan.startSurah) {
      const st0 = normalizeDescStart({ surah: surahNumber(plan.startSurah), ayah: plan.startAyah || 1 });
      expectedPage = cum > 0 ? descPosAfter(st0, cum).page : startPage;
      // هدف الفصل: الصفحة التي تبلغها بإتمام كل حفظ الخطة — وجزؤها
      if (totalH > 0) termGoalJuz = juzOfPage(descPosAfter(st0, totalH).page);
    } else {
      expectedPage = cum > 0 ? advance(startPage, cum) : desc ? startPage + 1 : startPage - 1;
      if (plan.startSurah && totalH > 0) termGoalJuz = juzOfPage(advance(startPage, totalH));
    }
  }
  // المقارنة بالخطة تكون بالصفحات «المكتملة» (كقاعدة عدّ الأوجه).
  // + متقدّمة: صاعداً بلغت صفحة أعلى من المتوقّع، ونازلاً صفحة أدنى منه
  const ahead = (edge: Pos, expected: number, d = desc) =>
    d ? expected - completedPageOf(edge, "pageDesc") : completedPageOf(edge) - expected;

  // المطلوب القادم للحفظ = من الآية التي تلي (أو تسبق) حافة الحفظ، بمقدار أوجه الخطة
  const perHplan = Math.max(0, Math.round(plan.hifz || 0));
  const hifzStartPos: Pos | null = plan.startSurah
    ? hMode === "surahDesc"
      ? normalizeDescStart({ surah: surahNumber(plan.startSurah), ayah: plan.startAyah || 1 })
      : { surah: surahNumber(plan.startSurah), ayah: plan.startAyah || 1 }
    : null;
  // الأوجه المكتملة على مسار الحفظ من بداية الخطة حتى الحافة (نازلاً بالسور: ترتيب المسار)
  const doneHifzPages = (edge: Pos | null): number => {
    if (!edge || !hifzStartPos) return 0;
    if (hMode === "surahDesc") {
      const idx = descPathIndex(hifzStartPos, edge);
      const page = pageOf(edge.surah, edge.ayah);
      return completedPageOf(edge, "surahDesc") === page ? idx : idx - 1;
    }
    const cp = completedPageOf(edge, hMode);
    const sp = pageOf(hifzStartPos.surah, hifzStartPos.ayah);
    return desc ? sp - cp + 1 : cp - sp + 1;
  };
  const aheadPages =
    lastTasmi && expectedCum > 0
      ? hMode === "surahDesc"
        ? doneHifzPages(lastTasmi) - expectedCum
        : expectedPage
          ? ahead(lastTasmi, expectedPage)
          : 0
      : 0;
  const nextHifzFrom = lastTasmi ? stepPos(lastTasmi, hMode) : hifzStartPos;
  const nh = nextLabel(nextHifzFrom, perHplan, hMode);
  const nextHifzLabel = nh.label;
  const nextFromPage = nh.fromPage;
  const nextToPage = nh.toPage;

  // المطلوب القادم للمراجعة = من الآية التي تلي (أو تسبق) حافة المراجعة
  const lastMuraja = furthestEnd(mine.map((r) => ({ part: r.muraja })), mMode);
  const perMplan = Math.max(0, Math.round(plan.murajaah || 0));
  const murStartPos: Pos | null = plan.murStartSurah
    ? { surah: surahNumber(plan.murStartSurah), ayah: plan.murStartAyah || 1 }
    : null;
  const nextMurFrom = lastMuraja ? stepPos(lastMuraja, mMode) : murStartPos;
  const nm = nextLabel(nextMurFrom, perMplan, mMode);
  const nextMurLabel = nm.label;

  // موقع المراجعة مقابل خطتها (تراكمياً) — كمؤشر الحفظ، في اتجاه المراجعة
  let expectedMurPage = 0;
  if (schedule && schedule.length && murStartPos) {
    const passed = nextIdx > 0 ? nextIdx - 1 : schedule.length;
    const cumM = passed > 0 ? schedule[passed - 1].cumMurajaah : 0;
    if (cumM > 0)
      expectedMurPage = advance(
        pageOf(murStartPos.surah, murStartPos.ayah),
        cumM,
        mdesc
      );
  }
  const aheadMurPages =
    lastMuraja && expectedMurPage ? ahead(lastMuraja, expectedMurPage, mdesc) : 0;
  const hasMurPlan = Boolean(lastMuraja && expectedMurPage > 0);

  // «سباق خطة الفصل»: كم أُنجز من خطة الفصل كاملة، وما وصفة كل لقاء
  // متبقٍّ لإتمامها قبل نهاية الفصل
  let termPlan: Progress["termPlan"] = null;
  if (schedule && schedule.length) {
    const lastRow = schedule[schedule.length - 1];
    const totalH = lastRow.cumHifz;
    const totalM = lastRow.cumMurajaah;
    if (totalH + totalM > 0) {
      // صفحات مكتملة من بداية الخطة حتى الحافة، في اتجاهها
      const doneFrom = (
        startPage: number,
        edge: Pos | null,
        total: number,
        d: boolean
      ) => {
        if (!edge || !startPage) return 0;
        const cp = completedPageOf(edge, d ? "pageDesc" : "asc");
        const n = d ? startPage - cp + 1 : cp - startPage + 1;
        return Math.max(0, Math.min(total, n));
      };
      const doneH =
        hMode === "surahDesc"
          ? Math.max(0, Math.min(totalH, doneHifzPages(lastTasmi)))
          : doneFrom(hifzStartPos ? pageOf(hifzStartPos.surah, hifzStartPos.ayah) : 0, lastTasmi, totalH, desc);
      const mStart = murStartPos
        ? pageOf(murStartPos.surah, murStartPos.ayah)
        : 0;
      const doneM = doneFrom(mStart, lastMuraja, totalM, mdesc);
      const remHifz = totalH - doneH;
      const remMur = totalM - doneM;
      const left = termSessionsLeft;
      const needHifz = left > 0 ? Math.ceil(remHifz / left) : 0;
      const needMur = left > 0 ? Math.ceil(remMur / left) : 0;
      termPlan = {
        pct: Math.round(((doneH + doneM) / (totalH + totalM)) * 100),
        remHifz,
        remMur,
        meetingsLeft: left,
        needHifz,
        needMur,
        extraHifz: Math.max(0, needHifz - perHplan),
        extraMur: Math.max(0, needMur - perMplan),
        status:
          remHifz + remMur <= 0
            ? "done"
            : left === 0
              ? "ended"
              : needHifz <= perHplan && needMur <= perMplan
                ? "onTrack"
                : "boost",
      };
    }
  }

  // إسقاط الخطة على اللقاءات المتبقية من الموضع الفعلي —
  // كل لقاء قادم يبدأ حيث ينتهي سابقه (لا من الخطة الثابتة)
  const projected: Progress["projected"] = {};
  if (schedule && nextIdx > 0) {
    let hFrom: Pos | null = nextHifzFrom;
    let mFrom: Pos | null = nextMurFrom;
    // تثبيت أول لقاء قادم = آخر مقطع سُمّع حفظاً فعلاً
    const lastTasmiLog = mine.find((r) => r.tasmi.status === "done");
    let prevHifz = recitePartLabel(lastTasmiLog?.tasmi);
    for (let n = nextIdx; n <= schedule.length; n++) {
      const nh2 = nextLabel(hFrom, perHplan, hMode);
      const nm2 = nextLabel(mFrom, perMplan, mMode);
      projected[n] = {
        hifzLabel: nh2.label,
        tathbitLabel: prevHifz,
        murajaahLabel: nm2.label,
      };
      hFrom = nh2.fromPage ? edgeAfter(nh2, hMode) : null;
      mFrom = nm2.fromPage ? edgeAfter(nm2, mMode) : null;
      prevHifz = nh2.label || prevHifz;
    }
  }

  // وتيرة الحفظ (متوسط أوجه التسميع في اللقاءات التي سُمّع فيها)
  const tasmiLogs = mine.filter((r) => r.tasmi.status === "done");
  const avg =
    tasmiLogs.length > 0
      ? Math.round(
          tasmiLogs.reduce((n, r) => n + faces(r.tasmi, hMode), 0) /
            tasmiLogs.length
        )
      : 0;
  const facesPerSession = Math.max(1, plan.hifz || avg || 1);
  const boostFaces = facesPerSession + 2;
  const sessionsToJuzEnd = pagesToJuzEnd
    ? Math.ceil(pagesToJuzEnd / facesPerSession)
    : 0;
  const sessionsToJuzEndBoost = pagesToJuzEnd
    ? Math.ceil(pagesToJuzEnd / boostFaces)
    : 0;
  // قريبة جداً: تُنهي الجزء في لقاء واحد أو باقٍ ≤ ٥ أوجه
  const nearJuzEnd =
    pagesToJuzEnd > 0 && (sessionsToJuzEnd <= 1 || pagesToJuzEnd <= 5);

  // السلسلة: لقاءات حضورية متتابعة بلا انقطاع (فجوة ≤ ٨ أيام)
  const attended = mine.filter((r) => r.attended);
  let streak = 0;
  for (let i = 0; i < attended.length; i++) {
    if (i === 0) {
      streak = 1;
    } else {
      const gap =
        (new Date(`${attended[i - 1].date}T00:00:00`).getTime() -
          new Date(`${attended[i].date}T00:00:00`).getTime()) /
        86400000;
      if (gap <= 8) streak++;
      else break;
    }
  }

  // أفضل إنجاز (أكثر أوجه تسميع بلقاء)
  let personalBest = 0;
  for (const r of mine) {
    const f = faces(r.tasmi, hMode);
    if (f > personalBest) personalBest = f;
  }

  // أجزاء مكتملة — صاعداً ما انتهى قبل الحافة، ونازلاً ما بدأ بعدها
  let completedJuz = 0;
  if (currentPage)
    for (let j = 1; j <= 30; j++)
      if (desc ? juzStartPage(j) >= currentPage : juzEndPage(j) <= currentPage)
        completedJuz++;

  return {
    hasData: currentPage > 0,
    desc,
    murDesc: mdesc,
    currentPage,
    pagesReached,
    juz,
    juzPct,
    mushafPct,
    pagesToJuzEnd,
    nearJuzEnd,
    nextFromPage,
    nextToPage,
    nextHifzLabel,
    nextHifzRange: nh.range,
    nextMurRange: nm.range,
    currentTasmiLabel: lastTasmi
      ? refLabel(lastTasmi.surah, lastTasmi.ayah)
      : "",
    nextMurLabel,
    currentMurLabel: lastMuraja
      ? refLabel(lastMuraja.surah, lastMuraja.ayah)
      : "",
    nextHifzFrom,
    nextMurFrom,
    projected,
    expectedPage,
    aheadPages,
    termGoalJuz,
    aheadMurPages,
    hasMurPlan,
    termPlan,
    facesPerSession,
    sessionsToJuzEnd,
    sessionsToJuzEndBoost,
    boostFaces,
    termSessionsLeft,
    streak,
    personalBest,
    completedJuz,
  };
}

/* ================== الأوسمة ================== */

export interface Badge {
  key: string;
  label: string;
  icon: string;
  unlocked: boolean;
}

export function badgesFor(p: Progress): Badge[] {
  return [
    { key: "juz1", label: "أول جزء", icon: "🎖️", unlocked: p.completedJuz >= 1 },
    { key: "juz5", label: "٥ أجزاء", icon: "🏅", unlocked: p.completedJuz >= 5 },
    {
      key: "half",
      label: "نصف المصحف",
      icon: "🌟",
      unlocked: p.pagesReached >= Math.floor(MUSHAF_PAGES / 2),
    },
    {
      key: "khatmah",
      label: "ختمة",
      icon: "🏆",
      unlocked: p.pagesReached >= MUSHAF_PAGES,
    },
  ];
}
