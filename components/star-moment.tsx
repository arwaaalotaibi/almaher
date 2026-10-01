"use client";

import { useEffect, useRef, useState } from "react";
import { recitePartLabel, type RecitationLog } from "@/lib/store";

/* ================== ⭐ لحظة النجمة ==================
   أول فتح بعد لقاء نالت فيه الطالبة «⭐ ماهرة»: نجمة متوهّجة وسط سماء ليلية مع
   «أنتِ من الماهرات اليوم!» ثم تطير النجمة إلى عدّاد نجومها في رأس الشاشة.
   تظهر مرة واحدة لكل نجمة (المشاهَد محفوظ على الجهاز). */

const SEEN_KEY = "almaher-star-seen";

/** النجوم التي احتُفل بها على هذا الجهاز — null إن تعذّر التخزين (فلا نكرّر الاحتفال) */
export function loadSeenStars(): Set<string> | null {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "[]") as string[]);
  } catch {
    return null;
  }
}

export function saveSeenStars(ids: Set<string>) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...ids].slice(-300)));
  } catch {
    /* تخزين معطّل */
  }
}

const SPARKS = Array.from({ length: 14 }, (_, i) => ({ a: `${(i / 14) * 360 + 12}deg`, d: `${170 + (i % 4) * 28}px` }));

export function StarMoment({
  record,
  extra,
  chipId,
  onDone,
}: {
  record: RecitationLog;
  /** نجوم أخرى لم يُحتفل بها بعد (تُذكر ولا يُعاد الاحتفال بها) */
  extra: number;
  /** عنصر عدّاد النجوم الذي تطير إليه النجمة */
  chipId: string;
  onDone: () => void;
}) {
  const starRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"show" | "fly">("show");
  const [fly, setFly] = useState<{ x: number; y: number; dx: number; dy: number; go: boolean } | null>(null);

  const reduce =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const close = () => {
    const s = starRef.current?.getBoundingClientRect();
    const c = document.getElementById(chipId)?.getBoundingClientRect();
    if (reduce || !s || !c) {
      onDone();
      return;
    }
    const x = s.left + s.width / 2;
    const y = s.top + s.height / 2;
    setFly({ x, y, dx: c.left + 18 - x, dy: c.top + c.height / 2 - y, go: false });
    setPhase("fly");
    requestAnimationFrame(() => requestAnimationFrame(() => setFly((f) => (f ? { ...f, go: true } : f))));
    window.setTimeout(onDone, 1150);
  };

  // إغلاق بالرجوع/Escape
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onDone();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onDone]);

  const seg = record.tasmi.status === "done" ? recitePartLabel(record.tasmi) : "";
  const day = new Date(`${record.date}T00:00:00`).toLocaleDateString("ar-u-ca-gregory-nu-arab", { weekday: "long" });

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-label="أنتِ من الماهرات اليوم">
      {phase === "show" && (
        <div
          className="sm-fade absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
          style={{ background: "radial-gradient(ellipse at 50% 35%,#3a2338f2,#140b14fa)" }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "radial-gradient(#ffffff70 1.3px,transparent 1.7px),radial-gradient(#ffffff40 1px,transparent 1.3px)",
              backgroundSize: "62px 62px,33px 33px",
              backgroundPosition: "0 0,19px 25px",
            }}
          />
          <div className="relative mb-2 h-56 w-56">
            <div
              className="sm-glow absolute inset-[-60px] rounded-full"
              style={{ background: "radial-gradient(circle,#ffd45e88 0%,#ffd45e22 40%,#ffd45e00 70%)" }}
            />
            {SPARKS.map((s, i) => (
              <span
                key={i}
                className="sm-spark absolute left-1/2 top-1/2 text-2xl text-amber-200"
                style={{ ["--a" as string]: s.a, ["--d" as string]: s.d, textShadow: "0 0 12px #ffd45e" }}
              >
                ✦
              </span>
            ))}
            <div ref={starRef} className="sm-pop absolute inset-0 flex items-center justify-center">
              <span className="sm-float text-[150px] leading-none" style={{ filter: "drop-shadow(0 0 40px #ffd45e)" }}>
                ⭐
              </span>
            </div>
          </div>
          <h2 className="sm-up relative font-kufi text-4xl font-bold text-amber-200" style={{ animationDelay: "1s" }}>
            أنتِ من الماهرات اليوم!
          </h2>
          <p className="sm-up relative mt-3 text-lg font-bold leading-relaxed text-white/90" style={{ animationDelay: "1.5s" }}>
            أتقنتِ حفظكِ في لقاء {day}
            {seg && (
              <>
                <br />
                {seg}
              </>
            )}
          </p>
          {extra > 0 && (
            <p className="sm-up relative mt-2 rounded-full bg-white/10 px-4 py-1 text-sm font-bold text-amber-200" style={{ animationDelay: "1.8s" }}>
              ومعها {extra === 1 ? "نجمة أخرى" : extra === 2 ? "نجمتان أخريان" : `${extra.toLocaleString("ar-EG")} نجوم أخرى`} ✨
            </p>
          )}
          <p className="sm-up relative mt-5 font-kufi text-lg text-amber-100/80" style={{ animationDelay: "2s" }}>
            «الماهر بالقرآن مع السفرة الكرام البررة»
          </p>
          <button
            type="button"
            onClick={close}
            className="sm-up relative mt-7 w-64 rounded-2xl py-4 text-xl font-bold text-plum-900"
            style={{ animationDelay: "2.4s", background: "linear-gradient(90deg,#ffd45e,#f3b13a)", boxShadow: "0 0 34px #ffd45e77" }}
          >
            <span className="sm-pulse inline-block">✨ الحمد لله</span>
          </button>
        </div>
      )}
      {phase === "fly" && fly && (
        <span
          className="pointer-events-none fixed text-7xl leading-none"
          style={{
            left: fly.x,
            top: fly.y,
            filter: "drop-shadow(0 0 20px #ffd45e)",
            transform: fly.go
              ? `translate(-50%,-50%) translate(${fly.dx}px, ${fly.dy}px) scale(0.3) rotate(360deg)`
              : "translate(-50%,-50%) scale(1.6)",
            transition: "transform 1.05s cubic-bezier(.5,-0.25,.4,1)",
          }}
        >
          ⭐
        </span>
      )}
    </div>
  );
}
