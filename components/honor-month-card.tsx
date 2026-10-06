"use client";

import { useState } from "react";
import { actions, halaqaTitle, useApp, type Halaqa, type Student } from "@/lib/store";

const ar = (n: number) => n.toLocaleString("ar-EG");

export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("ar-u-ca-gregory-nu-arab", { month: "long", year: "numeric" });
};

/** 🏆 لوحة الشرف الشهرية — المعلّمة تختار طالبة أو أكثر من طالباتها لكل شهر.
    بجانب كل اسم عدد مرات «متميزة اللقاء» في الشهر نفسه، ليسهل الاختيار. */
export function HonorMonthCard({
  teacherId,
  sections,
}: {
  teacherId: string;
  sections: { halaqa: Halaqa; list: Student[] }[];
}) {
  const { honors } = useApp();
  const now = new Date();
  const thisMonth = monthKey(now);
  const lastMonth = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const [month, setMonth] = useState(thisMonth);
  const [open, setOpen] = useState(false);

  const all = honors ?? [];
  const picked = (id: string) => all.some((x) => x.kind === "month" && x.period === month && x.studentId === id);
  const weekCount = (id: string) => all.filter((x) => x.kind === "week" && x.studentId === id && x.period.startsWith(month)).length;
  const myCount = all.filter((x) => x.kind === "month" && x.period === month && x.teacherId === teacherId).length;
  const live = sections.filter((s) => s.list.length);
  if (!live.length) return null;

  return (
    <div className="card mb-4 overflow-hidden rounded-2xl">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-start">
        <span>
          <span className="block font-kufi text-base font-bold text-plum-800">🏆 لوحة الشرف — {monthLabel(month)}</span>
          <span className="block text-xs font-bold text-silver-600">
            {myCount ? `✓ اخترتِ ${ar(myCount)}` : "اختاري طالبة أو أكثر تميّزت هذا الشهر"}
          </span>
        </span>
        <span className={`text-plum-600 transition ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="border-t border-cream-dark px-4 pb-4 pt-3">
          <div className="mb-3 flex gap-1 rounded-xl bg-cream p-1">
            {[
              { k: thisMonth, l: `هذا الشهر (${monthLabel(thisMonth)})` },
              { k: lastMonth, l: `الشهر الماضي` },
            ].map((o) => (
              <button
                key={o.k}
                type="button"
                onClick={() => setMonth(o.k)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-bold ${month === o.k ? "bg-white text-plum-800 shadow-sm" : "text-silver-600"}`}
              >
                {o.l}
              </button>
            ))}
          </div>
          {live.map(({ halaqa, list }) => (
            <div key={halaqa.id} className="mb-3 last:mb-0">
              {live.length > 1 && <p className="mb-1.5 text-xs font-bold text-plum-600">🕌 {halaqaTitle(halaqa)}</p>}
              <div className="flex flex-wrap gap-1.5">
                {list.map((s) => {
                  const on = picked(s.id);
                  const w = weekCount(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => actions.toggleMonthHonor(halaqa.id, month, teacherId, s.id)}
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
          ))}
          <p className="mt-3 text-[11px] font-bold text-silver-600">🏅 الرقم = مرات «متميزة اللقاء» هذا الشهر · الاختيار يُحفظ فوراً</p>
        </div>
      )}
    </div>
  );
}
