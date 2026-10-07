"use client";

import { useState } from "react";
import {
  actions,
  buildSchedule,
  dateKey,
  EMPTY_PLAN,
  halaqaTitle,
  useApp,
  type Halaqa,
  type Student,
} from "@/lib/store";

const ar = (n: number) => n.toLocaleString("ar-EG");
const ORD = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة"];

/** 🏆 لوحات الشرف في الفصل: الأولى بعد ٤ لقاءات، والثانية بعد ٤ أخرى، والأخيرة بعد آخر لقاء */
export interface HonorBoard {
  n: number; // ١، ٢، ٣
  key: string; // يُحفظ في period: «بداية الفصل#رقم اللوحة»
  title: string; // «لوحة الشرف الأولى»
  from: number; // أول لقاء فيها
  to: number; // آخر لقاء فيها
  dates: string[]; // تواريخ لقاءاتها (yyyy-mm-dd)
  endDate: string; // تاريخ آخر لقاء فيها
}

export function honorBoards(h: Pick<Halaqa, "day" | "termStart" | "termSessions">): HonorBoard[] {
  const rows = buildSchedule(h, EMPTY_PLAN) ?? [];
  if (!rows.length) return [];
  const out: HonorBoard[] = [];
  for (let start = 0, n = 1; start < rows.length; n++) {
    // الأولى: أول ٤ لقاءات · الثانية: ٤ بعدها · الثالثة: ما بقي حتى آخر لقاء
    const size = n >= 3 ? rows.length - start : Math.min(4, rows.length - start);
    const slice = rows.slice(start, start + size);
    const dates = slice.map((r) => dateKey(r.date));
    out.push({
      n,
      key: `${h.termStart}#${n}`,
      title: `لوحة الشرف ${ORD[n - 1] ?? ar(n)}`,
      from: slice[0].n,
      to: slice[slice.length - 1].n,
      dates,
      endDate: dates[dates.length - 1],
    });
    start += size;
  }
  return out;
}

export const boardRange = (b: HonorBoard) => (b.from === b.to ? `لقاء ${ar(b.from)}` : `اللقاءات ${ar(b.from)}–${ar(b.to)}`);

/** اللوحة المفتوحة للاختيار: آخر لوحة حلّ يوم آخر لقاء فيها (بالتاريخ، لا بالتسجيل) —
    تبقى مفتوحة حتى يحلّ موعد التي بعدها. قبل يوم اللقاء ٤: لا لوحة مفتوحة */
export function openBoard(boards: HonorBoard[], today = dateKey(new Date())): HonorBoard | undefined {
  return [...boards].reverse().find((b) => b.endDate <= today);
}
/** للإدارة: اللوحة المفتوحة، وإلا الأولى */
export function currentBoard(boards: HonorBoard[], today = dateKey(new Date())): HonorBoard | undefined {
  return openBoard(boards, today) ?? boards[0];
}

const dayLabel = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("ar-u-ca-gregory-nu-arab", { weekday: "long", day: "numeric", month: "long" });

/** 🏆 لوحة الشرف — لوحة واحدة مفتوحة فقط: تُفتح تلقائياً يوم آخر لقاء فيها
    (الأولى يوم اللقاء ٤، الثانية يوم ٨، الثالثة يوم الأخير) وتبقى حتى تُفتح التي بعدها. بجانب كل اسم عدد مرات «متميزة اللقاء» في لقاءاتها. */
export function HonorMonthCard({
  teacherId,
  sections,
}: {
  teacherId: string;
  sections: { halaqa: Halaqa; list: Student[] }[];
}) {
  const { honors } = useApp();
  const [open, setOpen] = useState(false);
  const all = honors ?? [];
  // تُفتح تلقائياً يوم آخر لقاء فيها (الرابع، الثامن، الأخير) — دون اشتراط تسجيل اللقاءات
  const rows = sections
    .filter((s) => s.list.length)
    .map((s) => {
      const boards = honorBoards(s.halaqa);
      return { ...s, boards, board: openBoard(boards) };
    })
    .filter((s) => s.boards.length);
  if (!rows.length) return null;
  const live = rows.filter((s) => s.board);

  // لم تُفتح الأولى بعد: موعد فتحها فقط
  if (!live.length) {
    const first = rows[0].boards[0];
    return (
      <div className="card mb-4 rounded-2xl px-4 py-3">
        <p className="font-kufi text-sm font-bold text-plum-800">🏆 {first.title}</p>
        <p className="text-xs font-bold text-silver-600">
          🔒 تُفتح للاختيار يوم اللقاء {ar(first.to)} — {dayLabel(first.endDate)}
        </p>
      </div>
    );
  }

  const picked = (key: string, id: string) => all.some((x) => x.kind === "month" && x.period === key && x.studentId === id);
  const myCount = live.reduce(
    (n, s) => n + all.filter((x) => x.kind === "month" && x.period === s.board!.key && x.teacherId === teacherId).length,
    0
  );
  const head = live[0].board!;
  const sameBoard = live.every((s) => s.board!.n === head.n);

  return (
    <div className="card mb-4 overflow-hidden rounded-2xl border-2 border-amber-200">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-start">
        <span>
          <span className="block font-kufi text-base font-bold text-plum-800">🏆 {sameBoard ? head.title : "لوحة الشرف"}</span>
          <span className="block text-xs font-bold text-silver-600">
            {myCount ? `✓ اخترتِ ${ar(myCount)}` : "اختاري طالبة أو أكثر تميّزت في هذه اللقاءات"}
            {live.length === 1 && ` · ${boardRange(head)}`}
          </span>
        </span>
        <span className={`text-plum-600 transition ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="border-t border-cream-dark px-4 pb-4 pt-3">
          {live.map(({ halaqa, list, board }) => {
            const b = board!;
            const weekCount = (id: string) => all.filter((x) => x.kind === "week" && x.studentId === id && b.dates.includes(x.period)).length;
            return (
              <div key={halaqa.id} className="mb-4 last:mb-0">
                <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
                  {live.length > 1 && <>🕌 {halaqaTitle(halaqa)} · </>}🏆 {b.title} — {boardRange(b)}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((s) => {
                    const on = picked(b.key, s.id);
                    const w = weekCount(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => actions.toggleMonthHonor(halaqa.id, b.key, teacherId, s.id)}
                        className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                          on ? "bg-plum-600 text-white shadow" : "bg-cream text-plum-800"
                        }`}
                      >
                        {on ? "🏆 " : ""}
                        {s.name.split(" ").slice(0, 2).join(" ")}
                        {w > 0 && <span className={`ms-1 ${on ? "text-amber-200" : "text-amber-600"}`}>🏅{ar(w)}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <p className="mt-3 text-[11px] font-bold text-silver-600">🏅 الرقم = مرات «متميزة اللقاء» في لقاءات هذه اللوحة · الاختيار يُحفظ فوراً</p>
        </div>
      )}
    </div>
  );
}
