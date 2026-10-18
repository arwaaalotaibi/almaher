import { partFaces } from "./progress";
import { rangeFaces } from "./faces";
import { advanceByUnit, unitOf } from "./units";
import { surahNumber } from "./mushaf";

/** 📏 مطلوب لقاء بالأوجه في الخطة السارية فيه: الوجه كما هو، والسطر/الربع/الحزب
    بأوجه المطلوب من بداية ما سمّعته (أو المحفوظ مع السجلّ حين سُجّل) */
export function requiredFaces(
  p: CoursePlan,
  part: RecitePart,
  key: "hifz" | "murajaah",
  stored?: number
): number {
  if (typeof stored === "number") return stored;
  const qty = Math.max(0, Math.round(((key === "hifz" ? p.hifz : p.murajaah) || 0) * 4) / 4);
  const unit = unitOf(key === "hifz" ? p.hifzUnit : p.murUnit);
  if (unit === "face" || qty <= 0 || part.status !== "done" || !part.fromSurah) return unit === "face" ? qty : 0;
  const desc = key === "hifz" ? isDesc(p) : isMurDesc(p);
  const mode = desc ? "surahDesc" : "asc";
  const from = { surah: surahNumber(part.fromSurah), ayah: part.fromAyah ?? 1 };
  return rangeFaces(from, advanceByUnit(from, qty, unit, mode).end, mode);
}
import {
  isDesc,
  isMurDesc,
  planAt,
  tathbitSpan,
  partOn,
  type CoursePlan,
  type RecitePart,
  type Halaqa,
  type ReadingProgress,
  type RecitationLog,
  type Student,
  type TajweedResult,
} from "./store";

/* ============ نقاط سباق الحلقات ============
   تُحسب تلقائياً من نشاط الطالبة الفعلي — الصيغة معلنة للطالبات:
   حضور لقاء ١٠ · وجه حفظ مكتمل ٥ · وجه تثبيت ٢ · وجه مراجعة ١
   ورد قراءة تمّ ٥ · إجابة صحيحة في اختبار ١ · العلامة الكاملة +٥ */

export const POINTS_RULES = [
  { icon: "🕌", label: "حضور لقاء", pts: 10 },
  { icon: "📖", label: "إتمام مقرر الحفظ في اللقاء", pts: 5 },
  { icon: "📌", label: "إتمام مقرر التثبيت (حفظ اللقاء السابق) — من ثاني لقاء", pts: 5 },
  { icon: "🔁", label: "إتمام مقرر المراجعة في اللقاء", pts: 5 },
  { icon: "🌟", label: "أي زيادة عن مقرر الحفظ", pts: 5 },
] as const;
// لاحقاً (غير محسوبة الآن بقرار الإدارة): ورد قراءة كتاب ٣ · إضافة فائدة من كتاب ٢

export interface RaceEntry {
  studentId: string;
  name: string;
  halaqaLabel: string; // «مسجد البحر — الاثنين»
  mosque: string;
  points: number;
  faces: number; // أوجه حفظ ضمن الفترة
  attends: number;
  rank: number;
}

/** ترتيب الطالبات بالنقاط ضمن نطاق (الكل/مسجد) وفترة (منذ تاريخ) */
export function computeRace(
  students: Student[],
  halaqas: Halaqa[],
  recitations: RecitationLog[],
  readingProgress: ReadingProgress[],
  tajweedResults: TajweedResult[],
  opts: { mosque?: string; halaqaId?: string; sinceISO?: string } = {}
): RaceEntry[] {
  const since = opts.sinceISO ?? "";
  const halaqaOf = new Map(halaqas.map((h) => [h.id, h]));

  const entries: RaceEntry[] = [];
  for (const st of students) {
    if (st.plan?.withdrawnAt) continue; // 🚪 منسحبة
    const h = halaqaOf.get(st.halaqaId);
    const mosque = h?.mosque ?? "";
    if (opts.mosque && mosque !== opts.mosque) continue;
    if (opts.halaqaId && st.halaqaId !== opts.halaqaId) continue; // 🕌 حلقة واحدة

    let points = 0;
    let faces = 0;
    let attends = 0;

    // التسميع: حضور ١٠ + ٥ لكل مقرر مكتمل (حفظ / تثبيت / مراجعة).
    // المقرر = أوجه الخطة لكل لقاء، ومقرر التثبيت = حفظ آخر لقاء حاضر (أو لقاءين/ثلاثة بحسب الخطة).
    // نمرّ على اللقاءات الحاضرة بترتيب التاريخ لمعرفة حفظ اللقاءات السابقة (ولو قبل الفترة).
    // المقرر بدقة الربع (١٫٥ وجه مثلاً)
    // 🗂️ المقرر من الخطة السارية في تاريخ كل لقاء (تعديل الخطة خلال الفصل لا يغيّر حكم ما مضى)
    const d = isDesc(st.plan);
    const md = isMurDesc(st.plan);
    const mine = recitations
      .filter((r) => r.studentId === st.id && r.attended)
      .sort((a, b) =>
        a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt ?? "") < (b.createdAt ?? "") ? -1 : 1
      );
    const kT = tathbitSpan(st.plan);
    const recentTasmi: number[] = []; // أوجه حفظ آخر k لقاء حاضر
    // أول لقاء تحضره الطالبة في الفصل: لا حفظ سابق يُثبَّت ⇒ لا نقاط تثبيت فيه (للجميع)
    const firstDate = mine.find((r) => r.date >= (h?.termStart ?? ""))?.date;
    for (const r of mine) {
      const prevTasmi = recentTasmi.reduce((n, x) => n + x, 0);
      // الأوجه المحفوظة رقماً مع السجلّ (سجلات الزميلات تصل بها فقط)، وإلا من المقاطع
      const fH = r.faces?.tasmi ?? partFaces(r.tasmi, d);
      const fT = r.faces?.tathbit ?? partFaces(r.tathbit, d);
      const fM = r.faces?.muraja ?? partFaces(r.muraja, md, "muraja");
      const inRange = !since || r.date >= since;
      const p = planAt(st.plan, r.date);
      const onH = partOn(p, "hifz");
      const onT = partOn(p, "tathbit");
      const onM = partOn(p, "murajaah");
      const reqH = requiredFaces(p, r.tasmi, "hifz", r.faces?.req_tasmi);
      const reqM = requiredFaces(p, r.muraja, "murajaah", r.faces?.req_muraja);
      if (inRange) {
        attends++;
        faces += fH;
        points += 10;
        // 🚫 القسم الملغى عن الطالبة يُحتسب لها تلقائياً بالحضور (ولا زيادة في حفظ ملغى)
        if (!onH || (fH > 0 && fH >= reqH)) points += 5;
        if (r.date !== firstDate && (!onT || (fT > 0 && fT >= prevTasmi))) points += 5;
        if (!onM || (fM > 0 && fM >= reqM)) points += 5;
        if (onH && reqH > 0 && fH > reqH) points += 5; // زيادة عن المقرر — مرة واحدة في اللقاء
      }
      recentTasmi.push(fH);
      if (recentTasmi.length > kT) recentTasmi.shift();
    }

    // القراءة والاختبارات لا تدخل في النقاط حالياً (قرار الإدارة ١٢ سبتمبر ٢٠٢٦)
    void readingProgress;
    void tajweedResults;

    entries.push({
      studentId: st.id,
      name: st.name,
      halaqaLabel: h ? `${h.mosque}${h.day ? " — " + h.day : ""}` : "",
      mosque,
      points,
      faces,
      attends,
      rank: 0,
    });
  }

  entries.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  // الترتيب مع التعادل: نفس النقاط = نفس المركز
  let rank = 0;
  let prevPts = -1;
  entries.forEach((e, i) => {
    if (e.points !== prevPts) {
      rank = i + 1;
      prevPts = e.points;
    }
    e.rank = rank;
  });
  return entries;
}

/** تاريخ بداية الفترة: آخر ٧ أو ٣٠ يوماً (بمفتاح yyyy-mm-dd) */
export function sinceDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
