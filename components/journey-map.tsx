"use client";

import { useEffect, useRef, useState } from "react";
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

/** 🗺️ درب الحفظ: خريطة رحلة متحركة عبر أجزاء المصحف الثلاثين */
export function JourneyMap({
  juz,
  juzPct,
}: {
  juz: number; // الجزء الحالي (1..30)
  juzPct: number; // نسبة إنجازه
}) {
  const cur = Math.min(Math.max(1, juz), 30) - 1; // فهرس المحطة الحالية
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
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setDrawn(true))
    );
  }, [cur]);

  const end = pt(29);
  // حلقة تقدّم الجزء الحالي حول محطته
  const R = 21;
  const ringLen = 2 * Math.PI * R;

  return (
    <div className="card mb-2.5 overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between bg-gradient-to-l from-plum-500 to-plum-700 px-4 py-2.5">
        <span className="font-kufi text-sm font-bold text-white">
          🗺️ درب حفظي
        </span>
        <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold text-white">
          {juzLabel(juz)} · {ar(juzPct)}٪
        </span>
      </div>

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
          return (
            <g key={i}>
              <title>{juzLabel(i + 1)}</title>
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

      <p className="border-t border-cream-dark px-4 py-2.5 text-center text-[11px] font-bold text-silver-600">
        {cur > 0
          ? `قطعتِ ${ar(cur)} من ${ar(30)} محطة — و${juzLabel(juz)} بين يديكِ الآن 💪`
          : `أول الدرب — ${juzLabel(juz)} بين يديكِ الآن 💪`}
      </p>
    </div>
  );
}
