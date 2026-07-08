import { MUSHAF_PAGES, pageOf, surahNumber } from "./mushaf";
import {
  buildSchedule,
  currentSessionIndex,
  type CoursePlan,
  type Halaqa,
  type RecitationLog,
  type RecitePart,
  type Student,
} from "./store";

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

/** عدد أوجه المقطع = صفحات من «من» إلى «إلى» */
function faces(part?: RecitePart): number {
  if (!part || part.status !== "done" || !part.fromSurah) return 0;
  const a = pageOf(surahNumber(part.fromSurah), part.fromAyah ?? 1);
  const b = partEndPage(part);
  return Math.max(1, b - a + 1);
}

/* ================== حساب التقدّم ================== */

export interface Progress {
  hasData: boolean;
  currentPage: number; // أبعد صفحة حُفظت
  juz: number;
  juzPct: number; // نسبة إتمام الجزء الحالي
  mushafPct: number;
  pagesToJuzEnd: number; // = أوجه متبقية لإتمام الجزء
  nearJuzEnd: boolean; // قريبة جداً من ختم الجزء
  expectedPage: number; // المتوقّع اليوم حسب الخطة
  aheadPages: number; // + متقدّمة، − متأخّرة
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
  const mine = recitations
    .filter((r) => r.studentId === student.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  // أبعد صفحة من سجلّ التسميع (الحفظ الجديد)
  let currentPage = 0;
  for (const r of mine) {
    const p = partEndPage(r.tasmi);
    if (p > currentPage) currentPage = p;
  }

  const juz = currentPage ? juzOfPage(currentPage) : 1;
  const jStart = juzStartPage(juz);
  const jEnd = juzEndPage(juz);
  const juzPct = currentPage
    ? Math.round(((currentPage - jStart + 1) / (jEnd - jStart + 1)) * 100)
    : 0;
  const mushafPct = Math.round((currentPage / MUSHAF_PAGES) * 100);
  const pagesToJuzEnd = currentPage ? Math.max(0, jEnd - currentPage) : 0;

  // المتوقّع حسب الخطة + الحصص المتبقية
  const schedule = halaqa ? buildSchedule(halaqa, plan) : null;
  let expectedPage = 0;
  let termSessionsLeft = 0;
  if (schedule && schedule.length) {
    const idx = currentSessionIndex(schedule); // اللقاء القادم (0 = انتهى)
    const passed = idx > 0 ? idx - 1 : schedule.length;
    termSessionsLeft = idx > 0 ? schedule.length - passed : 0;
    const startPage = plan.startSurah
      ? pageOf(surahNumber(plan.startSurah), plan.startAyah || 1)
      : 1;
    const cum = passed > 0 ? schedule[passed - 1].cumHifz : 0;
    expectedPage = startPage + cum - 1;
  }
  const aheadPages = currentPage && expectedPage ? currentPage - expectedPage : 0;

  // وتيرة الحفظ (متوسط أوجه التسميع في اللقاءات التي سُمّع فيها)
  const tasmiLogs = mine.filter((r) => r.tasmi.status === "done");
  const avg =
    tasmiLogs.length > 0
      ? Math.round(
          tasmiLogs.reduce((n, r) => n + faces(r.tasmi), 0) / tasmiLogs.length
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
    const f = faces(r.tasmi);
    if (f > personalBest) personalBest = f;
  }

  // أجزاء مكتملة
  let completedJuz = 0;
  for (let j = 1; j <= 30; j++) if (juzEndPage(j) <= currentPage) completedJuz++;

  return {
    hasData: currentPage > 0,
    currentPage,
    juz,
    juzPct,
    mushafPct,
    pagesToJuzEnd,
    nearJuzEnd,
    expectedPage,
    aheadPages,
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
      unlocked: p.currentPage >= Math.floor(MUSHAF_PAGES / 2),
    },
    {
      key: "khatmah",
      label: "ختمة",
      icon: "🏆",
      unlocked: p.currentPage >= MUSHAF_PAGES,
    },
  ];
}
