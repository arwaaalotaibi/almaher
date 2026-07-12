"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { juzLabel } from "@/lib/progress";

const ar = (n: number) => n.toLocaleString("ar-EG");

/* شبكة الدرب: ٣٠ محطة (جزءاً) على مسار متعرّج من الأعلى لليمين نزولاً */
const COLS = 5;
const W = 340;
const STEP_Y = 60;
const PAD_X = 34;
const TOP = 40;
const ROWS = Math.ceil(30 / COLS);
const H = TOP + (ROWS - 1) * STEP_Y + 52;

/** إحداثيات محطة الجزء (i من 0..29) — الصف الأول يمين←يسار (عربي) */
function pt(i: number): { x: number; y: number } {
  const row = Math.floor(i / COLS);
  const col = i % COLS;
  const c = row % 2 === 0 ? COLS - 1 - col : col;
  return {
    x: PAD_X + c * ((W - PAD_X * 2) / (COLS - 1)),
    y: TOP + row * STEP_Y,
  };
}

/** مسار متصل عبر المحطات 0..to بمنعطفات ناعمة عند أطراف الصفوف */
function pathD(to: number): string {
  const p0 = pt(0);
  let d = `M ${p0.x} ${p0.y}`;
  for (let i = 1; i <= to; i++) {
    const a = pt(i - 1);
    const b = pt(i);
    if (a.y === b.y) {
      d += ` L ${b.x} ${b.y}`;
    } else {
      // منعطف نصف دائري عند حافة الصف (داخل حدود اللوحة مع سماكة الخط)
      const dir = a.x > W / 2 ? 1 : -1;
      d += ` C ${a.x + dir * 32} ${a.y}, ${b.x + dir * 32} ${b.y}, ${b.x} ${b.y}`;
    }
  }
  return d;
}

/** لوح ألوان قصاصات الاحتفال — من هوية التطبيق */
const CONFETTI = ["#a8894f", "#5d3f4e", "#e7c873", "#8a5d75", "#ffffff"];

type MapView = "path" | "garden";

/* ================== مظهر الدرب (خريطة المراحل) ================== */
function PathSvg({
  cur,
  juz,
  juzPct,
  goalJuz,
}: {
  cur: number;
  juz: number;
  juzPct: number;
  goalJuz: number;
}) {
  const doneRef = useRef<SVGPathElement>(null);
  const [drawn, setDrawn] = useState(false);

  // رسم الدرب المقطوع تدريجياً عند الظهور
  useEffect(() => {
    const el = doneRef.current;
    if (!el) return;
    const len = el.getTotalLength();
    el.style.strokeDasharray = `${len}`;
    el.style.strokeDashoffset = `${len}`;
    // إطار حتى يثبت القياس ثم نطلق الحركة
    requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
  }, [cur]);

  const end = pt(29);
  // حلقة تقدّم الجزء الحالي حول محطته
  const R = 21;
  const ringLen = 2 * Math.PI * R;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block w-full"
      role="img"
      aria-label={`درب الحفظ — ${juzLabel(juz)}`}
    >
      {/* الدرب كاملاً (باهت) */}
      <path
        d={pathD(29)}
        fill="none"
        stroke="#ece4d9"
        strokeWidth="9"
        strokeLinecap="round"
      />
      {/* الدرب المقطوع — يُرسم متحركاً حتى محطتها */}
      {cur > 0 && (
        <path
          ref={doneRef}
          d={pathD(cur)}
          fill="none"
          stroke="#a8894f"
          strokeWidth="9"
          strokeLinecap="round"
          className="jm-draw"
          style={drawn ? { strokeDashoffset: 0 } : undefined}
        />
      )}

      {/* المحطات */}
      {Array.from({ length: 30 }, (_, i) => {
        const { x, y } = pt(i);
        const done = i < cur;
        const isCur = i === cur;
        const isGoal = goalJuz > 0 && i === goalJuz - 1;
        return (
          <g key={i}>
            <title>{`${juzLabel(i + 1)}${isGoal ? " — هدف الفصل 🚩" : ""}`}</title>
            {/* 🚩 هدف الفصل */}
            {isGoal && (
              <text x={x + 14} y={y - 14} fontSize="13" className="jm-float">
                🚩
              </text>
            )}
            {/* نبض المحطة الحالية */}
            {isCur && (
              <circle cx={x} cy={y} r={16} fill="#5d3f4e" className="jm-pulse" />
            )}
            {/* حلقة تقدّم الجزء الحالي */}
            {isCur && (
              <circle
                cx={x}
                cy={y}
                r={R}
                fill="none"
                stroke="#a8894f"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={`${(ringLen * juzPct) / 100} ${ringLen}`}
                transform={`rotate(-90 ${x} ${y})`}
              />
            )}
            <circle
              cx={x}
              cy={y}
              r={16}
              fill={done ? "#a8894f" : isCur ? "#5d3f4e" : "#ffffff"}
              stroke={done ? "#8a6d3b" : isCur ? "#5d3f4e" : "#ded4c5"}
              strokeWidth="2"
            />
            <text
              x={x}
              y={y + 4.5}
              textAnchor="middle"
              fontSize="12.5"
              fontWeight="700"
              fill={done || isCur ? "#ffffff" : "#a9a09a"}
            >
              {ar(i + 1)}
            </text>
            {/* تلألؤ المحطات المقطوعة */}
            {done && (
              <text
                x={x + 13}
                y={y - 10}
                fontSize="9"
                className="jm-sparkle"
                style={{ animationDelay: `${(i % 5) * 0.45}s` }}
              >
                ✨
              </text>
            )}
            {/* الزهرة فوق المحطة الحالية */}
            {isCur && (
              <text
                x={x}
                y={y - 26}
                textAnchor="middle"
                fontSize="17"
                className="jm-float"
              >
                🌸
              </text>
            )}
          </g>
        );
      })}

      {/* الختمة عند نهاية الدرب */}
      <text
        x={end.x}
        y={end.y + 40}
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill="#8a6d3b"
      >
        🎉 الختمة بإذن الله
      </text>
    </svg>
  );
}

/* ================== مظهر البستان (كل جزء زهرة) ================== */
const G_TOP = 58;
const G_STEP = 60;
const G_PAD = 38;
const G_H = G_TOP + (ROWS - 1) * G_STEP + 36 + 31;

function gpt(i: number): { x: number; y: number } {
  const row = Math.floor(i / COLS);
  const col = i % COLS;
  const c = row % 2 === 0 ? COLS - 1 - col : col;
  return {
    x: G_PAD + c * ((W - G_PAD * 2) / (COLS - 1)),
    y: G_TOP + row * G_STEP,
  };
}

/** زهرة سداسية البتلات حول رأس الساق */
function Petals({
  x,
  y,
  scale,
  fill,
}: {
  x: number;
  y: number;
  scale: number;
  fill: string;
}) {
  return (
    <>
      {Array.from({ length: 6 }, (_, k) => (
        <ellipse
          key={k}
          cx={x}
          cy={y - 8 * scale}
          rx={4.2 * scale}
          ry={8.5 * scale}
          fill={fill}
          transform={`rotate(${k * 60} ${x} ${y})`}
        />
      ))}
    </>
  );
}

function GardenSvg({
  cur,
  juz,
  juzPct,
  goalJuz,
}: {
  cur: number;
  juz: number;
  juzPct: number;
  goalJuz: number;
}) {
  // الزهرة الحالية تتفتّح بتدرّج مع نسبة الجزء
  const bloom = 0.35 + 0.65 * (Math.min(100, Math.max(0, juzPct)) / 100);
  return (
    <svg
      viewBox={`0 0 ${W} ${G_H}`}
      className="block w-full"
      role="img"
      aria-label={`بستان الحفظ — ${juzLabel(juz)}`}
    >
      <rect x="0" y="0" width={W} height={G_H} fill="#fdf9f0" />
      {/* شمس البستان */}
      <circle cx="34" cy="28" r="13" fill="#f3d9a1" />
      <circle cx="34" cy="28" r="18" fill="none" stroke="#f3d9a1" strokeWidth="1.5" opacity="0.5" />
      {/* خطوط الأرض */}
      {Array.from({ length: ROWS }, (_, r) => {
        const gy = G_TOP + r * G_STEP + 36;
        return (
          <path
            key={r}
            d={`M 10 ${gy} Q ${W / 2} ${gy + 6} ${W - 10} ${gy}`}
            stroke="#e8e0cf"
            strokeWidth="2"
            fill="none"
          />
        );
      })}

      {Array.from({ length: 30 }, (_, i) => {
        const { x, y } = gpt(i);
        const st = y + 8; // رأس الساق
        const ground = y + 36;
        const done = i < cur;
        const isCur = i === cur;
        const isGoal = goalJuz > 0 && i === goalJuz - 1;
        return (
          <g key={i}>
            <title>{`${juzLabel(i + 1)}${isGoal ? " — هدف الفصل 🚩" : ""}`}</title>
            {/* الساق والورقة */}
            <path
              d={`M ${x} ${ground} C ${x + 2} ${y + 22}, ${x - 2} ${y + 15}, ${x} ${st}`}
              stroke="#7a9364"
              strokeWidth="2.2"
              fill="none"
            />
            <ellipse
              cx={x + 5}
              cy={y + 26}
              rx="4.5"
              ry="2"
              fill="#9cb37e"
              transform={`rotate(-28 ${x + 5} ${y + 26})`}
            />
            {done ? (
              /* زهرة مزهرة ذهبية تتمايل */
              <>
                <g
                  className="jm-sway"
                  style={{ animationDelay: `${(i % 6) * 0.4}s` }}
                >
                  <Petals x={x} y={st} scale={1} fill="#e2b45c" />
                  <circle cx={x} cy={st} r="4.5" fill="#5d3f4e" />
                </g>
                <text
                  x={x + 11}
                  y={st - 13}
                  fontSize="8"
                  className="jm-sparkle"
                  style={{ animationDelay: `${(i % 5) * 0.5}s` }}
                >
                  ✨
                </text>
              </>
            ) : isCur ? (
              /* زهرة تتفتّح الآن + فراشة */
              <>
                <g className="jm-grow">
                  <Petals x={x} y={st} scale={bloom} fill="#d8749c" />
                  <circle cx={x} cy={st} r="3.6" fill="#5d3f4e" />
                </g>
                <text x={x - 5} y={st - 17} fontSize="13" className="jm-fly">
                  🦋
                </text>
              </>
            ) : (
              /* برعم ينتظر */
              <>
                <circle cx={x} cy={st} r="3.4" fill="#9cb37e" />
                <ellipse cx={x} cy={st - 4} rx="2.2" ry="3.6" fill="#b7c99a" />
              </>
            )}
            {/* 🚩 هدف الفصل */}
            {isGoal && (
              <text x={x + 12} y={st - 2} fontSize="11" className="jm-float">
                🚩
              </text>
            )}
            <text
              x={x}
              y={ground + 12}
              textAnchor="middle"
              fontSize="8.5"
              fill="#b3a893"
            >
              {ar(i + 1)}
            </text>
          </g>
        );
      })}

      <text
        x={W / 2}
        y={G_H - 7}
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill="#8a6d3b"
      >
        🎉 عند اكتمال البستان: الختمة بإذن الله
      </text>
    </svg>
  );
}

/* ================== البطاقة المشتركة ================== */

/** 🗺️/🌷 رحلة الحفظ عبر الأجزاء الثلاثين — بمظهرين تختار الطالبة بينهما */
export function JourneyMap({
  juz,
  juzPct,
  goalJuz = 0,
  studentId = "",
}: {
  juz: number; // الجزء الحالي (1..30)
  juzPct: number; // نسبة إنجازه
  goalJuz?: number; // جزء هدف الفصل (يظهر عليه 🚩)
  studentId?: string; // لتذكّر آخر محطة احتُفل بها + المظهر المفضّل
}) {
  const cur = Math.min(Math.max(1, juz), 30) - 1; // فهرس المحطة الحالية
  const [celebrate, setCelebrate] = useState(false);
  const [view, setView] = useState<MapView>("path");

  const viewKey = `almaher-jm-view:${studentId}`;

  // المظهر المفضّل المحفوظ على الجهاز
  useEffect(() => {
    const stored = window.localStorage.getItem(viewKey);
    if (stored === "garden" || stored === "path") setView(stored);
  }, [viewKey]);

  const pickView = (v: MapView) => {
    setView(v);
    window.localStorage.setItem(viewKey, v);
  };

  // 🎊 احتفال عند إتمام جزء جديد (مرة واحدة لكل محطة، لكل جهاز)
  useEffect(() => {
    if (!studentId) return;
    const key = `almaher-jm:${studentId}`;
    const stored = window.localStorage.getItem(key);
    if (stored !== null && cur > Number(stored)) {
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 4000);
      window.localStorage.setItem(key, String(cur));
      return () => clearTimeout(t);
    }
    window.localStorage.setItem(key, String(cur));
  }, [studentId, cur]);

  // قصاصات عشوائية — تُولَّد فقط عند الاحتفال (على الجهاز، فلا مشكلة SSR)
  const pieces = useMemo(
    () =>
      celebrate
        ? Array.from({ length: 26 }, (_, i) => ({
            left: Math.random() * 100,
            delay: Math.random() * 0.7,
            dur: 1.8 + Math.random() * 1.1,
            color: CONFETTI[i % CONFETTI.length],
            size: 6 + Math.random() * 5,
          }))
        : [],
    [celebrate]
  );

  return (
    <div className="card relative mb-2.5 overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between gap-2 bg-gradient-to-l from-plum-500 to-plum-700 px-3 py-2.5">
        <span className="font-kufi text-sm font-bold text-white">
          {view === "garden" ? "🌷 بستان حفظي" : "🗺️ درب حفظي"}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold text-white">
            {juzLabel(juz)} · {ar(juzPct)}٪
          </span>
          {/* تبديل المظهر — يتذكّره الجهاز */}
          <span className="flex gap-0.5 rounded-full bg-white/15 p-0.5">
            {(
              [
                { v: "path", icon: "🗺️", label: "مظهر الدرب" },
                { v: "garden", icon: "🌷", label: "مظهر البستان" },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => pickView(o.v)}
                aria-label={o.label}
                className={`rounded-full px-1.5 py-0.5 text-xs transition ${
                  view === o.v ? "bg-white" : "opacity-60"
                }`}
              >
                {o.icon}
              </button>
            ))}
          </span>
        </span>
      </div>

      {/* 🎊 قصاصات الاحتفال بمحطة جديدة */}
      {celebrate && (
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
          <p className="absolute inset-x-4 top-1/3 rounded-2xl bg-plum-800/90 px-4 py-3 text-center font-kufi text-sm font-bold text-white shadow-lg">
            🎉 ما شاء الله!{" "}
            {view === "garden"
              ? `أزهرت زهرة ${juzLabel(cur)}`
              : `ذهّبتِ محطة ${juzLabel(cur)}`}{" "}
            — واصلي!
          </p>
        </div>
      )}

      {view === "garden" ? (
        <GardenSvg cur={cur} juz={juz} juzPct={juzPct} goalJuz={goalJuz} />
      ) : (
        <PathSvg cur={cur} juz={juz} juzPct={juzPct} goalJuz={goalJuz} />
      )}

      <p className="border-t border-cream-dark px-4 py-2.5 text-center text-[11px] font-bold text-silver-600">
        {view === "garden"
          ? cur > 0
            ? `أزهرت ${ar(cur)} من ${ar(30)} زهرة — وزهرة ${juzLabel(juz)} تتفتّح الآن 🌸`
            : `أول البستان — زهرة ${juzLabel(juz)} تتفتّح الآن 🌸`
          : cur > 0
            ? `قطعتِ ${ar(cur)} من ${ar(30)} محطة — و${juzLabel(juz)} بين يديكِ الآن 💪`
            : `أول الدرب — ${juzLabel(juz)} بين يديكِ الآن 💪`}
      </p>
    </div>
  );
}
