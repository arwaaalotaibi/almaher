import { advanceByFaces, descRangeLabel, normalizeTopEdge, rangeFaces, spanLabel, topEdgeLabel } from "./faces";
import {
  MUSHAF_PAGES,
  pageEnd,
  pageOf,
  pageStart,
  refLabel,
  surahName,
  surahNumber,
} from "./mushaf";
import { SURAH_AYAHS } from "./surahs";
import { advanceByUnit, measureRange, unitOf, type PlanUnit } from "./units";
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
  dateKey,
  isDesc,
  planAt,
  isMurDesc,
  mergeReciteParts,
  recitePartLabel,
  tathbitSpan,
  partOn,
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
): PathMode => (isMurDesc(plan) ? "surahDesc" : "asc"); // المراجعة النازلة بالسور كالحفظ: السورة كاملة ثم التي قبلها
const modeOf = (desc: boolean, kind: "hifz" | "muraja"): PathMode => {
  void kind; // الحفظ والمراجعة النازلان بمسار واحد (بالسور)
  return desc ? "surahDesc" : "asc";
};

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
  mode: PathMode = "asc",
  unit: PlanUnit = "face"
): {
  label: string;
  fromPage: number;
  toPage: number;
  range: PosRange | null;
  next?: Pos | null; // موضع بداية المقطع التالي
} {
  if (!from || perH <= 0) return { label: "", fromPage: 0, toPage: 0, range: null };
  // 📏 بوحدة الخطة (الوجه كما هو، والسطر/الربع/الحزب بمقدارها على المسار نفسه)
  const adv = (p: Pos) => (unit === "face" ? advanceByFaces(p, perH, mode) : advanceByUnit(p, perH, unit, mode));
  if (mode === "pageDesc") {
    // المراجعة النازلة: «من» هو الطرف الأعلى («الناس ١» = السورة كاملة)، والمقطع يُخزَّن من الأدنى إلى الأعلى
    const top = normalizeTopEdge(from);
    const r = adv(top);
    const a = topEdgeLabel(top);
    const b = refLabel(r.end.surah, r.end.ayah);
    return {
      label: a === b ? a : `${a} ← ${b}`,
      fromPage: pageOf(r.end.surah, r.end.ayah),
      toPage: pageOf(top.surah, top.ayah),
      range: { from: r.end, to: top },
      next: r.next,
    };
  }
  const r = adv(from);
  // نازلاً بالسور: «فصلت ٤٧ ← ٥٤ ثم غافر ١ ← ٨» عند عبور سورة واحدة، وإلا مختصر «الناس ١ ← الملك ٣٠»
  const label =
    mode === "surahDesc" && from.surah - r.end.surah <= 1
      ? descRangeLabel(from, r.end)
      : (() => {
          const a = refLabel(from.surah, from.ayah);
          const b = refLabel(r.end.surah, r.end.ayah);
          return a === b ? a : `${a} ← ${b}`;
        })();
  return {
    label,
    fromPage: pageOf(from.surah, from.ayah),
    toPage: pageOf(r.end.surah, r.end.ayah),
    range: { from, to: r.end },
    next: r.next,
  };
}

/** مقطع بمقدار k وجه ابتداءً من موضع على مسار معيّن — للتسجيل السريع (زيادة/نقصان) */
export function rangeForFaces(from: Pos | null, k: number, mode: PathMode): PosRange | null {
  return nextLabel(from, k, mode).range;
}

/** مقطع بمقدار qty بوحدة الخطة ابتداءً من موضع — للتسجيل السريع (زيادة/نقصان) وحكم المطلوب */
export function rangeForUnit(from: Pos | null, qty: number, unit: PlanUnit, mode: PathMode): PosRange | null {
  return nextLabel(from, qty, mode, unit).range;
}

/** الحافة التي يبدأ منها المقطع الذي يلي مقطعاً محسوباً (للإسقاط) */
function edgeAfter(
  nl: { fromPage: number; toPage: number; next?: Pos | null },
  mode: PathMode,
  unit: PlanUnit = "face"
): Pos | null {
  // بالسطر/الربع/الحزب: يبدأ ما بعده من الآية التالية مباشرة (لا من حدّ الصفحة)
  if (mode === "surahDesc" || unit !== "face") return nl.next ?? null;
  if (mode === "pageDesc") return nl.fromPage > 1 ? ayahBefore(pageStart(nl.fromPage)) : null;
  return nl.toPage > 0 && nl.toPage < MUSHAF_PAGES
    ? ayahAfter(pageEnd(nl.toPage))
    : null;
}

/* ================== إعادة ضبط سجلات الفصل على بداية الخطة ==================
   تعديل بداية الحفظ/المراجعة أو اتجاهها يسري من اللقاء الأول حتى لو كان مسجّلاً: تُبنى مقاطع
   اللقاءات المسجّلة للقسم الذي تغيّرت بدايته متسلسلةً من البداية الجديدة، كلٌّ بمقدار أوجهه
   المسجّل نفسه (لا يتغيّر ما سُمّع كمّاً، بل موضعه فقط). القسم الذي لم تتغيّر بدايته لا يُمسّ
   إطلاقاً — فإعادة البناء من الأوجه تقريبية ولا تطابق ما سجّلته المعلّمة آيةً آية. */

const partOf = (r: PosRange): RecitePart => ({
  status: "done",
  fromSurah: surahName(r.from.surah),
  fromAyah: r.from.ayah,
  toSurah: surahName(r.to.surah),
  toAyah: r.to.ayah,
});
const samePart = (a: RecitePart, b: RecitePart) =>
  a.fromSurah === b.fromSurah &&
  (a.fromAyah ?? 1) === (b.fromAyah ?? 1) &&
  (a.toSurah || a.fromSurah) === (b.toSurah || b.fromSurah) &&
  (a.toAyah ?? a.fromAyah ?? 1) === (b.toAyah ?? b.fromAyah ?? 1);

/** سلسلة مقاطع لقسم واحد (حفظ أو مراجعة) من بداية الخطة، كلٌّ بأوجه سجلّه — يعيد المقاطع الجديدة
    لكل سجلّ (null = لا تغيير في موضعه) */
function realignPart(
  logs: RecitationLog[],
  key: "tasmi" | "muraja",
  start: Pos | null,
  mode: PathMode,
  desc: boolean
): (RecitePart | null)[] {
  const none = logs.map(() => null);
  if (!start) return none;
  const out: (RecitePart | null)[] = [];
  let from: Pos | null = start;
  for (const r of logs) {
    const p = r[key];
    if (p.status !== "done" || !p.fromSurah) {
      out.push(null);
      continue;
    }
    const k = r.faces?.[key] ?? partFaces(p, desc, key === "muraja" ? "muraja" : "hifz");
    const nl: ReturnType<typeof nextLabel> | null = from && k > 0 ? nextLabel(from, k, mode) : null;
    if (!nl?.range) {
      out.push(null);
      continue;
    }
    const np = partOf(nl.range);
    out.push(samePart(np, p) ? null : np);
    from = nl.fromPage ? edgeAfter(nl, mode) : null;
  }
  return out;
}

/** التعديلات اللازمة على سجلات الفصل (الحاضرة، من بداية الفصل، بترتيب التاريخ) لتبدأ من بداية الخطة
    حفظاً ومراجعةً — يعيد لكل سجلّ يتغيّر بياناته الجديدة مع أوجهه */
/** هل تغيّرت بداية الحفظ أو اتجاهه بين خطتين؟ */
export function hifzStartChanged(a: CoursePlan | undefined, b: CoursePlan): boolean {
  return (
    isDesc(a) !== isDesc(b) ||
    (a?.startSurah ?? "") !== (b.startSurah ?? "") ||
    (a?.startAyah ?? 1) !== (b.startAyah ?? 1)
  );
}
/** هل تغيّرت بداية المراجعة أو اتجاهها بين خطتين؟ */
export function murStartChanged(a: CoursePlan | undefined, b: CoursePlan): boolean {
  return (
    isMurDesc(a) !== isMurDesc(b) ||
    (a?.murStartSurah ?? "") !== (b.murStartSurah ?? "") ||
    (a?.murStartAyah ?? 1) !== (b.murStartAyah ?? 1)
  );
}

export function realignTermLogs(
  logs: RecitationLog[],
  plan: CoursePlan,
  termStart: string,
  which: { hifz: boolean; muraja: boolean }
): { id: string; data: Omit<RecitationLog, "id" | "createdAt"> }[] {
  if (!which.hifz && !which.muraja) return [];
  const mine = logs
    .filter((r) => r.attended && (!termStart || r.date >= termStart))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!mine.length) return [];
  const hMode = hifzMode(plan);
  const mMode = murMode(plan);
  const hStart: Pos | null =
    which.hifz && plan.startSurah
      ? isDesc(plan)
        ? normalizeDescStart({ surah: surahNumber(plan.startSurah), ayah: plan.startAyah || 1 })
        : { surah: surahNumber(plan.startSurah), ayah: plan.startAyah || 1 }
      : null;
  const mStart: Pos | null =
    which.muraja && plan.murStartSurah
      ? isMurDesc(plan)
        ? normalizeDescStart({ surah: surahNumber(plan.murStartSurah), ayah: plan.murStartAyah || 1 })
        : { surah: surahNumber(plan.murStartSurah), ayah: plan.murStartAyah || 1 }
      : null;
  const nh = realignPart(mine, "tasmi", hStart, hMode, isDesc(plan));
  const nm = realignPart(mine, "muraja", mStart, mMode, isMurDesc(plan));
  // التثبيت = حفظ اللقاءات السابقة: إن كان مطابقاً لها قبل الضبط يتبعها بعده
  const kT = tathbitSpan(plan);
  const prevTasmi = (i: number, list: RecitePart[]) =>
    mergeReciteParts(
      list
        .slice(0, i)
        .filter((p) => p.status === "done")
        .slice(-kT)
    );
  const oldTasmi = mine.map((r) => r.tasmi);
  const newTasmi = mine.map((r, i) => nh[i] ?? r.tasmi);
  const out: { id: string; data: Omit<RecitationLog, "id" | "createdAt"> }[] = [];
  mine.forEach((r, i) => {
    let tathbit = r.tathbit;
    if (nh.some(Boolean) && r.tathbit.status === "done") {
      const was = prevTasmi(i, oldTasmi);
      const now = prevTasmi(i, newTasmi);
      if (was && now && samePart(r.tathbit, was) && !samePart(r.tathbit, now)) tathbit = now;
    }
    if (!nh[i] && !nm[i] && tathbit === r.tathbit) return;
    const data = {
      studentId: r.studentId,
      date: r.date,
      attended: r.attended,
      tasmi: nh[i] ?? r.tasmi,
      tathbit,
      muraja: nm[i] ?? r.muraja,
      note: r.note ?? "",
    };
    out.push({ id: r.id, data: { ...data, faces: logFaces(data, plan) } });
  });
  return out;
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
  const from = { surah: surahNumber(part.fromSurah), ayah: part.fromAyah ?? 1 };
  const to = {
    surah: surahNumber(part.toSurah || part.fromSurah),
    ayah: part.toAyah ?? part.fromAyah ?? 1,
  };
  // عدّ دقيق بربع الوجه (lib/faces): نصيب المقطع من كل صفحة بآياتها
  const done = rangeFaces(from, to, mode);
  return { done, partial: done % 1 !== 0 };
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
  log: Pick<RecitationLog, "tasmi" | "tathbit" | "muraja" | "muraja2">,
  plan?: Pick<CoursePlan, "direction" | "murDirection"> | null
): NonNullable<RecitationLog["faces"]> {
  const d = isDesc(plan);
  return {
    tasmi: partFaces(log.tasmi, d, "hifz"),
    tathbit: partFaces(log.tathbit, d, "hifz"),
    // 🔄 مجموع مقطعي المراجعة (الدورة المختومة + الجديدة) — به يُحكم ويُحسب السباق
    muraja: partFaces(log.muraja, isMurDesc(plan), "muraja") + partFaces(log.muraja2, isMurDesc(plan), "muraja"),
    ...(log.muraja2?.status === "done" ? { muraja2: partFaces(log.muraja2, isMurDesc(plan), "muraja") } : {}),
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
  /** 📏 وحدة الأرقام (غير موجودة = أوجه) */
  unit?: PlanUnit;
}

export function partVerdict(
  part: RecitePart | undefined,
  required: number,
  desc = false,
  kind: "hifz" | "muraja" = "hifz",
  unit: PlanUnit = "face"
): PartVerdict | null {
  // لا حكم إلا على قسم سُمّع فعلاً (وإن لم يكتمل منه وجه واحد)
  if (!part || part.status !== "done" || !part.fromSurah) return null;
  if (unit !== "face") return unitVerdict(part, required, unit, modeOf(desc, kind));
  const { done, partial } = facesInfo(part, modeOf(desc, kind));
  const req = Math.max(0, Math.round((required || 0) * 4) / 4);
  const diff = done - req;
  return {
    done,
    required: req,
    diff,
    partialFace: partial,
    status: diff > 0 ? "exceeded" : diff === 0 ? "met" : "partial",
  };
}

/** 📏 الحكم بالسطر/الربع/الحزب: من بداية ما سمّعته، أين ينتهي المطلوب بوحدتها؟
    بلغت نهايته = أنجزت، تجاوزتها = زيادة، قبلها = ناقص — والفرق بالوحدة نفسها */
function unitVerdict(part: RecitePart, required: number, unit: Exclude<PlanUnit, "face">, mode: PathMode): PartVerdict {
  const start: Pos = { surah: surahNumber(part.fromSurah!), ayah: part.fromAyah ?? 1 };
  const end: Pos = { surah: surahNumber(part.toSurah || part.fromSurah!), ayah: part.toAyah ?? part.fromAyah ?? 1 };
  const req = Math.max(0, Math.round((required || 0) * 4) / 4);
  const done = measureRange(start, end, unit, mode);
  if (req <= 0) return { done, required: 0, diff: done, partialFace: false, status: done > 0 ? "exceeded" : "met", unit };
  const expEnd = advanceByUnit(start, req, unit, mode).end;
  const same = (a: Pos, b: Pos) => a.surah === b.surah && a.ayah === b.ayah;
  let status: PartVerdict["status"] = "met";
  if (!same(end, expEnd)) {
    // أيّهما يُبلغ أولاً على المسار؟
    status = "exceeded";
    let cur: Pos | null = start;
    for (let g = 0; cur && g < 7000; g++) {
      if (same(cur, end)) {
        status = "partial";
        break;
      }
      if (same(cur, expEnd)) break;
      cur = stepPos(cur, mode);
    }
  }
  const raw = done - measureRange(start, expEnd, unit, mode);
  const diff = status === "met" ? 0 : status === "exceeded" ? Math.max(raw, 0.25) : Math.min(raw, -0.25);
  return { done, required: req, diff, partialFace: false, status, unit };
}

/** 🔁 حكم المراجعة في لقاء — بمقطعيها إن بدأت فيه دورة جديدة: المُنجَز مجموعهما، والنقص/الزيادة بالفرق عن المطلوب */
export function murajaVerdict(
  log: Pick<RecitationLog, "muraja" | "muraja2">,
  required: number,
  desc = false,
  unit: PlanUnit = "face"
): PartVerdict | null {
  const v1 = partVerdict(log.muraja, required, desc, "muraja", unit);
  if (log.muraja2?.status !== "done" || !log.muraja2.fromSurah) return v1;
  const v2 = partVerdict(log.muraja2, 0, desc, "muraja", unit);
  if (!v1) return v2;
  const done = v1.done + (v2?.done ?? 0);
  const req = v1.required;
  const diff = Math.round((done - req) * 4) / 4;
  return { done, required: req, diff, partialFace: false, status: diff > 0 ? "exceeded" : diff === 0 ? "met" : "partial", unit };
}

/** 📌 مطلوب التثبيت في حكم اللقاء = ما حفظته فعلاً في اللقاء/اللقاءات الحاضرة السابقة (كالسباق)،
    لا خطة ذلك اللقاء — فمن نقص حفظها لا تُحسب ناقصة مرة ثانية في تثبيته.
    أول لقاء تحضره في الفصل يبقى على الجدول (لا حفظ سابق يُثبَّت). */
export function withActualTathbit<
  T extends { tathbit: number; tathbitQty?: number; hifzUnit?: PlanUnit }
>(row: T, studentRecs: RecitationLog[], date: string, plan: CoursePlan, termStart = ""): T {
  // اللقاءات الحاضرة قبل هذا التاريخ — سجلّ واحد لكل تاريخ (الأقدم = الأصلي إن تكرّر)
  const byDate = new Map<string, RecitationLog>();
  for (const r of studentRecs) {
    if (!r.attended || r.date >= date) continue;
    const c = byDate.get(r.date);
    if (!c || (r.createdAt ?? "") < (c.createdAt ?? "")) byDate.set(r.date, r);
  }
  const prev = [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
  if (!prev.some((r) => r.date >= termStart)) return row; // أول لقاء حاضر في الفصل
  const pd = planAt(plan, date);
  if (!partOn(pd, "tathbit")) return row; // 🚫 التثبيت ملغى عنها — يبقى كالجدول
  const k = tathbitSpan(pd);
  const span = prev.slice(0, k);
  const desc = isDesc(plan);
  const faces = span.reduce((n, r) => n + (r.faces?.tasmi ?? partFaces(r.tasmi, desc)), 0);
  const unit = row.hifzUnit ?? "face";
  let qty = faces;
  if (unit !== "face") {
    qty = 0;
    for (const r of span) {
      const t = r.tasmi;
      if (t.status !== "done" || !t.fromSurah) continue;
      qty += measureRange(
        { surah: surahNumber(t.fromSurah), ayah: t.fromAyah ?? 1 },
        { surah: surahNumber(t.toSurah || t.fromSurah), ayah: t.toAyah ?? t.fromAyah ?? 1 },
        unit,
        desc ? "surahDesc" : "asc"
      );
    }
  }
  return { ...row, tathbit: faces, tathbitQty: qty };
}

/** حكم اللقاء كاملاً عبر الأقسام الثلاثة: الحفظ والتثبيت والمراجعة */
export function sessionVerdict(
  log: RecitationLog,
  row: Pick<ScheduleRow, "hifz" | "tathbit" | "murajaah"> &
    Partial<Pick<ScheduleRow, "hifzQty" | "tathbitQty" | "murajaahQty" | "hifzUnit" | "murUnit">>,
  desc = false,
  murDesc = desc
): PartVerdict["status"] | null {
  // 📏 بوحدة خطة الطالبة في ذلك اللقاء (الوجه افتراضياً)
  const hU = row.hifzUnit ?? "face";
  const mU = row.murUnit ?? "face";
  const pairs: [RecitePart | undefined, number, boolean, "hifz" | "muraja", PlanUnit][] = [
    [log.tasmi, hU === "face" ? row.hifz : (row.hifzQty ?? row.hifz), desc, "hifz", hU],
    [log.tathbit, hU === "face" ? row.tathbit : (row.tathbitQty ?? row.tathbit), desc, "hifz", hU],
    [log.muraja, mU === "face" ? row.murajaah : (row.murajaahQty ?? row.murajaah), murDesc, "muraja", mU],
  ];
  let any = false;
  let exceeded = false;
  let short = false;
  for (const [part, req, d, kind, u] of pairs) {
    const v = kind === "muraja" ? murajaVerdict(log, req, d, u) : partVerdict(part, req, d, kind, u);
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
  // 📌 ورد التثبيت القادم (حفظ آخر لقاء/لقاءات سُمّعت) — بترتيب المصحف، للمسمّع
  nextTathbitRange: PosRange | null;
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
  termGoalSurah: number; // السورة التي تبلغها بإتمام حفظ خطة الفصل (0 = بلا خطة) — لسُلّم حفظي
  // المراجعة مقابل خطتها (تراكمياً)
  aheadMurPages: number;
  hasMurPlan: boolean;
  /** 🔄 رقم دورة المراجعة الحالية (١ = الأولى) */
  murCycle: number;
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
  halaqa: Halaqa | undefined,
  /** atDate: تاريخ اللقاء الذي يُحسب له «المطلوب القادم» (للتسجيل المتأخر) — الخطة السارية فيه */
  opts?: { atDate?: string }
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
  // 📖 حافة الحفظ = نهاية حفظ «آخر لقاء مسجَّل» (لا أبعد موضع في كل السجلات) — كالمراجعة؛
  // وإن تكرّر سجلّ اللقاء يُعتمد الأصلي (الأقدم إنشاءً)
  const lastTasmiLog = mine
    .filter((r) => r.attended && r.tasmi.status === "done" && r.tasmi.fromSurah)
    .sort((a, b) => b.date.localeCompare(a.date) || (a.createdAt ?? "").localeCompare(b.createdAt ?? ""))[0];
  const lastTasmi = lastTasmiLog ? furthestEnd([{ part: lastTasmiLog.tasmi }], hMode) : null;
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
  let termGoalSurah = 0;
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
      if (totalH > 0) {
        const g = descPosAfter(st0, totalH);
        termGoalJuz = juzOfPage(g.page);
        termGoalSurah = g.pos.surah;
      }
    } else {
      expectedPage = cum > 0 ? advance(startPage, cum) : desc ? startPage + 1 : startPage - 1;
      if (plan.startSurah && totalH > 0) {
        const gp = advance(startPage, totalH);
        termGoalJuz = juzOfPage(gp);
        if (Number.isFinite(gp)) termGoalSurah = (desc ? pageStart(gp) : pageEnd(gp)).surah;
      }
    }
  }
  // المقارنة بالخطة تكون بالصفحات «المكتملة» (كقاعدة عدّ الأوجه).
  // + متقدّمة: صاعداً بلغت صفحة أعلى من المتوقّع، ونازلاً صفحة أدنى منه
  const ahead = (edge: Pos, expected: number, d = desc) =>
    d ? expected - completedPageOf(edge, "pageDesc") : completedPageOf(edge) - expected;

  // 🗂️ الخطة السارية في اللقاء القادم (أو في لقاء التسجيل المتأخر) — تعديل الخطة خلال الفصل يسري من لقائه
  const refDate = opts?.atDate ?? (schedule && nextIdx > 0 ? dateKey(schedule[nextIdx - 1].date) : "");
  const pN: CoursePlan = refDate ? planAt(plan, refDate) : plan;
  const hU = unitOf(pN.hifzUnit);
  const mU = unitOf(pN.murUnit);
  // المطلوب القادم للحفظ = من الآية التي تلي (أو تسبق) حافة الحفظ، بمقدار الخطة (بوحدتها)
  const perHplan = partOn(pN, "hifz") ? Math.max(0, Math.round((pN.hifz || 0) * 4) / 4) : 0; // 🚫 ملغى ⇒ لا مطلوب
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
  const nh = nextLabel(nextHifzFrom, perHplan, hMode, hU);
  const nextHifzLabel = nh.label;
  const nextFromPage = nh.fromPage;
  const nextToPage = nh.toPage;

  // 🔁 حافة المراجعة = نهاية مراجعة «آخر لقاء مسجَّل» (لا أبعد موضع بلغته في كل سجلاتها):
  // المعلّمة قد تعيد الطالبة إلى الوراء أو تصحّح، والمعتمد آخر إدخال. (قرار الإدارة ١٨ أكتوبر ٢٠٢٦)
  // وإن تكرّر سجلّ اللقاء يُعتمد الأصلي (الأقدم إنشاءً)
  const murLogs = mine
    .filter((r) => r.attended && ((r.muraja.status === "done" && r.muraja.fromSurah) || r.muraja2?.status === "done" || r.newCycle))
    .sort((a, b) => b.date.localeCompare(a.date) || (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
  const lastMurLog = murLogs[0];
  // 🔄 دورات المراجعة: عدد المرات التي بدأت فيها دورة جديدة
  const markers = mine.filter((r) => r.attended && (r.muraja2?.status === "done" || r.newCycle));
  const murCycle = 1 + markers.length;
  // «من اللقاء التالي» في آخر لقاء: الدورة الجديدة تبدأ من أوّل المصحف
  const freshCycle = !!lastMurLog && lastMurLog.newCycle && lastMurLog.muraja2?.status !== "done";
  const lastMuraja = !lastMurLog || freshCycle
    ? null
    : furthestEnd([{ part: lastMurLog.muraja2?.status === "done" ? lastMurLog.muraja2 : lastMurLog.muraja }], mMode);
  const perMplan = partOn(pN, "murajaah") ? Math.max(0, Math.round((pN.murajaah || 0) * 4) / 4) : 0;
  // نازلاً بالسور: «الناس ٦» (آخر آية) تعني السورة من أوّلها، كبداية الحفظ
  const murStartPos: Pos | null = plan.murStartSurah
    ? mdesc
      ? normalizeDescStart({ surah: surahNumber(plan.murStartSurah), ayah: plan.murStartAyah || 1 })
      : { surah: surahNumber(plan.murStartSurah), ayah: plan.murStartAyah || 1 }
    : null;
  const mushafMurStart: Pos = mdesc ? normalizeDescStart({ surah: 114, ayah: 6 }) : { surah: 1, ayah: 1 };
  const nextMurFrom = lastMuraja ? stepPos(lastMuraja, mMode) : freshCycle ? mushafMurStart : murStartPos;
  const nm = nextLabel(nextMurFrom, perMplan, mMode, mU);
  const nextMurLabel = nm.label;
  // وتيرة اللقاء بالأوجه (للمقارنات والسباق): الوحدة «وجه» كما هي، وغيرها بأوجه مقطعها القادم
  const perHfaces = hU === "face" ? perHplan : nh.range ? rangeFaces(nh.range.from, nh.range.to, hMode) : 0;
  const perMfaces = mU === "face" ? perMplan : nm.range ? rangeFaces(nm.range.from, nm.range.to, mMode) : 0;

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
  // بعد دورة جديدة لا معنى لمقارنة موضع المراجعة بخطة الفصل (ترجع للبداية عمداً)
  const aheadMurPages =
    lastMuraja && expectedMurPage && murCycle === 1 ? ahead(lastMuraja, expectedMurPage, mdesc) : 0;
  const hasMurPlan = Boolean(lastMuraja && expectedMurPage > 0 && murCycle === 1);

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
      // في الدورات: ما رُوجع فعلاً هذا الفصل بالأوجه (لا المسافة من البداية)
      const termMur = mine
        .filter((r) => r.attended && halaqa?.termStart && r.date >= halaqa.termStart)
        .reduce((n, r) => n + (r.faces?.muraja ?? partFaces(r.muraja, mdesc, "muraja") + partFaces(r.muraja2, mdesc, "muraja")), 0);
      const doneM = murCycle > 1 ? Math.min(totalM, termMur) : doneFrom(mStart, lastMuraja, totalM, mdesc);
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
        extraHifz: Math.max(0, needHifz - perHfaces),
        extraMur: Math.max(0, needMur - perMfaces),
        status:
          remHifz + remMur <= 0
            ? "done"
            : left === 0
              ? "ended"
              : needHifz <= perHfaces && needMur <= perMfaces
                ? "onTrack"
                : "boost",
      };
    }
  }

  // إسقاط الخطة على اللقاءات المتبقية من الموضع الفعلي —
  // كل لقاء قادم يبدأ حيث ينتهي سابقه (لا من الخطة الثابتة)
  const projected: Progress["projected"] = {};
  let nextTathbitRange: PosRange | null = null;
  if (schedule && nextIdx > 0) {
    let hFrom: Pos | null = nextHifzFrom;
    let mFrom: Pos | null = nextMurFrom;
    // تثبيت أول لقاء قادم = حفظ آخر لقاء (أو لقاءين/ثلاثة بحسب الخطة) سُمّع فعلاً،
    // ثم تتقدّم النافذة مع كل لقاء مُسقَط
    const kT = tathbitSpan(plan);
    const toRange = (p: RecitePart): PosRange | null =>
      p.status === "done" && p.fromSurah
        ? {
            from: { surah: surahNumber(p.fromSurah), ayah: p.fromAyah ?? 1 },
            to: { surah: surahNumber(p.toSurah || p.fromSurah), ayah: p.toAyah ?? p.fromAyah ?? 1 },
          }
        : null;
    const recent: { range: PosRange | null; label: string }[] = mine
      .filter((r) => r.tasmi.status === "done")
      .slice(0, kT)
      .reverse()
      .map((r) => ({ range: toRange(r.tasmi), label: recitePartLabel(r.tasmi) }));
    // مدى التثبيت القادم: من أول ما في النافذة إلى آخره بترتيب المصحف
    if (partOn(plan, "tathbit")) {
      const rs = recent.map((x) => x.range).filter((r): r is PosRange => !!r);
      if (rs.length) {
        const all = rs.flatMap((r) => [r.from, r.to]);
        all.sort((a, b) => a.surah - b.surah || a.ayah - b.ayah);
        nextTathbitRange = { from: all[0], to: all[all.length - 1] };
      }
    }
    const tathbitOf = (): string => {
      if (!partOn(plan, "tathbit")) return "";
      const span = recent.slice(-kT);
      if (span.length === 0) return "";
      const oldest = span[0];
      const newest = span[span.length - 1];
      if (span.length === 1) return newest.label;
      return oldest.range && newest.range
        ? spanLabel(oldest.range.from, newest.range.to, hMode)
        : newest.label;
    };
    // بدايات نسخة الخطة — إن تغيّرت بداية الحفظ/المراجعة في لقاء قادم يبدأ الإسقاط منها
    const hKey = (q: CoursePlan) => `${q.startSurah ?? ""}|${q.startAyah ?? 1}|${q.direction ?? ""}`;
    const mKey = (q: CoursePlan) => `${q.murStartSurah ?? ""}|${q.murStartAyah ?? 1}|${q.murDirection ?? q.direction ?? ""}`;
    const startOf = (surah: string | undefined, ayah: number | undefined, d: boolean): Pos | null =>
      surah ? (d ? normalizeDescStart({ surah: surahNumber(surah), ayah: ayah || 1 }) : { surah: surahNumber(surah), ayah: ayah || 1 }) : null;
    let prevP: CoursePlan = pN;
    for (let n = nextIdx; n <= schedule.length; n++) {
      // 🗂️ الخطة السارية في هذا اللقاء القادم
      const pn = n === nextIdx ? pN : planAt(plan, dateKey(schedule[n - 1].date));
      if (hKey(pn) !== hKey(prevP)) hFrom = startOf(pn.startSurah, pn.startAyah, isDesc(pn));
      if (mKey(pn) !== mKey(prevP)) mFrom = startOf(pn.murStartSurah, pn.murStartAyah, isMurDesc(pn));
      prevP = pn;
      const hUn = unitOf(pn.hifzUnit);
      const mUn = unitOf(pn.murUnit);
      const perHn = partOn(pn, "hifz") ? Math.max(0, Math.round((pn.hifz || 0) * 4) / 4) : 0;
      const perMn = partOn(pn, "murajaah") ? Math.max(0, Math.round((pn.murajaah || 0) * 4) / 4) : 0;
      const nh2 = nextLabel(hFrom, perHn, hMode, hUn);
      const nm2 = nextLabel(mFrom, perMn, mMode, mUn);
      projected[n] = {
        hifzLabel: nh2.label,
        tathbitLabel: tathbitOf(),
        murajaahLabel: nm2.label,
      };
      hFrom = nh2.fromPage ? edgeAfter(nh2, hMode, hUn) : null;
      mFrom = nm2.fromPage ? edgeAfter(nm2, mMode, mUn) : null;
      if (nh2.label) {
        recent.push({ range: nh2.range, label: nh2.label });
        if (recent.length > kT) recent.shift();
      }
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
  const facesPerSession = Math.max(1, perHfaces || avg || 1);
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
    nextTathbitRange,
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
    termGoalSurah,
    aheadMurPages,
    hasMurPlan,
    murCycle,
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
    { key: "murcycle", label: "دورة مراجعة", icon: "🔄", unlocked: p.murCycle >= 2 },
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
