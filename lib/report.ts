import { computeProgress, partFaces } from "./progress";
import { computeRace, sinceDays } from "./points";
import {
  buildSchedule,
  currentSessionIndex,
  dateKey,
  halaqaTitle,
  type AppState,
  type Halaqa,
  type Student,
} from "./store";

/** تقرير طالبة واحدة — يغذّي لوحة المتابعة وتصدير الإكسل */
export interface StudentReport {
  student: Student;
  halaqa?: Halaqa;
  halaqaLabel: string;
  mosque: string;
  teacherName: string;
  attended: number; // لقاءات حضرتها (مسجّلة)
  absent: number; // غيابات مسجّلة
  hifzFaces: number; // أوجه حفظ مكتملة (كل السجلّ)
  murFaces: number;
  lastTasmiLabel: string; // آخر موضع حفظ
  termPct: number | null; // نسبة إنجاز خطة الفصل
  aheadPages: number | null; // + متقدمة / − متأخرة عن الخطة
  weekActive: boolean; // سمّعت خلال آخر ٧ أيام
  missedLastMeeting: boolean; // آخر لقاء مضى بلا أي تسجيل
  absentStreak: number; // غيابات متتالية في آخر اللقاءات المسجّلة
  weekPoints: number;
  totalPoints: number;
}

export function buildReports(s: AppState): StudentReport[] {
  const weekRace = new Map(
    computeRace(s.students, s.halaqas, s.recitations, s.readingProgress, s.tajweedResults, {
      sinceISO: sinceDays(7),
    }).map((e) => [e.studentId, e.points])
  );
  const allRace = new Map(
    computeRace(s.students, s.halaqas, s.recitations, s.readingProgress, s.tajweedResults, {}).map(
      (e) => [e.studentId, e.points]
    )
  );
  const weekCut = sinceDays(7);
  const today = dateKey(new Date());

  return s.students.map((st) => {
    const halaqa = s.halaqas.find((h) => h.id === st.halaqaId);
    const teacher = s.teachers.find((t) => t.id === st.teacherId);
    const mine = s.recitations
      .filter((r) => r.studentId === st.id)
      .sort((a, b) => b.date.localeCompare(a.date));

    let attended = 0;
    let absent = 0;
    let hifzFaces = 0;
    let murFaces = 0;
    for (const r of mine) {
      if (r.attended) attended++;
      else absent++;
      hifzFaces += partFaces(r.tasmi);
      murFaces += partFaces(r.muraja);
    }

    const prog = computeProgress(st, s.recitations, halaqa);

    // آخر لقاء مضى وفق الجدول — هل سُجّل؟
    const schedule = halaqa ? buildSchedule(halaqa, st.plan) : null;
    let missedLastMeeting = false;
    let absentStreak = 0;
    if (schedule?.length) {
      // لقاء اليوم لا يُحاسب عليه بعد — قد لا يكون وقع أصلاً
      const passed = schedule.filter((row) => dateKey(row.date) < today);
      const idx = currentSessionIndex(schedule, mine);
      const termRunning = idx > 0 || passed.length === schedule.length;
      if (termRunning && passed.length > 0) {
        const logged = new Map(mine.map((r) => [r.date, r]));
        const last = passed[passed.length - 1];
        missedLastMeeting = !logged.has(dateKey(last.date));
        // غيابات مسجَّلة متتالية من الأحدث للأقدم
        for (let i = passed.length - 1; i >= 0; i--) {
          const log = logged.get(dateKey(passed[i].date));
          if (log && !log.attended) absentStreak++;
          else break;
        }
      }
    }

    return {
      student: st,
      halaqa,
      halaqaLabel: halaqa ? halaqaTitle(halaqa) : "—",
      mosque: halaqa?.mosque ?? "—",
      teacherName: teacher?.name ?? "—",
      attended,
      absent,
      hifzFaces,
      murFaces,
      lastTasmiLabel: prog.currentTasmiLabel || "—",
      termPct: prog.termPlan ? prog.termPlan.pct : null,
      aheadPages: prog.hasData && prog.expectedPage > 0 ? prog.aheadPages : null,
      weekActive: mine.some(
        (r) => r.date >= weekCut && r.attended && partFaces(r.tasmi) + partFaces(r.muraja) + partFaces(r.tathbit) > 0
      ),
      missedLastMeeting,
      absentStreak,
      weekPoints: weekRace.get(st.id) ?? 0,
      totalPoints: allRace.get(st.id) ?? 0,
    };
  });
}

/* ============ تصدير Excel (CSV بترميز يفتح في إكسل مباشرة) ============ */

const CSV_HEADERS = [
  "الطالبة",
  "المسجد",
  "الحلقة",
  "المعلّمة",
  "لقاءات حضرتها",
  "غيابات",
  "أوجه الحفظ",
  "أوجه المراجعة",
  "آخر موضع حفظ",
  "إنجاز خطة الفصل ٪",
  "الموقف من الخطة (أوجه)",
  "نقاط الأسبوع",
  "النقاط الكلية",
  "رمز الدخول",
  "الجوال",
];

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** بناء محتوى CSV (بعلامة BOM ليقرأ إكسل العربية صحيحة) */
export function reportsToCsv(reports: StudentReport[]): string {
  const rows = reports.map((r) => [
    r.student.name,
    r.mosque,
    r.halaqaLabel,
    r.teacherName,
    r.attended,
    r.absent,
    r.hifzFaces,
    r.murFaces,
    r.lastTasmiLabel,
    r.termPct ?? "—",
    r.aheadPages === null ? "—" : r.aheadPages,
    r.weekPoints,
    r.totalPoints,
    r.student.code,
    r.student.phone ?? "",
  ]);
  return (
    "\uFEFF" +
    [CSV_HEADERS, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")
  );
}

/** تنزيل الملف في المتصفح */
export function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
