"use client";

import { useEffect, useMemo, useState } from "react";
import { STUDENT_PICK_KEY, useApp } from "@/lib/store";
import { computeProgress } from "@/lib/progress";
import { pageOf, pageStart, refLabel } from "@/lib/mushaf";
import { searchQuran, type SearchHit } from "@/lib/quran-audio";
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
  // 🔍 البحث: كلمة من القرآن أو رقم صفحة
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<{ hits: SearchHit[]; total: number; msg?: string } | null>(null);
  const [startAt, setStartAt] = useState<{ surah: number; ayah: number; n: number } | null>(null);

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

  /** الانتقال إلى آية: المصحف كاملاً في «أختار» والبدء منها */
  const goTo = (pos: Pos) => {
    setPreset("custom");
    if (cFrom.surah !== 1 || cFrom.ayah !== 1) setCFrom({ surah: 1, ayah: 1 });
    if (cTo.surah !== 114 || cTo.ayah !== 6) setCTo({ surah: 114, ayah: 6 });
    setStartAt({ ...pos, n: Date.now() });
    setFound(null);
    // بعد تحميل الصفحة: انزلي إليها
    window.setTimeout(() => {
      const el = document.querySelector(".mushaf-sheet");
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 110, behavior: "smooth" });
    }, 900);
  };

  const runSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = q.trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
    if (!text) return;
    if (/^\d+$/.test(text)) {
      const n = Number(text);
      if (n >= 1 && n <= 604) goTo(pageStart(n));
      else setFound({ hits: [], total: 0, msg: "رقم الصفحة من ١ إلى ٦٠٤" });
      return;
    }
    setBusy(true);
    try {
      const r = await searchQuran(text);
      setFound(r.total ? r : { ...r, msg: "لا توجد نتائج — جرّبي كلمة أخرى" });
    } catch {
      setFound({ hits: [], total: 0, msg: "📡 تعذّر البحث — تأكدي من الإنترنت" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {/* 🔍 البحث */}
      <form onSubmit={runSearch} className="mb-3 flex gap-1.5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔍 كلمة من القرآن أو رقم صفحة"
          className="min-w-0 flex-1 rounded-xl border border-cream-dark bg-white px-3 py-2.5 text-sm font-bold text-ink"
          inputMode="search"
          enterKeyHint="search"
        />
        <button type="submit" className="shrink-0 rounded-xl bg-plum-600 px-4 text-sm font-bold text-white" disabled={busy}>
          {busy ? "…" : "بحث"}
        </button>
      </form>
      {found && (
        <div className="card mb-3 rounded-2xl p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-plum-800">
              {found.msg ?? `${ar(found.total)} آية${found.total > found.hits.length ? ` — أول ${ar(found.hits.length)}` : ""}`}
            </span>
            <button type="button" onClick={() => setFound(null)} className="text-xs font-bold text-silver-600">
              ✕ إغلاق
            </button>
          </div>
          {found.hits.length > 0 && (
            <div className="grid max-h-80 gap-1.5 overflow-y-auto">
              {found.hits.map((h) => (
                <button
                  key={`${h.surah}:${h.ayah}`}
                  type="button"
                  onClick={() => goTo(h)}
                  className="rounded-xl bg-cream/70 px-3 py-2 text-start active:scale-[0.99]"
                >
                  <span className="flex items-center justify-between gap-2 text-[11px] font-bold text-plum-700">
                    <span>📖 {refLabel(h.surah, h.ayah)}</span>
                    <span className="text-silver-600">صفحة {ar(pageOf(h.surah, h.ayah))}</span>
                  </span>
                  <span className="mt-0.5 line-clamp-2 text-sm text-ink">{h.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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
          startAt={preset === "custom" ? startAt : null}
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
