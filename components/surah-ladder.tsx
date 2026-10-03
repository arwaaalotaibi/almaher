"use client";

import { useEffect, useMemo, useState } from "react";
import { surahName } from "@/lib/mushaf";
import { surahLastAyah } from "@/lib/hifz-path";

/* ================== 🪜 سُلّم حفظي ==================
   مظهر ثالث لرحلة الحفظ: كل سورة درجة، والطالبة تصعد درجة بإتمام كل سورة.
   الدرجات الملوّنة تحت = ما أتمّته، والحالية تمتلئ بالآيات، والباهتة فوق = القادمة،
   و🚩 على سورة هدف الفصل. نجمة لطيفة تقف عند درجتها وتقفز عند إتمام سورة جديدة
   (مرة واحدة لكل سورة، محفوظ على الجهاز). */

const ar = (n: number) => n.toLocaleString("ar-EG");
const TOTAL = 114;

export function surahCountLabel(n: number): string {
  if (n === 1) return "سورة واحدة";
  if (n === 2) return "سورتان";
  if (n >= 3 && n <= 10) return `${ar(n)} سور`;
  return `${ar(n)} سورة`;
}
function ayahCountLabel(n: number): string {
  if (n === 1) return "آية واحدة";
  if (n === 2) return "آيتان";
  if (n >= 3 && n <= 10) return `${ar(n)} آيات`;
  return `${ar(n)} آية`;
}

/** موضع الطالبة على السلّم. k = ترتيب الدرجة (0 = أول سورة في اتجاه حفظها) */
export interface LadderPos {
  desc: boolean;
  curK: number; // درجة السورة الحالية (= عدد السور المكتملة قبلها) — 114 = بلغت آخر السلّم
  ayahsDone: number; // آيات السورة الحالية المحفوظة
}

export function ladderPos(from: { surah: number; ayah: number } | null | undefined, desc: boolean): LadderPos {
  if (!from) return { desc, curK: TOTAL, ayahsDone: 0 };
  return { desc, curK: desc ? TOTAL - from.surah : from.surah - 1, ayahsDone: Math.max(0, from.ayah - 1) };
}

const PASTEL = ["#b8ecd7", "#ffd1dc", "#e2d4ff", "#ffe0b8", "#c9e8ff"];
const CONF = ["#ff8fab", "#ffd45e", "#8fd3ff", "#b8ecd7", "#c7a6ff", "#ffb46b"];

type Row =
  | { kind: "done"; k: number }
  | { kind: "cur"; k: number }
  | { kind: "todo"; k: number; fade: number; goal: boolean }
  | { kind: "fold"; n: number; fade: number };

export function Mascot({ size = 46 }: { size?: number }) {
  return (
    <svg viewBox="-60 -60 120 120" width={size} height={size} aria-hidden>
      <defs>
        <radialGradient id="sl-g" cx="40%" cy="35%">
          <stop offset="0" stopColor="#fff6c4" />
          <stop offset=".6" stopColor="#ffd45e" />
          <stop offset="1" stopColor="#f5b02e" />
        </radialGradient>
      </defs>
      <path
        d="M0,-52 L14,-17 L51,-16 L22,8 L32,45 L0,24 L-32,45 L-22,8 L-51,-16 L-14,-17 Z"
        fill="url(#sl-g)"
        stroke="#e8981f"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <g className="sl-blink">
        <ellipse cx="-11" cy="-4" rx="5" ry="7" fill="#4d3340" />
        <ellipse cx="11" cy="-4" rx="5" ry="7" fill="#4d3340" />
        <circle cx="-9" cy="-7" r="2" fill="#fff" />
        <circle cx="13" cy="-7" r="2" fill="#fff" />
      </g>
      <ellipse cx="-21" cy="8" rx="6" ry="4" fill="#ff8fab" opacity=".7" />
      <ellipse cx="21" cy="8" rx="6" ry="4" fill="#ff8fab" opacity=".7" />
      <path d="M-8,9 Q0,18 8,9" fill="none" stroke="#4d3340" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function SurahLadder({
  pos,
  goalSurah,
  studentId,
}: {
  pos: LadderPos;
  goalSurah?: number; // سورة هدف الفصل (0 = بلا هدف)
  studentId?: string;
}) {
  const { desc, curK, ayahsDone } = pos;
  const surahAt = (k: number) => (desc ? TOTAL - k : k + 1);
  const nameAt = (k: number) => surahName(surahAt(k));
  const goalK = goalSurah ? (desc ? TOTAL - goalSurah : goalSurah - 1) : -1;
  const [showAll, setShowAll] = useState(false);

  // 🎉 احتفال عند إتمام سورة جديدة (مرة واحدة لكل درجة، لكل جهاز)
  const [party, setParty] = useState<{ from: number } | null>(null);
  useEffect(() => {
    if (!studentId) return;
    const key = `almaher-ladder:${studentId}`;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(key);
      window.localStorage.setItem(key, String(curK));
    } catch {
      return;
    }
    if (stored !== null && curK > Number(stored) && Number(stored) >= 0) {
      setParty({ from: Number(stored) });
      const t = setTimeout(() => setParty(null), 5200);
      return () => clearTimeout(t);
    }
  }, [studentId, curK]);

  const rows = useMemo(() => {
    const up: Row[] = []; // من الأسفل إلى الأعلى
    for (let k = Math.max(0, curK - 2); k < curK; k++) up.push({ kind: "done", k });
    if (curK < TOTAL) up.push({ kind: "cur", k: curK });
    const last = TOTAL - 1;
    const fadeOf = (j: number) => Math.max(0.45, 1 - (j - 1) * 0.12);
    let j = 0;
    const pushTodo = (k: number) => {
      j++;
      up.push({ kind: "todo", k, fade: k === goalK ? 1 : fadeOf(j), goal: k === goalK });
    };
    if (curK < last) {
      if (goalK > curK && goalK - curK > 7) {
        for (let k = curK + 1; k <= curK + 4; k++) pushTodo(k);
        j++;
        up.push({ kind: "fold", n: goalK - curK - 5, fade: fadeOf(j) });
        pushTodo(goalK);
        if (goalK < last) pushTodo(goalK + 1);
      } else {
        const top = Math.min(last, goalK > curK ? goalK + 1 : curK + 5);
        for (let k = curK + 1; k <= top; k++) pushTodo(k);
      }
    }
    return up;
  }, [curK, goalK]);

  const topK = (() => {
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i];
      if (r.kind !== "fold") return r.k;
    }
    return curK;
  })();
  const restAbove = TOTAL - 1 - topK;
  const curTotal = curK < TOTAL ? surahLastAyah(surahAt(curK)) : 0;
  const pct = curTotal ? Math.min(1, ayahsDone / curTotal) : 0;
  const finished = curK >= TOTAL;
  const goalReached = goalK >= 0 && curK > goalK;
  const celebrating = !!party;

  // قصاصات — تُولَّد عند الاحتفال فقط
  const pieces = useMemo(
    () =>
      celebrating
        ? Array.from({ length: 28 }, (_, i) => ({
            left: Math.random() * 100,
            delay: 1.6 + Math.random() * 0.7,
            dur: 1.8 + Math.random() * 1.1,
            color: CONF[i % CONF.length],
            size: 6 + Math.random() * 5,
          }))
        : [],
    [celebrating]
  );

  const GAP = 46;
  const display = [...rows].reverse(); // من الأعلى للأسفل

  return (
    <div className="relative">
      <div className="sl-sky relative overflow-hidden px-2 pb-3 pt-3">
        {/* ☀️ ☁️ ✦ */}
        <div
          className="pointer-events-none absolute left-4 top-3 h-12 w-12 rounded-full"
          style={{ background: "radial-gradient(circle,#fff6c4,#ffd96a 60%,#ffc94a)", boxShadow: "0 0 24px #ffd96a99" }}
        />
        {[
          { top: 18, w: 70, h: 22, dur: 38, delay: -6 },
          { top: 120, w: 54, h: 18, dur: 30, delay: -20 },
          { top: 250, w: 62, h: 20, dur: 44, delay: -2 },
        ].map((c, i) => (
          <span
            key={i}
            className="sl-cloud pointer-events-none"
            style={{ top: c.top, left: 0, width: c.w, height: c.h, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` }}
          />
        ))}
        {[
          [8, 22], [88, 40], [14, 62], [92, 78], [6, 90],
        ].map(([x, y], i) => (
          <span
            key={i}
            className="sl-twinkle pointer-events-none absolute text-xs text-amber-300"
            style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.5}s` }}
          >
            ✦
          </span>
        ))}

        {restAbove > 0 && (
          <p className="relative mb-1.5 text-center text-[11px] font-bold text-silver-600">
            ⬆️ و<span className="text-gold">{surahCountLabel(restAbove)}</span> أخرى حتى {nameAt(TOTAL - 1)} — بإذن الله
          </p>
        )}
        {finished && (
          <p className="relative mb-1.5 text-center font-kufi text-sm font-bold text-gold">
            🏆 ما شاء الله! بلغتِ آخر السلّم
          </p>
        )}

        {/* السلّم */}
        <div className="relative mx-auto w-[52%] min-w-[170px] max-w-[220px]">
          <span className="sl-rail absolute -bottom-1 -top-1 left-0 w-2.5 rounded-full" />
          <span className="sl-rail absolute -bottom-1 -top-1 right-0 w-2.5 rounded-full" />
          {display.map((r, i) => {
            const delay = `${(display.length - 1 - i) * 0.06}s`; // تظهر من الأسفل للأعلى
            if (r.kind === "fold")
              return (
                <div key={`f${i}`} className="relative flex items-center px-1" style={{ height: GAP }}>
                  <div
                    className="sl-todo sl-in flex h-[34px] w-full items-center justify-center rounded-xl font-kufi text-sm font-bold"
                    style={{ opacity: r.fade, animationDelay: delay }}
                  >
                    … {surahCountLabel(r.n)}
                  </div>
                </div>
              );
            if (r.kind === "done") {
              const justDone = celebrating && party && r.k >= party.from;
              return (
                <div key={r.k} className="relative flex items-center px-1" style={{ height: GAP }}>
                  <div
                    className={`sl-done sl-in relative flex h-[34px] w-full items-center justify-center rounded-xl font-kufi text-sm font-bold ${
                      justDone ? "sl-flash" : ""
                    }`}
                    style={{ background: PASTEL[r.k % PASTEL.length], animationDelay: delay }}
                  >
                    {nameAt(r.k)}
                    <span className="absolute left-2 text-xs">⭐</span>
                  </div>
                </div>
              );
            }
            if (r.kind === "todo")
              return (
                <div key={r.k} className="relative flex items-center px-1" style={{ height: GAP }}>
                  <div
                    className={`${r.goal ? "sl-goal" : "sl-todo"} sl-in relative flex h-[34px] w-full items-center justify-center rounded-xl font-kufi text-sm font-bold`}
                    style={{ opacity: r.fade, animationDelay: delay }}
                  >
                    {nameAt(r.k)}
                    {r.goal && <span className="absolute left-1.5 text-[10px]">🚩</span>}
                  </div>
                  {r.goal && (
                    <span className="sl-wiggle absolute -left-12 top-1/2 -mt-3.5 whitespace-nowrap text-xl" aria-hidden>
                      🏆
                    </span>
                  )}
                  {r.goal && (
                    <span className="absolute -right-[72px] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-amber-300 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 sl-cur">
                      هدف الفصل
                    </span>
                  )}
                </div>
              );
            // الحالية
            return (
              <div key={r.k} className="relative flex items-center px-0.5" style={{ height: 64 }}>
                <div
                  className="sl-cur sl-in relative flex h-[52px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl"
                  style={{ animationDelay: delay }}
                >
                  <div className="sl-fill absolute inset-y-0 right-0" style={{ width: `${pct * 100}%` }} />
                  <span className="relative font-kufi text-base font-bold leading-tight">سورة {nameAt(r.k)}</span>
                  <span className="relative text-[10px] font-bold opacity-75">
                    {ayahsDone > 0 ? `آية ${ar(ayahsDone)} من ${ar(curTotal)}` : "تبدئين فيها الآن 🌱"}
                    {r.k === goalK && " · 🚩 هدف الفصل"}
                  </span>
                </div>
                <span className="sl-bubble absolute -left-[78px] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-xl px-1.5 py-1 text-[10.5px] font-bold">
                  🌸 أنتِ هنا
                </span>
                <span
                  className={`absolute -right-[54px] top-1/2 -mt-[23px] ${celebrating ? "sl-jump" : ""}`}
                  style={{ ["--gap" as string]: `${GAP * Math.min(2, Math.max(1, curK - (party?.from ?? curK)))}px` }}
                >
                  <span className="sl-bob inline-block">
                    <Mascot />
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        {/* ما أتمّته */}
        {curK > 0 && (
          <div className="sl-base relative mx-2 mt-3 rounded-2xl px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold">✨ أتممتِ {surahCountLabel(Math.min(curK, TOTAL))}</p>
                <p className="truncate text-[11px] font-bold opacity-80">
                  {curK === 1 ? nameAt(0) : `من ${nameAt(0)} إلى ${nameAt(Math.min(curK, TOTAL) - 1)}`}
                </p>
              </div>
              {curK > 2 && (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="shrink-0 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-plum-700"
                >
                  {showAll ? "إخفاء" : "كل سوري ⭐"}
                </button>
              )}
            </div>
            {showAll && (
              <div className="mt-2 flex flex-wrap gap-1">
                {Array.from({ length: Math.min(curK, TOTAL) }, (_, k) => (
                  <span
                    key={k}
                    className="sl-done rounded-full px-2 py-0.5 text-[11px] font-bold"
                    style={{ background: PASTEL[k % PASTEL.length], boxShadow: "none" }}
                  >
                    ⭐ {nameAt(k)}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <p className="border-t border-cream-dark px-4 py-2.5 text-center text-[11px] font-bold text-silver-600">
        {finished
          ? "🏆 ختمتِ السلّم كله — بارك الله لكِ في حفظكِ"
          : goalReached
            ? `🎉 بلغتِ هدف الفصل! باقي ${ayahCountLabel(curTotal - ayahsDone)} وتصعدين درجة جديدة`
            : `درجة بعد درجة… باقي ${ayahCountLabel(curTotal - ayahsDone)} وتصعدين إلى «${
                curK + 1 < TOTAL ? nameAt(curK + 1) : "القمة"
              }» 💪`}
      </p>

      {/* 🎉 احتفال إتمام سورة */}
      {celebrating && party && (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
          {pieces.map((p, i) => (
            <span
              key={i}
              className="jm-confetti absolute rounded-[2px]"
              style={{
                left: `${p.left}%`,
                top: -12,
                width: p.size,
                height: p.size * 0.6,
                backgroundColor: p.color,
                animationDuration: `${p.dur}s`,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}
          <div
            className="sm-up absolute inset-x-6 top-[30%] rounded-3xl border-4 border-amber-300 bg-white px-3 py-3 text-center shadow-xl"
            style={{ animationDelay: "1.7s" }}
          >
            <p className="font-kufi text-lg font-bold text-pink-500">
              🎉 {curK - party.from > 1 ? `أتممتِ ${surahCountLabel(curK - party.from)}!` : `أتممتِ سورة ${nameAt(curK - 1)}!`}
            </p>
            <p className="text-xs font-bold text-plum-600">صعدتِ درجة جديدة — ما شاء الله 🌟</p>
          </div>
        </div>
      )}
    </div>
  );
}
