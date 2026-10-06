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

/** اللوحة الحالية: آخر لوحة انتهت لقاءاتها (وقت اختيار أسمائها)، وقبل انتهاء الأولى: الأولى */
export function currentBoard(boards: HonorBoard[], today = dateKey(new Date())): HonorBoard | undefined {
  return [...boards].reverse().find((b) => b.endDate <= today) ?? boards[0];
}

/** 🏆 لوحة الشرف — المعلّمة تختار طالبة أو أكثر لكل لوحة (كل ٤ لقاءات).
    بجانب كل اسم عدد مرات «متميزة اللقاء» في لقاءات هذه اللوحة، ليسهل الاختيار. */
export function HonorMonthCard({
  teacherId,
  sections,
}: {
  teacherId: string;
  sections: { halaqa: Halaqa; list: Student[] }[];
}) {
  const { honors } = useApp();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<Record<string, number>>({}); // حلقة ← رقم اللوحة المعروضة
  const all = honors ?? [];
  const live = sections
    .filter((s) => s.list.length)
    .map((s) => {
      const boards = honorBoards(s.halaqa);
      const cur = currentBoard(boards);
      const board = boards.find((b) => b.n === (chosen[s.halaqa.id] ?? cur?.n)) ?? cur;
      return { ...s, boards, cur, board };
    })
    .filter((s) => s.board);
  if (!live.length) return null;

  const picked = (key: string, id: string) => all.some((x) => x.kind === "month" && x.period === key && x.studentId === id);
  const myCount = live.reduce(
    (n, s) => n + all.filter((x) => x.kind === "month" && x.period === s.board!.key && x.teacherId === teacherId).length,
    0
  );
  const headBoard = live[0].board!;

  return (
    <div className="card mb-4 overflow-hidden rounded-2xl">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-start">
        <span>
          <span className="block font-kufi text-base font-bold text-plum-800">
            🏆 {live.length === 1 ? headBoard.title : "لوحة الشرف"}
          </span>
          <span className="block text-xs font-bold text-silver-600">
            {myCount ? `✓ اخترتِ ${ar(myCount)}` : "اختاري طالبة أو أكثر تميّزت في هذه اللقاءات"}
            {live.length === 1 && ` · ${boardRange(headBoard)}`}
          </span>
        </span>
        <span className={`text-plum-600 transition ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="border-t border-cream-dark px-4 pb-4 pt-3">
          {live.map(({ halaqa, list, boards, board }) => {
            const b = board!;
            const weekCount = (id: string) => all.filter((x) => x.kind === "week" && x.studentId === id && b.dates.includes(x.period)).length;
            return (
              <div key={halaqa.id} className="mb-4 last:mb-0">
                {live.length > 1 && <p className="mb-1.5 text-xs font-bold text-plum-600">🕌 {halaqaTitle(halaqa)}</p>}
                {/* اختيار اللوحة */}
                <div className="mb-2 flex gap-1 rounded-xl bg-cream p-1">
                  {boards.map((o) => (
                    <button
                      key={o.n}
                      type="button"
                      onClick={() => setChosen((c) => ({ ...c, [halaqa.id]: o.n }))}
                      className={`flex-1 rounded-lg px-1 py-1.5 text-[11px] font-bold leading-tight ${
                        b.n === o.n ? "bg-white text-plum-800 shadow-sm" : "text-silver-600"
                      }`}
                    >
                      {o.title.replace("لوحة الشرف ", "")}
                      <span className="block text-[10px] font-bold opacity-70">{boardRange(o)}</span>
                    </button>
                  ))}
                </div>
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
