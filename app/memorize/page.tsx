"use client";

import { useEffect, useMemo, useState } from "react";
import { STUDENT_PICK_KEY, useApp } from "@/lib/store";
import { computeProgress } from "@/lib/progress";
import { pageEnd, pageOf, MUSHAF_PAGES, refLabel } from "@/lib/mushaf";
import { ayahCount, SURAHS } from "@/lib/surahs";
import { PageHeader, useHydrated } from "@/components/ui";
import { Memorizer } from "@/components/memorizer";

const ar = (n: number) => n.toLocaleString("ar-EG");

type Pos = { surah: number; ayah: number };
type Preset = "hifz" | "muraja" | "custom";

/** 🎧 مسمّعي: تحفيظ الورد بالاستماع والتكرار — يعرف وردك القادم تلقائياً */
export default function MemorizePage() {
  const { students, recitations, halaqas } = useApp();
  const hydrated = useHydrated();
  const [myId, setMyId] = useState<string | null>(null);
  const [preset, setPreset] = useState<Preset>("hifz");
  const [cFrom, setCFrom] = useState<Pos>({ surah: 1, ayah: 1 });
  const [cTo, setCTo] = useState<Pos>({ surah: 1, ayah: 7 });

  useEffect(() => {
    setMyId(window.localStorage.getItem(STUDENT_PICK_KEY));
  }, []);

  const me = students.find((s) => s.id === myId);
  const halaqa = me ? halaqas.find((h) => h.id === me.halaqaId) : undefined;
  const prog = useMemo(
    () => (me ? computeProgress(me, recitations, halaqa) : null),
    [me, recitations, halaqa]
  );

  // ورد الحفظ القادم (بدقة الآية) وورد المراجعة القادمة
  const hifzRange = useMemo(() => {
    if (!prog?.nextHifzFrom || !prog.nextToPage) return null;
    return { from: prog.nextHifzFrom, to: pageEnd(prog.nextToPage) };
  }, [prog]);

  const murRange = useMemo(() => {
    if (!prog?.nextMurFrom || !me) return null;
    const perM = Math.max(0, Math.round(me.plan.murajaah || 0));
    if (!perM) return null;
    const fromPage = pageOf(prog.nextMurFrom.surah, prog.nextMurFrom.ayah);
    const toPage = Math.min(MUSHAF_PAGES, fromPage + perM - 1);
    return { from: prog.nextMurFrom, to: pageEnd(toPage) };
  }, [prog, me]);

  if (!hydrated) return <main className="mx-auto max-w-2xl px-4 pt-10" />;

  const range =
    preset === "hifz"
      ? hifzRange
      : preset === "muraja"
        ? murRange
        : cFrom.surah > cTo.surah ||
            (cFrom.surah === cTo.surah && cFrom.ayah > cTo.ayah)
          ? null
          : { from: cFrom, to: cTo };

  const presets = [
    hifzRange && {
      key: "hifz" as const,
      label: "📖 وردي القادم",
      sub: `${refLabel(hifzRange.from.surah, hifzRange.from.ayah)} ← ${refLabel(hifzRange.to.surah, hifzRange.to.ayah)}`,
    },
    murRange && {
      key: "muraja" as const,
      label: "🔁 مراجعتي",
      sub: `${refLabel(murRange.from.surah, murRange.from.ayah)} ← ${refLabel(murRange.to.surah, murRange.to.ayah)}`,
    },
    { key: "custom" as const, label: "✏️ مقطع أختاره", sub: "" },
  ].filter(Boolean) as { key: Preset; label: string; sub: string }[];

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-8">
      <PageHeader title="🎧 مسمّعي" back="/" />
      <p className="-mt-2 mb-4 text-sm text-silver-600">
        استمعي لوردك آيةً آية، وكرّري حتى يثبت الحفظ بإذن الله
      </p>

      {/* اختيار الورد */}
      <div className="mb-4 grid gap-2">
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPreset(p.key)}
            className={`rounded-2xl border-2 px-4 py-3 text-start transition ${
              preset === p.key
                ? "border-plum-600 bg-plum-50"
                : "border-cream-dark bg-white"
            }`}
          >
            <span className="font-kufi text-sm font-bold text-plum-800">
              {p.label}
            </span>
            {p.sub && (
              <span className="mt-0.5 block text-xs font-bold text-silver-600">
                {p.sub}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* المقطع المخصص */}
      {preset === "custom" && (
        <div className="card mb-4 grid gap-2 rounded-2xl p-4">
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
            لم يُحدَّد وردك بعد
          </p>
          <p className="mt-1 text-sm text-silver-600">
            أدخلي بداية الحفظ في «بيانات حفظي» أو اختاري مقطعاً بنفسك
          </p>
        </div>
      ) : null}

    </main>
  );
}
