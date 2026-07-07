"use client";

import { useEffect, useRef, useState } from "react";
import {
  loadAnnotations,
  saveAnnotations,
  type BookAnnotations,
  type Stroke,
} from "@/lib/store";

const COLORS = ["#c0392b", "#d68910", "#1e8449", "#2471a3", "#7d3c98"];

/** قارئ PDF مع طبقة تظليل/رسم تُحفظ لكل طالبة */
export function PdfReader({
  url,
  bookId,
  studentId,
}: {
  url: string;
  bookId: string;
  studentId: string | null;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdf, setPdf] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [mode, setMode] = useState<"read" | "draw">("read");
  const [color, setColor] = useState(COLORS[0]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);

  const annot = useRef<BookAnnotations>({});
  const dirty = useRef(false);
  const drawing = useRef(false);
  const cur = useRef<Stroke | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const containerRef = useRef<HTMLDivElement>(null);
  const pageCanvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);

  // تحميل المستند + تحديدات الطالبة
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const doc = await pdfjs.getDocument({ url }).promise;
        if (cancelled) return;
        setPdf(doc);
        setNumPages(doc.numPages);
        setPageNum(1);
        if (studentId) annot.current = await loadAnnotations(studentId, bookId);
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
  }, [url, bookId, studentId]);

  // رسم الصفحة الحالية
  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    (async () => {
      const page = await pdf.getPage(pageNum);
      if (cancelled) return;
      const cw = Math.min(containerRef.current?.clientWidth ?? 800, 820);
      const scale = cw / page.getViewport({ scale: 1 }).width;
      const viewport = page.getViewport({ scale });
      const dpr = window.devicePixelRatio || 1;

      const c = pageCanvas.current!;
      c.width = viewport.width * dpr;
      c.height = viewport.height * dpr;
      c.style.width = `${viewport.width}px`;
      c.style.height = `${viewport.height}px`;
      const ctx = c.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      await page.render({ canvasContext: ctx, viewport }).promise;

      const ov = overlay.current!;
      ov.width = viewport.width * dpr;
      ov.height = viewport.height * dpr;
      ov.style.width = `${viewport.width}px`;
      ov.style.height = `${viewport.height}px`;
      redraw();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf, pageNum]);

  // حفظ عند الخروج
  useEffect(() => {
    return () => {
      if (studentId && dirty.current) {
        void saveAnnotations(studentId, bookId, annot.current);
      }
    };
  }, [studentId, bookId]);

  function redraw() {
    const ov = overlay.current;
    if (!ov) return;
    const ctx = ov.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = ov.width / dpr;
    const h = ov.height / dpr;
    ctx.clearRect(0, 0, w, h);
    const strokes = annot.current[String(pageNum)] ?? [];
    for (const st of strokes) paint(ctx, st, w, h);
    if (cur.current) paint(ctx, cur.current, w, h);
  }

  function paint(
    ctx: CanvasRenderingContext2D,
    st: Stroke,
    w: number,
    h: number
  ) {
    ctx.strokeStyle = st.color;
    ctx.lineWidth = st.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    st.points.forEach((p, i) => {
      const x = p[0] * w;
      const y = p[1] * h;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function point(e: React.PointerEvent): [number, number] {
    const r = overlay.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  }

  function scheduleSave() {
    if (!studentId) return;
    dirty.current = true;
    setSaved(false);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveAnnotations(studentId, bookId, annot.current);
      dirty.current = false;
      setSaved(true);
    }, 700);
  }

  const onDown = (e: React.PointerEvent) => {
    if (mode !== "draw") return;
    drawing.current = true;
    cur.current = { color, width: 14, points: [point(e)] };
    overlay.current?.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current || !cur.current) return;
    cur.current.points.push(point(e));
    redraw();
  };
  const onUp = () => {
    if (!drawing.current || !cur.current) return;
    drawing.current = false;
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
    annot.current[String(pageNum)] = [];
    scheduleSave();
    redraw();
  };

  const goto = (n: number) => {
    setPageNum(Math.max(1, Math.min(numPages, n)));
  };

  if (failed) {
    return (
      <div className="card mx-4 rounded-2xl p-8 text-center">
        <p className="text-3xl">📕</p>
        <p className="mt-2 font-kufi font-bold text-plum-800">
          تعذّر فتح الكتاب
        </p>
        <p className="mt-1 text-sm text-silver-600">تأكدي من الإنترنت وأعيدي المحاولة</p>
      </div>
    );
  }

  return (
    <div>
      {/* شريط الأدوات */}
      <div className="sticky top-0 z-20 mb-3 rounded-2xl border border-cream-dark bg-white/95 p-2 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setMode("read")}
              className={`rounded-lg px-3 py-1.5 text-sm font-bold ${
                mode === "read" ? "bg-plum-600 text-white" : "bg-cream text-silver-600"
              }`}
            >
              👆 تصفّح
            </button>
            {studentId && (
              <button
                type="button"
                onClick={() => setMode("draw")}
                className={`rounded-lg px-3 py-1.5 text-sm font-bold ${
                  mode === "draw" ? "bg-plum-600 text-white" : "bg-cream text-silver-600"
                }`}
              >
                ✏️ تحديد
              </button>
            )}
          </div>
          {studentId && saved && (
            <span className="text-xs font-bold text-green-700">حُفظ ✓</span>
          )}
        </div>

        {mode === "draw" && studentId && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`h-7 w-7 rounded-full ${
                    color === c ? "ring-2 ring-plum-900 ring-offset-1" : ""
                  }`}
                  aria-label="لون"
                />
              ))}
            </div>
            <div className="mr-auto flex gap-1">
              <button
                type="button"
                onClick={undo}
                className="rounded-lg bg-cream px-2.5 py-1.5 text-xs font-bold text-plum-700"
              >
                ↩︎ تراجع
              </button>
              <button
                type="button"
                onClick={clearPage}
                className="rounded-lg bg-cream px-2.5 py-1.5 text-xs font-bold text-red-600"
              >
                🧽 مسح الصفحة
              </button>
            </div>
          </div>
        )}
      </div>

      {/* الصفحة + طبقة الرسم */}
      <div ref={containerRef} className="flex justify-center">
        {loading ? (
          <p className="py-16 text-sm font-bold text-silver-600">جارٍ فتح الكتاب…</p>
        ) : (
          <div className="relative">
            <canvas ref={pageCanvas} className="rounded-lg shadow" />
            <canvas
              ref={overlay}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerLeave={onUp}
              className="absolute left-0 top-0 rounded-lg"
              style={{
                touchAction: mode === "draw" ? "none" : "auto",
                pointerEvents: mode === "draw" ? "auto" : "none",
              }}
            />
          </div>
        )}
      </div>

      {/* التنقّل بين الصفحات */}
      {numPages > 0 && (
        <div className="sticky bottom-2 z-20 mx-auto mt-3 flex w-fit items-center gap-3 rounded-full border border-cream-dark bg-white/95 px-4 py-2 shadow backdrop-blur">
          <button
            type="button"
            onClick={() => goto(pageNum + 1)}
            disabled={pageNum >= numPages}
            className="text-lg text-plum-700 disabled:opacity-30"
            aria-label="التالي"
          >
            ▶
          </button>
          <span className="font-kufi text-sm font-bold text-plum-800">
            {pageNum.toLocaleString("ar-EG")} / {numPages.toLocaleString("ar-EG")}
          </span>
          <button
            type="button"
            onClick={() => goto(pageNum - 1)}
            disabled={pageNum <= 1}
            className="text-lg text-plum-700 disabled:opacity-30"
            aria-label="السابق"
          >
            ◀
          </button>
        </div>
      )}
    </div>
  );
}
