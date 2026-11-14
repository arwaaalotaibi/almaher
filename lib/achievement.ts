/** 📊 قوائم الإنجاز للإدارة — المواظبات، المتقدمات والمتأخرات عن الخطة، والأكثر حفظاً.
    كلها من محرّك التقدّم نفسه (computeProgress) وسجلات التسميع، بلا حساب جديد. */

import { computeProgress, partFaces } from "./progress";
import { buildSchedule, dateKey, EMPTY_PLAN, isDesc, partOn, type Halaqa, type RecitationLog, type Student } from "./store";

export interface AchievementRow {
  st: Student;
  halaqa?: Halaqa;
  /** لقاءات الحلقة التي مضت من الفصل */
  meetings: number;
  attended: number;
  absent: number;
  /** لقاءات مضت ولم تُسجَّل لها (لا حضوراً ولا غياباً) */
  unlogged: number;
  /** 🌟 مواظبة: كل اللقاءات الماضية مسجّلة حضوراً */
  perfect: boolean;
  /** + متقدمة، − متأخرة عن الخطة (أوجه) */
  aheadHifz: number;
  aheadMur: number;
  hasHifzPlan: boolean;
  hasMurPlan: boolean;
  /** مجموع أوجه الحفظ الجديد المسمَّعة هذا الفصل */
  hifzFaces: number;
}

export function achievementRows(
  students: Student[],
  halaqas: Halaqa[],
  recitations: RecitationLog[],
  today = dateKey(new Date())
): AchievementRow[] {
  const byStudent = new Map<string, RecitationLog[]>();
  for (const r of recitations) {
    const list = byStudent.get(r.studentId);
    if (list) list.push(r);
    else byStudent.set(r.studentId, [r]);
  }
  const pastDates = new Map<string, string[]>(); // لقاءات كل حلقة حتى اليوم
  for (const h of halaqas)
    pastDates.set(
      h.id,
      (buildSchedule(h, EMPTY_PLAN) ?? []).map((r) => dateKey(r.date)).filter((d) => d <= today)
    );

  return students.map((st) => {
    const halaqa = halaqas.find((h) => h.id === st.halaqaId);
    const mine = (byStudent.get(st.id) ?? []).filter((r) => !halaqa?.termStart || r.date >= halaqa.termStart);
    const byDate = new Map<string, RecitationLog>();
    // إن تكرّر سجلّ اليوم يُعتمد الأحدث
    for (const r of [...mine].sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""))) byDate.set(r.date, r);
    // لقاء اليوم لا يُحسب قبل تسجيله (الحلقة قد لا تكون انعقدت بعد)
    const dates = (pastDates.get(st.halaqaId) ?? []).filter((d) => d < today || byDate.has(d));
    let attended = 0;
    let absent = 0;
    let unlogged = 0;
    for (const d of dates) {
      const log = byDate.get(d);
      if (!log) unlogged++;
      else if (log.attended) attended++;
      else absent++;
    }
    const p = computeProgress(st, mine, halaqa);
    const d = isDesc(st.plan);
    const hifzFaces = [...byDate.values()]
      .filter((r) => r.attended && r.tasmi.status === "done")
      .reduce((n, r) => n + (r.faces?.tasmi ?? partFaces(r.tasmi, d)), 0);
    return {
      st,
      halaqa,
      meetings: dates.length,
      attended,
      absent,
      unlogged,
      perfect: dates.length > 0 && attended === dates.length,
      aheadHifz: p.aheadPages,
      aheadMur: p.hasMurPlan ? p.aheadMurPages : 0,
      hasHifzPlan: partOn(st.plan, "hifz") && (st.plan.hifz || 0) > 0 && !!st.plan.startSurah,
      hasMurPlan: p.hasMurPlan,
      hifzFaces: Math.round(hifzFaces * 4) / 4,
    };
  });
}
