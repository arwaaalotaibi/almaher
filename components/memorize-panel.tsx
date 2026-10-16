"use client";

import { useEffect, useMemo, useState } from "react";
import { partOn, STUDENT_PICK_KEY, useApp } from "@/lib/store";
import { computeProgress } from "@/lib/progress";
import { refLabel } from "@/lib/mushaf";
import { displayPageOf, displayPageStart } from "@/lib/mushaf-display";
import { searchQuran, type SearchHit } from "@/lib/quran-audio";
import { ayahCount, SURAH_AYAHS, SURAHS } from "@/lib/surahs";
import { useHydrated } from "@/components/ui";
import { Memorizer } from "./memorizer";
import { RUB_STARTS } from "@/lib/quran-rub";

const ar = (n: number) => n.toLocaleString("ar-EG");

type Pos = { surah: number; ayah: number };
type Preset = "hifz" | "tathbit" | "muraja" | "custom";

const before = (a: Pos, b: Pos) => a.surah < b.surah || (a.surah === b.surah && a.ayah < b.ayah);
/** آخر آية قبل موضع (عبر حدود السور) */
const prevAyah = (p: Pos): Pos => (p.ayah > 1 ? { surah: p.surah, ayah: p.ayah - 1 } : { surah: p.surah - 1, ayah: SURAH_AYAHS[p.surah - 2] });

/** 📄 أوجه الورد: لكل صفحة من صفحات المصحف المعروض الجزء الذي يقع منها في الورد */
function wardFaces(r: { from: Pos; to: Pos }): { page: number; from: Pos; to: Pos }[] {
  const p0 = displayPageOf(r.from.surah, r.from.ayah);
  const p1 = displayPageOf(r.to.surah, r.to.ayah);
  if (p1 - p0 > 30) return []; // مقطع طويل جداً (كالمصحف كاملاً): لا أوجه
  const out: { page: number; from: Pos; to: Pos }[] = [];
  for (let p = p0; p <= p1; p++) {
    const start = displayPageStart(p);
    const end = p < 604 ? prevAyah(displayPageStart(p + 1)) : { surah: 114, ayah: 6 };
    const from = before(start, r.from) ? r.from : start;
    const to = before(r.to, end) ? r.to : end;
    if (!before(to, from)) out.push({ page: p, from, to });
  }
  return out;
}

/** 🔁 مقدار التكرار: الورد كاملاً، أو قطعة منه (وجه، وجهان، ربع حزب) */
type Unit = "ward" | "face" | "two" | "rub";
const UNITS: { key: Unit; label: string }[] = [
  { key: "ward", label: "الورد كاملاً" },
  { key: "face", label: "وجه" },
  { key: "two", label: "وجهين" },
  { key: "rub", label: "ربع" },
];
const UNIT_KEY = "almaher-mem-unit";
type Piece = { label: string; from: Pos; to: Pos };

function wardPieces(r: { from: Pos; to: Pos }, unit: Unit): Piece[] {
  if (unit === "ward") return [];
  if (unit === "rub") {
    const out: Piece[] = [];
    for (let i = 0; i < RUB_STARTS.length; i++) {
      const start = { surah: RUB_STARTS[i][0], ayah: RUB_STARTS[i][1] };
      const end = i + 1 < RUB_STARTS.length ? prevAyah({ surah: RUB_STARTS[i + 1][0], ayah: RUB_STARTS[i + 1][1] }) : { surah: 114, ayah: 6 };
      if (before(end, r.from) || before(r.to, start)) continue;
      const from = before(start, r.from) ? r.from : start;
      const to = before(r.to, end) ? r.to : end;
      out.push({ label: `الربع ${ar((i % 4) + 1)} من الحزب ${ar(Math.floor(i / 4) + 1)}`, from, to });
    }
    return out;
  }
  const faces = wardFaces(r);
  if (unit === "face") return faces.map((f, i) => ({ label: `الوجه ${ar(i + 1)} · ص${ar(f.page)}`, from: f.from, to: f.to }));
  const out: Piece[] = [];
  for (let i = 0; i < faces.length; i += 2) {
    const a = faces[i], b = faces[i + 1] ?? faces[i];
    out.push({ label: b === a ? `الوجه ${ar(i + 1)} · ص${ar(a.page)}` : `الوجهان ${ar(i + 1)}–${ar(i + 2)} · ص${ar(a.page)}–${ar(b.page)}`, from: a.from, to: b.to });
  }
  return out;
}

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
  // 🔁 مقدار التكرار وأي قطعة من الورد (يُحفظ المقدار على الجهاز)
  const [unit, setUnitState] = useState<Unit>("ward");
  const [pieceIdx, setPieceIdx] = useState(0);
  useEffect(() => {
    try {
      const u = window.localStorage.getItem(UNIT_KEY) as Unit | null;
      if (u && UNITS.some((x) => x.key === u)) setUnitState(u);
    } catch {
      /* */
    }
  }, []);
  const setUnit = (u: Unit) => {
    setUnitState(u);
    setPieceIdx(0);
    try {
      window.localStorage.setItem(UNIT_KEY, u);
    } catch {
      /* */
    }
  };

  useEffect(() => {
    setMyId(window.localStorage.getItem(STUDENT_PICK_KEY));
  }, []);

  const me = students.find((s) => s.id === myId);
  // من أُلغي عنها الحفظ تبدأ بأول قسم متاح لها
  useEffect(() => {
    if (me && !partOn(me.plan, "hifz") && preset === "hifz")
      setPreset(partOn(me.plan, "tathbit") ? "tathbit" : partOn(me.plan, "murajaah") ? "muraja" : "custom");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);
  const halaqa = me ? halaqas.find((h) => h.id === me.halaqaId) : undefined;
  const prog = useMemo(
    () => (me ? computeProgress(me, recitations, halaqa) : null),
    [me, recitations, halaqa]
  );

  // ورد الحفظ القادم (بدقة الآية) وورد المراجعة القادمة — يحسبهما محرّك
  // التقدّم في اتجاه حفظ الطالبة (صاعداً أو نازلاً)، وكلاهما بترتيب المصحف
  const hifzRange = prog?.nextHifzRange ?? null;
  const murRange = prog?.nextMurRange ?? null;
  const tathRange = prog?.nextTathbitRange ?? null;

  if (!hydrated) return null;

  const wardRange =
    preset === "hifz"
      ? hifzRange
      : preset === "muraja"
        ? murRange
        : preset === "tathbit"
          ? tathRange
        : cFrom.surah > cTo.surah ||
            (cFrom.surah === cTo.surah && cFrom.ayah > cTo.ayah)
          ? null
          : { from: cFrom, to: cTo };
  const pieces = wardRange ? wardPieces(wardRange, unit) : [];
  const piece = pieces.length > 1 ? pieces[Math.min(pieceIdx, pieces.length - 1)] : undefined;
  const range = piece ? { from: piece.from, to: piece.to } : wardRange;

  const rangeText = (r: { from: Pos; to: Pos } | null) =>
    r ? `${refLabel(r.from.surah, r.from.ayah)} ← ${refLabel(r.to.surah, r.to.ayah)}` : "";
  const presets = [
    { key: "hifz", label: "📖 الحفظ" },
    { key: "tathbit", label: "📌 التثبيت" },
    { key: "muraja", label: "🔁 المراجعة" },
    { key: "custom", label: "✏️ أختار" },
  ].filter(
    // الأقسام الملغاة عن الطالبة هذا الفصل لا تظهر
    (p) =>
      (p.key !== "tathbit" || partOn(me?.plan, "tathbit")) &&
      (p.key !== "muraja" || partOn(me?.plan, "murajaah")) &&
      (p.key !== "hifz" || partOn(me?.plan, "hifz"))
  ) as { key: Preset; label: string }[];

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
      if (n >= 1 && n <= 604) goTo(displayPageStart(n));
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

  /** ⚙️ في إعدادات التلاوة: ماذا يتكرر؟ */
  const repeatUi = wardRange ? (
    <div>
      <p className="mb-1.5 text-xs font-bold text-plum-700">🔁 مقدار التكرار</p>
      <div className="grid grid-cols-4 gap-1.5">
        {UNITS.map((u) => (
          <button
            key={u.key}
            type="button"
            onClick={() => setUnit(u.key)}
            className={`rounded-xl py-2 text-sm font-bold ${unit === u.key ? "bg-plum-600 text-white" : "bg-cream text-silver-600"}`}
          >
            {u.label}
          </button>
        ))}
      </div>
      {unit !== "ward" &&
        (pieces.length > 1 ? (
          <select
            value={Math.min(pieceIdx, pieces.length - 1)}
            onChange={(e) => setPieceIdx(Number(e.target.value))}
            className="mt-2 w-full rounded-xl border border-cream-dark bg-white px-3 py-2 text-sm font-bold text-plum-800"
            aria-label="القطعة"
          >
            {pieces.map((pc, i) => (
              <option key={i} value={i}>
                {pc.label} — {rangeText(pc)}
              </option>
            ))}
          </select>
        ) : (
          <p className="mt-1.5 text-[11px] font-bold text-silver-600">وردكِ كله ضمن {unit === "rub" ? "ربع واحد" : unit === "two" ? "وجهين" : "وجه واحد"} — يتكرر الورد كاملاً</p>
        ))}
    </div>
  ) : null;

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
                    <span className="text-silver-600">صفحة {ar(displayPageOf(h.surah, h.ayah))}</span>
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
            onClick={() => {
              setPreset(p.key);
              setPieceIdx(0);
            }}
            className={`flex-1 rounded-xl py-2 font-kufi text-[13px] font-bold transition ${
              preset === p.key ? "bg-plum-600 text-white shadow" : "text-silver-600"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset !== "custom" && wardRange && (
        <p className="mb-2 text-center text-xs font-bold text-plum-700">📍 {rangeText(wardRange)}</p>
      )}

      {piece && (
        <p className="-mt-1 mb-3 text-center text-xs font-bold text-amber-800">
          🔁 يتكرر {piece.label.split(" · ")[0]}: {rangeText(piece)}
        </p>
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
          startAt={preset === "custom" && !piece ? startAt : null}
          initialLoops={piece ? 0 : undefined}
          extraSettings={repeatUi}
        />
      ) : preset !== "custom" ? (
        <div className="card rounded-2xl p-8 text-center">
          <p className="text-3xl">🌱</p>
          <p className="mt-2 font-kufi font-bold text-plum-800">
            {preset === "muraja" ? "لا توجد مراجعة في خطتكِ" : preset === "tathbit" ? "لا يوجد تثبيت بعد — يظهر بعد أول تسميع" : "لم يُحدَّد وردكِ بعد"}
          </p>
          <p className="mt-1 text-sm text-silver-600">
            اختاري «✏️ أختار» لتسمعي أي مقطع تريدينه
          </p>
        </div>
      ) : null}

    </div>
  );
}
