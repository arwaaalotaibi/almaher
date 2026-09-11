"use client";

import { DIRECTIONS, type HifzDirection } from "@/lib/store";

/** زرّان لاختيار الاتجاه: ⬆️ من البقرة / ⬇️ من الناس — للحفظ وللمراجعة */
export function DirectionPicker({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: HifzDirection;
  onChange: (dir: HifzDirection) => void;
  hint?: string;
}) {
  return (
    <div className="mb-3">
      <span className="mb-1 block text-xs font-bold text-plum-700">{label}</span>
      <div className="grid grid-cols-2 gap-2">
        {DIRECTIONS.map((d) => {
          const on = value === d.key;
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => onChange(d.key)}
              className={`rounded-xl border px-3 py-2 text-start transition ${
                on
                  ? "border-plum-600 bg-plum-600 text-white"
                  : "border-cream-dark bg-white text-plum-800"
              }`}
            >
              <span className="block text-sm font-bold">
                {d.icon} {d.label}
              </span>
              <span
                className={`block text-[11px] ${on ? "text-white/80" : "text-silver-600"}`}
              >
                {d.hint}
              </span>
            </button>
          );
        })}
      </div>
      {hint && <p className="mt-1 text-[11px] text-silver-600">{hint}</p>}
    </div>
  );
}
