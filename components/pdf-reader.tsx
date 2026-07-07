"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadAnnotations,
  normalizeDigits,
  saveAnnotations,
  type BookAnnotations,
  type Stroke,
} from "@/lib/store";
import { inputCls, Sheet } from "./ui";

const COLORS = ["#c0392b", "#d68910", "#1e8449", "#2471a3", "#7d3c98", "#2c3e50"];
const ZOOMS = [1, 1.5, 2];

type Tool = "pen" | "hl" | "eraser";
const TOOL_META: Record<Tool, { icon: string; label: string }> = {
  pen: { icon: "🖊️", label: "قلم" },
  hl: { icon: "🖍️", label: "تظليل" },
  eraser: { icon: "🧽", label: "ممحاة" },
};
const SIZES: Record<Exclude<Tool, "eraser">, number[]> = {
  pen: [2, 3.5, 6],
  hl: [10, 16, 26],
};
const ALPHAS: Record<Exclude<Tool, "eraser">, number> = { pen: 0.9, hl: 0.35 };

const ar = (n: number) => n.toLocaleString("ar-EG");

/** قارئ كتب احترافي: تصفّح غامر بالسحب + كتابة (قلم/تظليل/ممحاة) تُحفظ لكل طالبة */
export function PdfReader({
  url,
  bookId,
  studentId,
  title,
  backHref,
}: {
  url: string;
  bookId: string;
  studentId: string | null;
  title: string;
  backHref: string;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdf, setPdf] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [zoomIdx, setZoomIdx] = useState(0);
  const [mode, setMode] = useState<"read" | "write">("read");
  const [tool, setTool] = useState<Tool>("hl");
  const [color, setColor] = useState(COLORS[0]);
  const [sizeIdx, setSizeIdx] = useState(1);
  const [chrome, setChrome] = useState(true);
  const [gridOpen, setGridOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [flash, setFlash] = useState(false);
  const [fitTick, setFitTick] = useState(0);
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [jumpVal, setJumpVal] = useState("");

  const annot = useRef<BookAnnotations>({});
  const dirty = useRef(false);
  const drawing = useRef(false);
  const cur = useRef<Stroke | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTask = useRef<any>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);

  const bmRef = useRef<number[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageCanvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);

  const posKey = `almaher-bookpos:${bookId}`;
  const bmLocalKey = `almaher-bm:${bookId}`;

  /* ============ تحميل المستند + كتابات الطالبة ============ */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const task = pdfjs.getDocument({ url });
        task.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
          if (total > 0) setProgress(Math.min(99, Math.round((loaded / total) * 100)));
        };
        const doc = await task.promise;
        if (cancelled) return;
        setPdf(doc);
        setNumPages(doc.numPages);
        const savedPos = Number(window.localStorage.getItem(posKey) ?? 1);
        setPageNum(Math.min(Math.max(1, savedPos || 1), doc.numPages));
        if (studentId) {
          // كتابات الطالبة وإشاراتها تتزامن عبر أجهزتها
          const { ann, bookmarks: bm } = await loadAnnotations(studentId, bookId);
          annot.current = ann;
          bmRef.current = bm;
          setBookmarks(bm);
        } else {
          try {
            const bm = JSON.parse(
              window.localStorage.getItem(bmLocalKey) ?? "[]"
            ) as number[];
            bmRef.current = Array.isArray(bm) ? bm : [];
            setBookmarks(bmRef.current);
          } catch {
            /* نتجاهل */
          }
        }
        setLoading(false);
      } catch {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, bookId, studentId]);

  /* ============ رسم الصفحة الحالية ============ */
  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    (async () => {
      const page = await pdf.getPage(pageNum);
      if (cancelled) return;
      let cw = containerRef.current?.clientWidth ?? 0;
      if (cw < 120) {
        // التخطيط لم يستقر بعد — ننتظر إطاراً ونعيد القياس
        await new Promise((r) => requestAnimationFrame(r));
        cw = containerRef.current?.clientWidth ?? 360;
        if (cw < 120) cw = 360;
      }
      const baseW = Math.min(cw, 820);
      const scale =
        (baseW * ZOOMS[zoomIdx]) / page.getViewport({ scale: 1 }).width;
      const viewport = page.getViewport({ scale });
      const dpr = window.devicePixelRatio || 1;

      const c = pageCanvas.current;
      const ov = overlay.current;
      if (!c || !ov) return;
      c.width = viewport.width * dpr;
      c.height = viewport.height * dpr;
      c.style.width = `${viewport.width}px`;
      c.style.height = `${viewport.height}px`;
      const ctx = c.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      renderTask.current?.cancel();
      const task = page.render({ canvasContext: ctx, viewport });
      renderTask.current = task;
      try {
        await task.promise;
      } catch {
        return; // أُلغي الرسم لصالح صفحة أحدث
      }
      if (cancelled) return;

      ov.width = viewport.width * dpr;
      ov.height = viewport.height * dpr;
      ov.style.width = `${viewport.width}px`;
      ov.style.height = `${viewport.height}px`;
      redraw();
      setFlash(true);
      setTimeout(() => setFlash(false), 320);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf, pageNum, zoomIdx, fitTick]);

  /* إعادة ضبط مقاس الصفحة عند تغيّر عرض الشاشة (تدوير الجوال أو استقرار التخطيط) */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let lastW = el.clientWidth;
    let t: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (Math.abs(w - lastW) > 8) {
        lastW = w;
        clearTimeout(t);
        t = setTimeout(() => setFitTick((x) => x + 1), 150);
      }
    });
    ro.observe(el);
    return () => {
      clearTimeout(t);
      ro.disconnect();
    };
  }, [loading]);

  /* حفظ آخر صفحة وصلتها + حفظ الكتابات عند الخروج */
  useEffect(() => {
    if (numPages) window.localStorage.setItem(posKey, String(pageNum));
  }, [pageNum, numPages, posKey]);

  useEffect(() => {
    return () => {
      renderTask.current?.cancel();
      if (studentId && dirty.current) {
        void saveAnnotations(studentId, bookId, annot.current, bmRef.current);
      }
    };
  }, [studentId, bookId]);

  /* أسهم الكيبورد (للكمبيوتر) — الكتاب عربي فاليسار = التالي */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goto(pageNum + 1);
      if (e.key === "ArrowRight") goto(pageNum - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNum, numPages]);

  /* ============ الرسم على الطبقة ============ */
  function redraw() {
    const ov = overlay.current;
    if (!ov) return;
    const ctx = ov.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = ov.width / dpr;
    const h = ov.height / dpr;
    ctx.clearRect(0, 0, w, h);
    for (const st of annot.current[String(pageNum)] ?? []) paint(ctx, st, w, h);
    if (cur.current) paint(ctx, cur.current, w, h);
  }

  function paint(ctx: CanvasRenderingContext2D, st: Stroke, w: number, h: number) {
    ctx.strokeStyle = st.color;
    ctx.lineWidth = st.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = st.alpha ?? 0.45;
    ctx.beginPath();
    st.points.forEach((p, i) => {
      if (i) ctx.lineTo(p[0] * w, p[1] * h);
      else ctx.moveTo(p[0] * w, p[1] * h);
    });
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function point(e: React.PointerEvent): [number, number] {
    const r = overlay.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  }

  const scheduleSave = useCallback(() => {
    if (!studentId) return;
    dirty.current = true;
    setSaved(false);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveAnnotations(studentId, bookId, annot.current, bmRef.current);
      dirty.current = false;
      setSaved(true);
    }, 700);
  }, [studentId, bookId]);

  /* الإشارات المرجعية */
  const toggleBookmark = () => {
    const next = bmRef.current.includes(pageNum)
      ? bmRef.current.filter((n) => n !== pageNum)
      : [...bmRef.current, pageNum].sort((a, b) => a - b);
    bmRef.current = next;
    setBookmarks(next);
    if (studentId) {
      scheduleSave();
    } else {
      window.localStorage.setItem(bmLocalKey, JSON.stringify(next));
    }
  };

  const jumpTo = () => {
    const n = Number(normalizeDigits(jumpVal));
    if (n >= 1 && n <= numPages) {
      goto(n);
      setJumpVal("");
      setGridOpen(false);
    }
  };

  function eraseAt(p: [number, number]) {
    const k = String(pageNum);
    const strokes = annot.current[k];
    if (!strokes?.length) return;
    const R = 0.022;
    const keep = strokes.filter(
      (st) =>
        !st.points.some(
          (q) => (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 < R * R
        )
    );
    if (keep.length !== strokes.length) {
      annot.current[k] = keep;
      scheduleSave();
      redraw();
    }
  }

  const onDown = (e: React.PointerEvent) => {
    if (mode !== "write") return;
    overlay.current?.setPointerCapture(e.pointerId);
    if (tool === "eraser") {
      drawing.current = true;
      eraseAt(point(e));
      return;
    }
    drawing.current = true;
    cur.current = {
      color,
      width: SIZES[tool][sizeIdx],
      alpha: ALPHAS[tool],
      points: [point(e)],
    };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    if (tool === "eraser") {
      eraseAt(point(e));
      return;
    }
    if (!cur.current) return;
    cur.current.points.push(point(e));
    redraw();
  };
  const onUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (tool === "eraser" || !cur.current) return;
    const k = String(pageNum);
    (annot.current[k] ??= []).push(cur.current);
    cur.current = null;
    scheduleSave();
    redraw();
  };

  const undo = () => {
    const arr = annot.current[String(pageNum)];
    if (arr?.length) {
      arr.pop();
      scheduleSave();
      redraw();
    }
  };
  const clearPage = () => {
    if (!(annot.current[String(pageNum)] ?? []).length) return;
    if (!window.confirm("مسح كل كتاباتك على هذه الصفحة؟")) return;
    annot.current[String(pageNum)] = [];
    scheduleSave();
    redraw();
  };

  /* ============ التنقّل ============ */
  const goto = (n: number) => setPageNum(Math.max(1, Math.min(numPages || 1, n)));

  const onTouchStart = (e: React.TouchEvent) => {
    if (mode !== "read") return;
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (mode !== "read" || !touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) {
      suppressClick.current = true;
      // كتاب عربي: السحب لليمين = الصفحة التالية
      goto(dx > 0 ? pageNum + 1 : pageNum - 1);
    }
  };
  const onPageTap = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (mode === "read") setChrome((c) => !c);
  };

  const annotatedPages = new Set(
    Object.entries(annot.current)
      .filter(([, v]) => v.length > 0)
      .map(([k]) => Number(k))
  );

  if (failed) {
    return (
      <div className="card mx-4 mt-10 rounded-2xl p-8 text-center">
        <p className="text-3xl">📕</p>
        <p className="mt-2 font-kufi font-bold text-plum-800">تعذّر فتح الكتاب</p>
        <p className="mt-1 text-sm text-silver-600">
          تأكدي من الإنترنت وأعيدي المحاولة
        </p>
        <Link
          href={backHref}
          className="mt-4 inline-block rounded-xl bg-plum-600 px-6 py-2 font-kufi text-sm font-bold text-white"
        >
          رجوع
        </Link>
      </div>
    );
  }

  const barsHidden = !chrome && mode === "read";

  return (
    <div className="min-h-dvh">
      {/* الشريط العلوي */}
      <header
        className={`glass-bar fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
          barsHidden ? "-translate-y-full opacity-0" : ""
        }`}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2.5">
          <Link
            href={backHref}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream text-lg text-plum-700"
            aria-label="رجوع"
          >
            →
          </Link>
          <h1 className="min-w-0 flex-1 truncate font-kufi text-base font-bold text-plum-800">
            📖 {title}
          </h1>
          {numPages > 0 && (
            <button
              type="button"
              onClick={() => setGridOpen(true)}
              className="shrink-0 rounded-full bg-plum-100 px-2.5 py-1 text-xs font-bold text-plum-700"
            >
              {ar(pageNum)} / {ar(numPages)}
            </button>
          )}
          <button
            type="button"
            onClick={toggleBookmark}
            className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-bold transition ${
              bookmarks.includes(pageNum)
                ? "bg-plum-600 text-white"
                : "bg-cream text-plum-700"
            }`}
            aria-label="إشارة مرجعية"
          >
            🔖
          </button>
          <button
            type="button"
            onClick={() => setZoomIdx((zoomIdx + 1) % ZOOMS.length)}
            className="shrink-0 rounded-full bg-cream px-2.5 py-1 text-xs font-bold text-plum-700"
            aria-label="تكبير"
          >
            🔍 ×{ZOOMS[zoomIdx].toLocaleString("ar-EG")}
          </button>
        </div>
        {/* شريط التقدّم */}
        <div className="h-1 w-full bg-cream-dark/60">
          <div
            className="h-full bg-plum-600 transition-all duration-300"
            style={{ width: numPages ? `${(pageNum / numPages) * 100}%` : "0%" }}
          />
        </div>
      </header>

      {/* الصفحة */}
      <div
        ref={containerRef}
        className="overflow-x-auto px-2 pb-44 pt-20"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {loading ? (
          <div className="flex justify-center py-14">
            {/* غلاف الفتح — واضح لكل الناس */}
            <div className="w-full max-w-xs">
              <div className="rounded-2xl bg-gradient-to-b from-plum-600 to-plum-800 px-6 pb-8 pt-10 text-center shadow-xl">
                <div className="mx-auto mb-5 flex h-20 w-20 animate-pulse items-center justify-center rounded-full bg-white/15 text-5xl">
                  📖
                </div>
                <h2 className="font-kufi text-2xl font-bold leading-snug text-white">
                  {title}
                </h2>
                <p className="mt-6 text-sm font-bold text-white/85">
                  جارٍ فتح الكتاب…
                </p>
                <div className="mx-auto mt-3 h-2 w-full overflow-hidden rounded-full bg-white/20">
                  <div
                    className={`h-full rounded-full bg-white transition-all duration-300 ${
                      progress === null ? "w-1/3 animate-pulse" : ""
                    }`}
                    style={
                      progress !== null ? { width: `${progress}%` } : undefined
                    }
                  />
                </div>
                {progress !== null && (
                  <p className="mt-2 text-xs font-bold text-white/70">
                    {progress.toLocaleString("ar-EG")}٪
                  </p>
                )}
              </div>
              <p className="mt-4 text-center text-xs font-bold text-silver-600">
                لحظات ويظهر الكتاب كاملاً بإذن الله
              </p>
            </div>
          </div>
        ) : (
          <div className="flex min-w-fit justify-center">
            <div
              className={`relative ${flash ? "page-in" : ""}`}
              onClick={onPageTap}
            >
              <canvas
                ref={pageCanvas}
                className="rounded-xl bg-white shadow-lg ring-1 ring-cream-dark"
              />
              <canvas
                ref={overlay}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerLeave={onUp}
                className="absolute left-0 top-0 rounded-xl"
                style={{
                  touchAction: mode === "write" ? "none" : "auto",
                  pointerEvents: mode === "write" ? "auto" : "none",
                  cursor: mode === "write" ? "crosshair" : undefined,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* لوحة التحكم السفلية */}
      <div
        className={`fixed inset-x-2 bottom-3 z-40 transition-all duration-300 ${
          barsHidden ? "translate-y-[130%] opacity-0" : ""
        }`}
      >
        <div className="glass-bar mx-auto max-w-xl rounded-3xl p-2.5">
          {/* أدوات الكتابة */}
          {mode === "write" && studentId && (
            <div className="mb-2 flex flex-wrap items-center justify-center gap-2 border-b border-cream-dark pb-2">
              <div className="flex gap-1 rounded-full bg-cream p-1">
                {(Object.keys(TOOL_META) as Tool[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTool(t)}
                    className={`rounded-full px-2.5 py-1 text-sm font-bold transition ${
                      tool === t ? "bg-plum-600 text-white" : "text-silver-600"
                    }`}
                  >
                    {TOOL_META[t].icon} {TOOL_META[t].label}
                  </button>
                ))}
              </div>

              {tool !== "eraser" && (
                <>
                  <div className="flex gap-1.5">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        style={{ backgroundColor: c }}
                        className={`h-6 w-6 rounded-full transition ${
                          color === c
                            ? "scale-110 ring-2 ring-plum-900 ring-offset-1"
                            : "opacity-80"
                        }`}
                        aria-label="لون"
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-cream px-2 py-1">
                    {[0, 1, 2].map((i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSizeIdx(i)}
                        className={`flex h-6 w-6 items-center justify-center rounded-full ${
                          sizeIdx === i ? "bg-plum-600" : ""
                        }`}
                        aria-label="حجم القلم"
                      >
                        <span
                          className={`rounded-full ${
                            sizeIdx === i ? "bg-white" : "bg-silver-500"
                          }`}
                          style={{ width: 4 + i * 3, height: 4 + i * 3 }}
                        />
                      </button>
                    ))}
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={undo}
                className="rounded-full bg-cream px-2.5 py-1 text-sm font-bold text-plum-700"
              >
                ↩︎
              </button>
              <button
                type="button"
                onClick={clearPage}
                className="rounded-full bg-cream px-2.5 py-1 text-sm font-bold text-red-600"
              >
                🧹
              </button>
              {saved && (
                <span className="text-[11px] font-bold text-green-700">✓ حُفظ</span>
              )}
            </div>
          )}

          {/* التنقّل والوضع */}
          <div className="flex items-center gap-2">
            {studentId && (
              <div className="flex shrink-0 gap-1 rounded-full bg-cream p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode("read");
                  }}
                  className={`rounded-full px-2.5 py-1 text-sm font-bold ${
                    mode === "read" ? "bg-plum-600 text-white" : "text-silver-600"
                  }`}
                >
                  👆
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("write");
                    setChrome(true);
                  }}
                  className={`rounded-full px-2.5 py-1 text-sm font-bold ${
                    mode === "write" ? "bg-plum-600 text-white" : "text-silver-600"
                  }`}
                >
                  ✍️
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => goto(pageNum + 1)}
              disabled={pageNum >= numPages}
              className="shrink-0 text-xl text-plum-700 disabled:opacity-25"
              aria-label="التالي"
            >
              ▶
            </button>
            <input
              type="range"
              dir="rtl"
              min={1}
              max={Math.max(1, numPages)}
              value={pageNum}
              onChange={(e) => goto(Number(e.target.value))}
              className="h-1.5 min-w-0 flex-1 accent-plum-600"
              aria-label="الصفحة"
            />
            <button
              type="button"
              onClick={() => goto(pageNum - 1)}
              disabled={pageNum <= 1}
              className="shrink-0 text-xl text-plum-700 disabled:opacity-25"
              aria-label="السابق"
            >
              ◀
            </button>

            <button
              type="button"
              onClick={() => setGridOpen(true)}
              className="shrink-0 rounded-full bg-cream px-2.5 py-1.5 text-sm font-bold text-plum-700"
              aria-label="كل الصفحات"
            >
              ⊞
            </button>
          </div>
        </div>
        {mode === "read" && (
          <p className="mt-1.5 text-center text-[10px] font-bold text-silver-500">
            اسحبي لتقليب الصفحات · المسي الصفحة لإخفاء الأدوات
          </p>
        )}
      </div>

      {/* خريطة الصفحات */}
      <Sheet open={gridOpen} onClose={() => setGridOpen(false)} title="⊞ الصفحات">
        {/* بحث برقم الصفحة */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            jumpTo();
          }}
          className="mb-3 flex gap-2"
        >
          <input
            className={`${inputCls} text-center`}
            inputMode="numeric"
            placeholder="اكتبي رقم الصفحة…"
            value={jumpVal}
            onChange={(e) => setJumpVal(e.target.value)}
          />
          <button
            type="submit"
            className="shrink-0 rounded-xl bg-plum-600 px-5 font-kufi text-sm font-bold text-white"
          >
            اذهبي
          </button>
        </form>

        {/* الإشارات المرجعية */}
        {bookmarks.length > 0 && (
          <div className="mb-3 rounded-2xl bg-plum-50 p-3">
            <p className="mb-2 text-xs font-bold text-plum-700">🔖 إشاراتي المرجعية</p>
            <div className="flex flex-wrap gap-1.5">
              {bookmarks.map((n) => (
                <span
                  key={n}
                  className="flex items-center gap-1 rounded-full bg-white pr-2.5 shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => {
                      goto(n);
                      setGridOpen(false);
                    }}
                    className="py-1 font-kufi text-sm font-bold text-plum-800"
                  >
                    صفحة {ar(n)}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = bmRef.current.filter((x) => x !== n);
                      bmRef.current = next;
                      setBookmarks(next);
                      if (studentId) scheduleSave();
                      else window.localStorage.setItem(bmLocalKey, JSON.stringify(next));
                    }}
                    className="px-1.5 text-xs font-bold text-red-500"
                    aria-label="حذف الإشارة"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                goto(n);
                setGridOpen(false);
              }}
              className={`relative rounded-xl py-2.5 font-kufi text-sm font-bold transition ${
                n === pageNum
                  ? "bg-plum-600 text-white"
                  : "bg-cream text-plum-800"
              }`}
            >
              {ar(n)}
              {annotatedPages.has(n) && (
                <span
                  className={`absolute left-1.5 top-1 h-1.5 w-1.5 rounded-full ${
                    n === pageNum ? "bg-white" : "bg-plum-600"
                  }`}
                />
              )}
              {bookmarks.includes(n) && (
                <span className="absolute -top-0.5 right-1 text-[10px]">🔖</span>
              )}
            </button>
          ))}
        </div>
        {studentId && (
          <p className="mt-3 text-center text-xs text-silver-600">
            النقطة • تعني صفحة كتبتِ عليها
          </p>
        )}
      </Sheet>
    </div>
  );
}
