/** لائحة الغياب: المسموح ٣ غيابات في الفصل (قرار الإدارة ١٧ سبتمبر ٢٠٢٦).
    نصّ إشعار الغياب يتدرّج حسب ترتيب الغياب — نفس النصّ في إشعار الجهاز (الدالة
    الطرفية almaher-push تحمل نسخة مطابقة) وفي شاشة الجرس داخل التطبيق. */

export const ALLOWED_ABSENCES = 3;

const ar = (n: number) => n.toLocaleString("ar-EG");
const ORD = ["", "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس"];

/** عنوان ونصّ إشعار الغياب رقم n هذا الفصل (n ≥ 1) */
export function absenceMessage(name: string, n: number): { title: string; body: string } {
  const who = name ? ` يا ${name}` : "";
  if (n <= 1) {
    return {
      title: `افتقدناكِ${who} 🤍`,
      body: "سُجّل لكِ غياب عن حلقة اليوم،\nافتقد مجلسُ القرآن حضوركِ 🤍",
    };
  }
  if (n < ALLOWED_ABSENCES) {
    return {
      title: `افتقدناكِ مرة أخرى${who} 🤍`,
      body: "افتقدناكِ في مجلس القرآن، وننتظر حضوركِ القادم بشوق 🤍",
    };
  }
  if (n === ALLOWED_ABSENCES) {
    return {
      title: `تنبيه: الغياب الثالث${who} 🤍`,
      body: "سُجّل لكِ الغياب الثالث، ونودّ التنبيه بأنه آخر غياب مسموح.\nننتظر حضوركِ القادم بكل ودّ 🤍",
    };
  }
  return {
    title: `تجاوزتِ الغياب المسموح${who} ⚠️`,
    body: `هذا غيابكِ ${ORD[n] ?? `رقم ${ar(n)}`} هذا الفصل، والمسموح ${ar(ALLOWED_ABSENCES)} فقط. يُرجى التواصل مع الإدارة في أقرب وقت`,
  };
}

/** تواريخ غياب الطالبة هذا الفصل (من بداية الفصل إن حُدِّدت)، الأحدث أولاً */
export function termAbsenceDates(
  recitations: { studentId: string; attended: boolean; date: string }[],
  studentId: string,
  termStart: string | undefined
): string[] {
  const t = termStart ?? "";
  return recitations
    .filter((r) => r.studentId === studentId && !r.attended && (!t || r.date >= t))
    .map((r) => r.date)
    .sort((a, b) => b.localeCompare(a));
}
