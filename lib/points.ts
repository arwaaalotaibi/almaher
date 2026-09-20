import { partFaces } from "./progress";
import {
  isDesc,
  isMurDesc,
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
  { icon: "📌", label: "إتمام مقرر التثبيت (حفظ اللقاء السابق)", pts: 5 },
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
  opts: { mosque?: string; sinceISO?: string } = {}
): RaceEntry[] {
  const since = opts.sinceISO ?? "";
  const halaqaOf = new Map(halaqas.map((h) => [h.id, h]));

  const entries: RaceEntry[] = [];
  for (const st of students) {
    if (st.plan?.withdrawnAt) continue; // 🚪 منسحبة
    const h = halaqaOf.get(st.halaqaId);
    const mosque = h?.mosque ?? "";
    if (opts.mosque && mosque !== opts.mosque) continue;

    let points = 0;
    let faces = 0;
    let attends = 0;

    // التسميع: حضور ١٠ + ٥ لكل مقرر مكتمل (حفظ / تثبيت / مراجعة).
    // المقرر = أوجه الخطة لكل لقاء، ومقرر التثبيت = حفظ اللقاء السابق الحاضر.
    // نمرّ على اللقاءات الحاضرة بترتيب التاريخ لمعرفة حفظ اللقاء السابق (ولو قبل الفترة).
    // المقرر بدقة الربع (١٫٥ وجه مثلاً)
    const reqH = Math.max(0, Math.round((st.plan?.hifz || 0) * 4) / 4);
    const reqM = Math.max(0, Math.round((st.plan?.murajaah || 0) * 4) / 4);
    const d = isDesc(st.plan);
    const md = isMurDesc(st.plan);
    const mine = recitations
      .filter((r) => r.studentId === st.id && r.attended)
      .sort((a, b) =>
        a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt ?? "") < (b.createdAt ?? "") ? -1 : 1
      );
    let prevTasmi = 0;
    for (const r of mine) {
      // الأوجه المحفوظة رقماً مع السجلّ (سجلات الزميلات تصل بها فقط)، وإلا من المقاطع
      const fH = r.faces?.tasmi ?? partFaces(r.tasmi, d);
      const fT = r.faces?.tathbit ?? partFaces(r.tathbit, d);
      const fM = r.faces?.muraja ?? partFaces(r.muraja, md, "muraja");
      const inRange = !since || r.date >= since;
      if (inRange) {
        attends++;
        faces += fH;
        points += 10;
        if (fH > 0 && fH >= reqH) points += 5;
        if (fT > 0 && fT >= prevTasmi) points += 5;
        if (fM > 0 && fM >= reqM) points += 5;
        if (reqH > 0 && fH > reqH) points += 5; // زيادة عن المقرر — مرة واحدة في اللقاء
      }
      prevTasmi = fH;
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
