import { partFaces } from "./progress";
import type {
  Halaqa,
  ReadingProgress,
  RecitationLog,
  Student,
  TajweedResult,
} from "./store";

/* ============ نقاط سباق الحلقات ============
   تُحسب تلقائياً من نشاط الطالبة الفعلي — الصيغة معلنة للطالبات:
   حضور لقاء ١٠ · وجه حفظ مكتمل ٥ · وجه تثبيت ٢ · وجه مراجعة ١
   ورد قراءة تمّ ٥ · إجابة صحيحة في اختبار ١ · العلامة الكاملة +٥ */

export const POINTS_RULES = [
  { icon: "🕌", label: "حضور لقاء", pts: 10 },
  { icon: "📖", label: "كل وجه حفظ مكتمل", pts: 5 },
  { icon: "📌", label: "كل وجه تثبيت", pts: 2 },
  { icon: "🔁", label: "كل وجه مراجعة", pts: 1 },
  { icon: "📚", label: "ورد قراءة تمّ", pts: 5 },
  { icon: "✅", label: "كل إجابة صحيحة في اختبار", pts: 1 },
  { icon: "🌟", label: "العلامة الكاملة في اختبار", pts: 5 },
] as const;

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
    const h = halaqaOf.get(st.halaqaId);
    const mosque = h?.mosque ?? "";
    if (opts.mosque && mosque !== opts.mosque) continue;

    let points = 0;
    let faces = 0;
    let attends = 0;

    // التسميع: حضور + أوجه الحفظ/التثبيت/المراجعة المكتملة
    for (const r of recitations) {
      if (r.studentId !== st.id) continue;
      if (since && r.date < since) continue;
      if (r.attended) {
        attends++;
        points += 10;
      }
      const fH = partFaces(r.tasmi);
      const fT = partFaces(r.tathbit);
      const fM = partFaces(r.muraja);
      faces += fH;
      points += fH * 5 + fT * 2 + fM * 1;
    }

    // القراءة: أوراد تمّت + اختبارات الأقسام
    for (const p of readingProgress) {
      if (p.studentId !== st.id) continue;
      if (since && p.updatedAt.slice(0, 10) < since) continue;
      if (p.done) points += 5;
      if (p.score !== undefined && p.total !== undefined) {
        points += p.score;
        if (p.total > 0 && p.score === p.total) points += 5;
      }
    }

    // التجويد: نتائج أسئلة الدروس
    for (const t of tajweedResults) {
      if (t.studentId !== st.id) continue;
      if (since && t.answeredAt.slice(0, 10) < since) continue;
      points += t.score;
      if (t.total > 0 && t.score === t.total) points += 5;
    }

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
