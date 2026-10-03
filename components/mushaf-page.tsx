"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { fetchMushafPage, loadMushafFont, mushafFontFamily, type MushafLine } from "@/lib/quran-audio";
import { surahName } from "@/lib/mushaf";
import { juzOfPage } from "@/lib/progress";

const ar = (n: number) => n.toLocaleString("ar-EG");

/** 📖 صفحة من مصحف المدينة بسطورها — الآية الحالية مظلّلة، وآيات خارج الورد باهتة.
    في المصحف المطبوع: الصفحات الفردية في الجهة اليمنى، والزوجية في اليسرى. */
export function MushafPage({
  page,
  currentKey,
  wardKeys,
  onPick,
  fill = false,
  onTurn,
  onBack,
}: {
  page: number;
  currentKey: string; // «سورة:آية»
  wardKeys: Set<string>;
  onPick?: (key: string) => void;
  /** ⛶ ملء الشاشة: الصفحة تملأ الطول والعرض المتاحين */
  fill?: boolean;
  /** قلب الصفحة: +1 التالية (يساراً كالمصحف)، −1 السابقة */
  onTurn?: (d: 1 | -1) => void;
  /** تظهر «العودة لصفحة التلاوة» إن كانت الطالبة تتصفّح صفحة أخرى */
  onBack?: () => void;
}) {
  const [lines, setLines] = useState<MushafLine[] | null>(null);
  const [failed, setFailed] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 340, h: 0 });

  useEffect(() => {
    let off = false;
    setLines(null);
    setFailed(false);
    Promise.all([fetchMushafPage(page), loadMushafFont(page)])
      .then(([l]) => !off && setLines(l))
      .catch(() => !off && setFailed(true));
    // تجهيز الصفحة التالية مسبقاً
    if (page < 604) {
      void fetchMushafPage(page + 1).catch(() => {});
      void loadMushafFont(page + 1).catch(() => {});
    }
    return () => {
      off = true;
    };
  }, [page]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const read = () => setSize({ w: el.clientWidth, h: fill ? el.clientHeight : 0 });
    const ro = new ResizeObserver(read);
    ro.observe(el);
    read();
    return () => ro.disconnect();
  }, [fill]);

  // حجم الخط: يُقاس أعرض سطر بحجم مبدئي ثم يُصغَّر ليملأ العرض دون أن يفيض
  const BASE = 20;
  const [fit, setFit] = useState<number | null>(null);
  useLayoutEffect(() => {
    setFit(null);
  }, [lines, size.w, size.h]);
  useLayoutEffect(() => {
    if (fit !== null || !lines || !boxRef.current) return;
    let widest = 0;
    boxRef.current.querySelectorAll<HTMLElement>("[data-mline]").forEach((row) => {
      let w = 0;
      row.querySelectorAll<HTMLElement>("span").forEach((sp) => (w += sp.getBoundingClientRect().width));
      widest = Math.max(widest, w);
    });
    const inner = boxRef.current.clientWidth - 24; // الحشو الجانبي
    let f = widest > 0 ? (BASE * inner * 0.97) / widest : BASE;
    if (fill && size.h > 0 && lines.length) f = Math.min(f, (size.h - 8) / (lines.length * 1.75)); // وأن تتّسع السطور طولاً
    setFit(Math.min(fill ? 64 : 34, f));
  }, [fit, lines, fill, size.h]);

  const right = page % 2 === 1;
  const fs = fit ?? BASE;
  const lineH = fill ? fs * 1.75 : Math.max(fs * 1.75, 30);

  // 👆 السحب بالإصبع: من اليسار لليمين = الصفحة التالية (كقلب ورقة المصحف)
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s0 = touch.current;
    touch.current = null;
    if (!s0 || !onTurn) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s0.x;
    const dy = t.clientY - s0.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) onTurn(dx > 0 ? 1 : -1);
  };
  const arrow = "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cream-dark bg-white text-xl font-bold text-plum-700 shadow-sm disabled:opacity-30";

  const firstWords = lines?.find((l) => l.kind === "words")?.words[0];
  const pageSurah = firstWords ? Number(firstWords.key.split(":")[0]) : 0;

  return (
    <div className={fill ? "flex h-full min-h-0 flex-col" : ""}>
      {/* جهة الصفحة في المصحف */}
      <div className="mb-2 flex items-center justify-between gap-2">
        {onTurn ? (
          <button type="button" onClick={() => onTurn(-1)} disabled={page <= 1} className={arrow} aria-label="الصفحة السابقة">
            ›
          </button>
        ) : (
          <span />
        )}
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 shrink-0 overflow-hidden rounded-md border-2 border-plum-600" aria-hidden>
            <span className={`w-3.5 ${right ? "bg-amber-300" : "bg-white"}`} />
            <span className="w-0.5 bg-plum-600" />
            <span className={`w-3.5 ${right ? "bg-white" : "bg-amber-300"}`} />
          </span>
          <span className="truncate text-xs font-bold text-plum-800">
            صفحة {ar(page)} — <span className="text-amber-700">{right ? "الجهة اليمنى" : "الجهة اليسرى"}</span>
          </span>
        </span>
        {onTurn ? (
          <button type="button" onClick={() => onTurn(1)} disabled={page >= 604} className={arrow} aria-label="الصفحة التالية">
            ‹
          </button>
        ) : (
          <span />
        )}
      </div>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mx-auto mb-2 block rounded-full bg-amber-100 px-4 py-1.5 text-xs font-bold text-amber-800"
        >
          ↩️ العودة لصفحة التلاوة
        </button>
      )}

      {/* الورقة: ظلّ الكعب في الجهة الداخلية كالمصحف المفتوح */}
      <div key={page} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className={`mushaf-sheet mushaf-turn ${right ? "mushaf-right" : "mushaf-left"} ${fill ? "flex min-h-0 flex-1 flex-col" : ""}`}>
        <div className={`mushaf-frame ${fill ? "flex min-h-0 flex-1 flex-col" : ""}`}>
          {/* ترويسة الصفحة كما في المصحف: السورة يميناً والجزء يساراً */}
          <div className="mushaf-running flex items-center justify-between px-3 pt-1.5 font-kufi text-[11px] font-bold">
            <span>{pageSurah ? `سورة ${surahName(pageSurah)}` : ""}</span>
            <span>الجزء {ar(juzOfPage(page))}</span>
          </div>

      <div ref={boxRef} className={`overflow-hidden px-3 pb-1 pt-1 ${fill ? "flex min-h-0 flex-1 flex-col justify-center" : ""}`} dir="rtl" style={{ visibility: lines && fit === null ? "hidden" : undefined }}>
        {failed ? (
          <p className="py-10 text-center text-sm font-bold text-silver-600">
            📡 تعذّر تحميل صفحة المصحف — جرّبي «الآية مكبّرة»
          </p>
        ) : !lines ? (
          <div className="grid gap-3 py-2">
            {Array.from({ length: 15 }, (_, i) => (
              <div key={i} className="h-5 animate-pulse rounded bg-cream-dark/60" />
            ))}
          </div>
        ) : (
          lines.map((l) => {
            if (l.kind === "header")
              return (
                <div key={l.n} className="flex items-center justify-center" style={{ height: lineH }}>
                  <span className="mushaf-banner font-kufi font-bold" style={{ fontSize: Math.max(14, fs * 0.72) }}>
                    سورة {surahName(l.surah ?? 0)}
                  </span>
                </div>
              );
            if (l.kind === "basmala")
              return (
                <p key={l.n} className="text-center font-kufi text-ink" style={{ height: lineH, lineHeight: `${lineH}px`, fontSize: fs * 0.9 }}>
                  بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ
                </p>
              );
            const short = page <= 2;
            return (
              <div
                key={l.n}
                data-mline
                className={`flex items-center whitespace-nowrap text-ink ${short ? "justify-center gap-1" : "justify-between"}`}
                style={{ fontFamily: mushafFontFamily(page), fontSize: fs, height: lineH }}
              >
                {l.words.map((w, i) => {
                  const isCur = w.key === currentKey;
                  const inWard = wardKeys.has(w.key);
                  return (
                    <span
                      key={i}
                      onClick={inWard && onPick ? () => onPick(w.key) : undefined}
                      className={`rounded px-0 transition-colors duration-500 ${isCur ? "mushaf-cur" : ""} ${
                        inWard ? (onPick ? "cursor-pointer" : "") : "opacity-45"
                      }`}
                    >
                      {w.code}
                    </span>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
          {/* رقم الصفحة في زخرفة أسفلها */}
          <div className="flex justify-center pb-1.5 pt-0.5">
            <span className="mushaf-pageno font-kufi text-xs font-bold">{ar(page)}</span>
          </div>
        </div>
      </div>
      {!fill && <p className="mt-2 text-center text-[10px] font-bold text-silver-600">
        المظلّل = الآية التي تسمعينها · اسحبي الصفحة أو استعملي ‹ › للتقليب
      </p>}
    </div>
  );
}
