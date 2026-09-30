/* ================== 👩‍🏫 متابعة المعلّمات ==================
   لكل معلّمة: اللقاءات التي مضت ولم تُسجَّل لطالباتها (بالأسماء)، وحالة لقاء اليوم،
   ورسالة واتساب جاهزة بالناقص. «مضى» = تاريخ اللقاء قبل اليوم؛ لقاء اليوم يُعرض وحده. */

import {
  activeStudents,
  buildSchedule,
  dateKey,
  EMPTY_PLAN,
  formatSchedDate,
  halaqaTitle,
  teacherCodeLink,
  type Halaqa,
  type RecitationLog,
  type Student,
  type Teacher,
} from "./store";

export interface MissingSession {
  n: number; // رقم اللقاء
  date: string; // yyyy-mm-dd
  dateLabel: string;
  total: number; // طالباتها في الحلقة
  names: string[]; // من لم يُسجَّل لها
}

export interface HalaqaFollowup {
  halaqa: Halaqa;
  students: number;
  missing: MissingSession[];
  today?: { n: number; recorded: number; total: number };
}

export interface TeacherFollowup {
  teacher: Teacher;
  students: number;
  missingCount: number; // مجموع السجلات الناقصة في اللقاءات الماضية
  expected: number; // مجموع السجلات المطلوبة في اللقاءات الماضية
  halaqas: HalaqaFollowup[];
}

export function teacherFollowups(
  teachers: Teacher[],
  halaqas: Halaqa[],
  allStudents: Student[],
  recitations: Pick<RecitationLog, "studentId" | "date">[],
  today = dateKey(new Date())
): TeacherFollowup[] {
  const students = activeStudents(allStudents);
  const logged = new Set(recitations.map((r) => `${r.studentId}|${r.date}`));

  return teachers
    .map((teacher) => {
      const mine = students.filter((s) => s.teacherId === teacher.id);
      const out: HalaqaFollowup[] = [];
      let missingCount = 0;
      let expected = 0;
      for (const h of halaqas) {
        const list = mine.filter((s) => s.halaqaId === h.id);
        if (!list.length) continue;
        const rows = buildSchedule(h, EMPTY_PLAN) ?? [];
        const missing: MissingSession[] = [];
        let todayInfo: HalaqaFollowup["today"];
        for (const r of rows) {
          const key = dateKey(r.date);
          if (key > today) break;
          const names = list.filter((s) => !logged.has(`${s.id}|${key}`)).map((s) => s.name);
          if (key === today) {
            todayInfo = { n: r.n, recorded: list.length - names.length, total: list.length };
            continue;
          }
          expected += list.length;
          if (names.length) {
            missingCount += names.length;
            missing.push({ n: r.n, date: key, dateLabel: formatSchedDate(r.date), total: list.length, names });
          }
        }
        out.push({ halaqa: h, students: list.length, missing, today: todayInfo });
      }
      return { teacher, students: mine.length, missingCount, expected, halaqas: out };
    })
    .filter((f) => f.students > 0)
    .sort((a, b) => b.missingCount - a.missingCount || a.teacher.name.localeCompare(b.teacher.name));
}

const ar = (n: number) => n.toLocaleString("ar-EG");

/** رسالة واتساب للمعلّمة بما ينقصها — الأقدم أولاً، مع رابط دخولها.
    الحلقة المشتركة (sharers): تُخاطَب المعلّمات اللاتي يدخلنها، بلا رابط (كلٌّ تدخل من رابطها) */
export function followupMessage(f: TeacherFollowup, sharers: string[] = []): string {
  const many = sharers.length > 1; // مخاطبة الجمع في الحلقة المشتركة
  const who = sharers.length ? sharers.map((n) => `أبلة ${n}`).join(" و") : `أبلة ${f.teacher.name}`;
  const lines: string[] = [
    "السلام عليكم ورحمة الله 🌷",
    many ? `${who}، جزاكنّ الله خيراً على جهودكنّ 🤍` : `${who}، جزاكِ الله خيراً على جهودكِ 🤍`,
  ];
  if (sharers.length) lines.push(`حلقتكنّ المشتركة «${f.teacher.name}» — تسجّلها كل واحدة من رابطها.`);
  lines.push("باقي تسجيل هذه اللقاءات في الماهر:");
  for (const h of f.halaqas) {
    if (!h.missing.length) continue;
    lines.push("", `🕌 ${halaqaTitle(h.halaqa)}`);
    for (const m of h.missing) {
      const names =
        m.names.length === m.total ? `كل الطالبات (${ar(m.total)})` : m.names.join("، ");
      lines.push(`• لقاء ${ar(m.n)} (${m.dateLabel}): ${names}`);
    }
  }
  lines.push(
    "",
    "🔒 الأقدم أولاً — لا يُفتح اللقاء التالي للطالبة قبل تسجيل ما قبله (حضوراً أو غياباً)."
  );
  // الحلقة المشتركة بلا رابط: كلٌّ تدخل من رابطها الخاص
  const link = !sharers.length && f.teacher.code ? teacherCodeLink(f.teacher.code) : "";
  if (link) lines.push(`🔗 رابطكِ: ${link}`);
  return lines.join("\n");
}

/** نص مختصر لإشعار الجوال (الرسالة الكاملة أطول من الإشعار) */
export function followupPushText(f: TeacherFollowup): string {
  const parts = f.halaqas
    .filter((h) => h.missing.length)
    .map(
      (h) =>
        `${h.halaqa.mosque}: ` +
        h.missing.map((m) => `لقاء ${ar(m.n)} (${ar(m.names.length)})`).join("، ")
    );
  return `باقي تسجيل: ${parts.join(" · ")}\nسجّلي الأقدم أولاً 🔒 — جزاكِ الله خيراً 🤍`;
}
