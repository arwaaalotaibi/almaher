"use client";

import { useEffect, useMemo, useState } from "react";
import { STUDENT_PICK_KEY, useApp } from "@/lib/store";
import { computeProgress } from "@/lib/progress";
import { refLabel } from "@/lib/mushaf";
import { ayahCount, SURAHS } from "@/lib/surahs";
import { useHydrated } from "@/components/ui";
import { Memorizer } from "./memorizer";

const ar = (n: number) => n.toLocaleString("ar-EG");

type Pos = { surah: number; ayah: number };
type Preset = "hifz" | "muraja" | "custom";

/** 🎧 مسمّعي: تحفيظ الورد بالاستماع والتكرار — يعرف وردك القادم تلقائياً.
    يُعرض في تبويب «مسمّعي» بصفحة الطالبة، وفي صفحة /memorize */
export function MemorizePanel() {
  const { students, recitations, halaqas } = useApp();
  const hydrated = useHydrated();
  const [myId, setMyId] = useState<string | null>(null);
  const [preset, setPreset] = useState<Preset>("hifz");
  const [cFrom, setCFrom] = useState<Pos>({ surah: 1, ayah: 1 });
  const [cTo, setCTo] = useState<Pos>({ surah: 114, ayah: 6 }); // افتراضياً: المصحف كاملاً من الفاتحة إلى الناس

  useEffect(() => {
    setMyId(window.localStorage.getItem(STUDENT_PICK_KEY));
  }, []);

  const me = students.find((s) => s.id === myId);
  const halaqa = me ? halaqas.find((h) => h.id === me.halaqaId) : undefined;
  const prog = useMemo(
    () => (me ? computeProgress(me, recitations, halaqa) : null),
    [me, recitations, halaqa]
  );

  // ورد الحفظ القادم (بدقة الآية) وورد المراجعة القادمة — يحسبهما محرّك
  // التقدّم في اتجاه حفظ الطالبة (صاعداً أو نازلاً)، وكلاهما بترتيب المصحف
  const hifzRange = prog?.nextHifzRange ?? null;
  const murRange = prog?.nextMurRange ?? null;

  if (!hydrated) return null;

  const range =
    preset === "hifz"
      ? hifzRange
      : preset === "muraja"
        ? murRange
        : cFrom.surah > cTo.surah ||
            (cFrom.surah === cTo.surah && cFrom.ayah > cTo.ayah)
          ? null
          : { from: cFrom, to: cTo };

  const rangeText = (r: { from: Pos; to: Pos } | null) =>
    r ? `${refLabel(r.from.surah, r.from.ayah)} ← ${refLabel(r.to.surah, r.to.ayah)}` : "";
  const presets: { key: Preset; label: string }[] = [
    { key: "hifz", label: "📖 وردي القادم" },
    { key: "muraja", label: "🔁 مراجعتي" },
    { key: "custom", label: "✏️ أختار" },
  ];

  return (
    <div>
      {/* ماذا أسمع؟ */}
      <div className="mb-2 flex gap-1 rounded-2xl bg-cream p-1">
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPreset(p.key)}
            className={`flex-1 rounded-xl py-2 font-kufi text-[13px] font-bold transition ${
              preset === p.key ? "bg-plum-600 text-white shadow" : "text-silver-600"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset !== "custom" && range && (
        <p className="mb-3 text-center text-xs font-bold text-plum-700">📍 {rangeText(range)}</p>
      )}

      {/* المقطع المخصص */}
      {preset === "custom" && (
        <div className="card mb-3 grid gap-2 rounded-2xl p-3">
          {(
            [
              { label: "من", pos: cFrom, set: setCFrom },
              { label: "إلى", pos: cTo, set: setCTo },
            ] as const
          ).map((row) => (
            <div key={row.label} className="grid grid-cols-[2rem_1fr_1fr] items-center gap-2">
              <span className="text-xs font-bold text-plum-700">{row.label}</span>
              <select
                className="rounded-xl border border-cream-dark bg-white px-2 py-2 text-sm font-bold"
                value={row.pos.surah}
                onChange={(e) =>
                  row.set({ surah: Number(e.target.value), ayah: 1 })
                }
              >
                {SURAHS.map((s, i) => (
                  <option key={s} value={i + 1}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                className="rounded-xl border border-cream-dark bg-white px-2 py-2 text-sm font-bold"
                value={row.pos.ayah}
                onChange={(e) =>
                  row.set({ ...row.pos, ayah: Number(e.target.value) })
                }
              >
                {Array.from(
                  { length: Math.max(1, ayahCount(SURAHS[row.pos.surah - 1])) },
                  (_, i) => i + 1
                ).map((n) => (
                  <option key={n} value={n}>
                    آية {ar(n)}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {!range && (
            <p className="text-center text-xs font-bold text-red-600">
              «من» يجب أن تسبق «إلى»
            </p>
          )}
        </div>
      )}

      {range ? (
        <Memorizer
          key={`${preset}-${range.from.surah}-${range.from.ayah}-${range.to.surah}-${range.to.ayah}`}
          from={range.from}
          to={range.to}
        />
      ) : preset !== "custom" ? (
        <div className="card rounded-2xl p-8 text-center">
          <p className="text-3xl">🌱</p>
          <p className="mt-2 font-kufi font-bold text-plum-800">
            {preset === "muraja" ? "لا توجد مراجعة في خطتكِ" : "لم يُحدَّد وردكِ بعد"}
          </p>
          <p className="mt-1 text-sm text-silver-600">
            اختاري «✏️ أختار» لتسمعي أي مقطع تريدينه
          </p>
        </div>
      ) : null}

    </div>
  );
}
