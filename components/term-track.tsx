"use client";

import { formatSchedDate, type Milestone, type ScheduleRow } from "@/lib/store";
import { daysLabel } from "@/lib/arabic";

const ar = (n: number) => n.toLocaleString("ar-EG");

/** مسار الفصل: لقاءات الحلقة نقاطاً، ثم المحطتان الذهبيتان (السرد ثم الاختبار)
    مع عدّ تنازلي بالأيام — يُعرض على درب الحفظ عند الطالبة. */
export function TermTrack({
  schedule,
  passed,
  milestones,
}: {
  schedule: ScheduleRow[] | null;
  passed: number; // لقاءات مضت (لتذهيب نقاطها)
  milestones: Milestone[];
}) {
  if (!milestones.length) return null;
  const today0 = new Date().setHours(0, 0, 0, 0);
  const daysTo = (d: Date) =>
    Math.round((new Date(d).setHours(0, 0, 0, 0) - today0) / 86400000);
  const n = schedule?.length ?? 0;
  // أقرب محطة لم تحن بعد — هي التي تنبض
  const nextKey = milestones.find((m) => daysTo(m.date) >= 0)?.key;

  return (
    <div className="border-t border-cream-dark px-3 py-3">
      <p className="mb-2 text-center text-[11px] font-bold text-plum-700">
        🗓️ مسار الفصل — {n > 0 ? `${ar(n)} لقاءً ثم ` : ""}
        {milestones.map((m) => m.label).join(" ثم ")}
      </p>
      <div className="flex items-stretch gap-2">
        {/* نقاط اللقاءات */}
        {n > 0 && (
          <div className="flex min-w-0 flex-1 items-center">
            <div className="flex w-full items-center justify-between">
              {Array.from({ length: n }, (_, i) => {
                const done = i < passed;
                const isCur = i === passed;
                return (
                  <span
                    key={i}
                    title={`لقاء ${ar(i + 1)}`}
                    className={`block h-2.5 w-2.5 shrink-0 rounded-full ${
                      isCur ? "jm-pulse ring-2 ring-plum-300" : ""
                    }`}
                    style={{
                      backgroundColor: done ? "#a8894f" : isCur ? "#5d3f4e" : "#e6ddcf",
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* المحطتان الذهبيتان */}
        {milestones.map((m) => {
          const d = daysTo(m.date);
          const isNext = m.key === nextKey;
          const chip =
            d < 0 ? "تمّ ✓" : d === 0 ? "اليوم! 🎉" : `باقي ${daysLabel(d)}`;
          return (
            <div
              key={m.key}
              className={`flex shrink-0 flex-col items-center rounded-xl border px-2.5 py-1.5 text-center ${
                isNext ? "jm-float" : ""
              }`}
              style={{
                borderColor: "#e7c873",
                background: d < 0
                  ? "#f6f1e7"
                  : "linear-gradient(180deg,#fff8e1,#f3e2a8)",
                opacity: d < 0 ? 0.7 : 1,
              }}
            >
              <span className="text-lg leading-none">{m.icon}</span>
              <span className="mt-0.5 font-kufi text-[11px] font-bold text-plum-800">
                {m.label}
              </span>
              <span className="text-[10px] text-silver-600">
                {formatSchedDate(m.date)}
              </span>
              <span
                className="mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                style={{ backgroundColor: d < 0 ? "#a9a09a" : "#a8894f" }}
              >
                {chip}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
