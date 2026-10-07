"use client";

import { useMemo, useState } from "react";
import { halaqaTitle, useApp, type Halaqa } from "@/lib/store";
import { boardRange, currentBoard, honorBoards, openBoard } from "./honor-month-card";

const ar = (n: number) => n.toLocaleString("ar-EG");
const ORD = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة"];
const dayLabel = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("ar-u-ca-gregory-nu-arab", { weekday: "long", day: "numeric", month: "long" });

/** 📋 اختيارات المعلّمات للإدارة: لوحة الشرف (الأولى/الثانية/الثالثة) ومتميزات لقاءاتها — عرض وطباعة ونسخ */
export function HonorList({ onDesign }: { onDesign: (halaqaId: string, studentIds: string[], title: string) => void }) {
  const { honors, students, teachers, halaqas } = useApp();
  const all = useMemo(() => honors ?? [], [honors]);
  const maxBoards = Math.max(1, ...halaqas.map((h) => honorBoards(h).length));
  const defaultN = useMemo(() => {
    const ns = halaqas.map((h) => currentBoard(honorBoards(h))?.n ?? 1);
    return ns.length ? Math.max(...ns) : 1;
  }, [halaqas]);
  const [boardN, setBoardN] = useState<number | null>(null);
  const n = boardN ?? defaultN;
  const [hid, setHid] = useState("");

  const nameOf = (id: string) => students.find((s) => s.id === id)?.name ?? "—";
  const teacherOf = (id: string) => (id ? teachers.find((t) => t.id === id)?.name ?? "" : "الإدارة");
  const teachersIn = (h: Halaqa) =>
    teachers.filter((t) => t.halaqaIds.includes(h.id) && students.some((s) => s.halaqaId === h.id && s.teacherId === t.id));
  const boardTitle = `لوحة الشرف ${ORD[n - 1] ?? ar(n)}`;

  const data = halaqas
    .filter((h) => !hid || h.id === hid)
    .map((h) => {
      const boards = honorBoards(h);
      const b = boards.find((x) => x.n === n);
      const boardPicks = b ? all.filter((x) => x.kind === "month" && x.period === b.key && x.halaqaId === h.id) : [];
      const weekPicks = b ? all.filter((x) => x.kind === "week" && x.halaqaId === h.id && b.dates.includes(x.period)) : [];
      const dates = b ? b.dates.filter((d) => weekPicks.some((x) => x.period === d)) : [];
      const sessionOf = (d: string) => (b ? b.from + b.dates.indexOf(d) : 0);
      return { h, b, boardPicks, weekPicks, dates, sessionOf };
    });

  const filled = data.filter((d) => d.boardPicks.length || d.weekPicks.length);

  const asText = () =>
    filled
      .map((d) => {
        const lines = [`🕌 ${halaqaTitle(d.h)}`];
        if (d.boardPicks.length) lines.push(`🏆 ${boardTitle} (${boardRange(d.b!)}):`, ...d.boardPicks.map((x) => `   • ${nameOf(x.studentId)}`));
        if (d.dates.length) {
          lines.push(`🏅 متميزات اللقاءات:`);
          for (const dt of d.dates)
            lines.push(`   لقاء ${ar(d.sessionOf(dt))}: ${d.weekPicks.filter((x) => x.period === dt).map((x) => nameOf(x.studentId)).join("، ")}`);
        }
        return lines.join("\n");
      })
      .join("\n\n");

  const print = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
    const body = filled
      .map(
        (d) => `<section><h2>🕌 ${esc(halaqaTitle(d.h))}</h2>
        ${d.boardPicks.length ? `<h3>🏆 ${esc(boardTitle)} — ${esc(boardRange(d.b!))}</h3><ol>${d.boardPicks.map((x) => `<li>${esc(nameOf(x.studentId))}</li>`).join("")}</ol>` : ""}
        ${d.dates.length ? `<h3>🏅 متميزات اللقاءات</h3><table>${d.dates.map((dt) => `<tr><td>لقاء ${ar(d.sessionOf(dt))}<br><small>${esc(dayLabel(dt))}</small></td><td>${d.weekPicks.filter((x) => x.period === dt).map((x) => esc(nameOf(x.studentId))).join("<br>")}</td></tr>`).join("")}</table>` : ""}
      </section>`
      )
      .join("");
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(boardTitle)}</title>
      <style>body{font-family:"Geeza Pro","Noto Naskh Arabic",Tahoma,serif;color:#4d3340;padding:24px}h1{text-align:center;margin:0 0 4px}p.s{text-align:center;color:#8b7c84;margin:0 0 18px}
      section{break-inside:avoid;border:2px solid #e8d9b5;border-radius:14px;padding:12px 16px;margin-bottom:14px}h2{margin:0 0 6px;font-size:20px}h3{margin:10px 0 4px;font-size:16px;color:#7d5a6c}
      ol{margin:0;padding-inline-start:26px;font-size:18px;font-weight:bold;list-style:arabic-indic}table{width:100%;border-collapse:collapse;font-size:15px}td{border-bottom:1px solid #eee;padding:5px 4px;vertical-align:top}td:first-child{width:34%;color:#7d5a6c;font-weight:bold}small{color:#8b7c84;font-weight:normal}</style></head>
      <body><h1>🏆 ${esc(boardTitle)}</h1><p class="s">جمعية الماهر بالقرآن — ومتميزات لقاءاتها</p>${body || "<p class='s'>لا اختيارات في هذه اللوحة بعد</p>"}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`🏆 ${boardTitle} — جمعية الماهر بالقرآن\n\n${asText()}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* */
    }
  };

  return (
    <div>
      {/* 🔓 المفتوحة للمعلّمات الآن — تلقائياً بالتاريخ */}
      <div className="card mb-4 rounded-2xl border-2 border-amber-200 p-3">
        <p className="font-kufi text-sm font-bold text-plum-800">🔓 المفتوحة للمعلّمات الآن</p>
        <p className="mb-2 text-[11px] font-bold text-silver-600">
          تُفتح تلقائياً: الأولى يوم اللقاء ٤ · الثانية يوم اللقاء ٨ · الثالثة يوم آخر لقاء — دون اشتراط تسجيل اللقاءات
        </p>
        <div className="grid gap-1">
          {halaqas.map((h) => {
            const boards = honorBoards(h);
            const ob = openBoard(boards);
            const next = boards.find((x) => !ob || x.n === ob.n + 1);
            return (
              <div key={h.id} className="flex items-center justify-between gap-2 rounded-lg bg-cream/70 px-2.5 py-1.5 text-[11px] font-bold">
                <span className="truncate text-plum-800">{halaqaTitle(h)}</span>
                <span className="shrink-0 text-end">
                  <span className={ob ? "text-emerald-700" : "text-silver-600"}>{ob ? `🏆 ${ob.title.replace("لوحة الشرف ", "")}` : "🔒 لم تُفتح"}</span>
                  {next && <span className="block text-[10px] text-silver-600">التالية: {dayLabel(next.endDate)}</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* اللوحة والحلقة */}
      <p className="mb-1.5 text-xs font-bold text-plum-700">📋 عرض اختيارات:</p>
      <div className="mb-3 flex gap-1 rounded-2xl bg-cream p-1">
        {Array.from({ length: maxBoards }, (_, i) => i + 1).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setBoardN(k)}
            className={`flex-1 rounded-xl py-2 text-xs font-bold ${n === k ? "bg-plum-600 text-white shadow" : "text-plum-700"}`}
          >
            🏆 {ORD[k - 1] ?? ar(k)}
          </button>
        ))}
      </div>
      <select className="mb-3 w-full rounded-xl border border-cream-dark bg-white px-3 py-2.5 text-sm font-bold" value={hid} onChange={(e) => setHid(e.target.value)}>
        <option value="">كل الحلقات</option>
        {halaqas.map((h) => (
          <option key={h.id} value={h.id}>
            {halaqaTitle(h)}
          </option>
        ))}
      </select>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={print} disabled={!filled.length} className="rounded-xl bg-plum-600 py-2.5 text-sm font-bold text-white disabled:opacity-40">
          🖨️ طباعة الأسماء
        </button>
        <button type="button" onClick={copy} disabled={!filled.length} className="rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white disabled:opacity-40">
          {copied ? "✓ نُسخت" : "📋 نسخ للواتساب"}
        </button>
      </div>

      {data.map(({ h, b, boardPicks, weekPicks, dates, sessionOf }) => {
        const tIn = teachersIn(h);
        const missing = tIn.filter((t) => !boardPicks.some((x) => x.teacherId === t.id));
        return (
          <div key={h.id} className="card mb-4 rounded-2xl p-4">
            <h2 className="font-kufi text-base font-bold text-plum-800">🕌 {halaqaTitle(h)}</h2>
            {!b ? (
              <p className="mt-2 text-xs text-silver-600">لم تُحدَّد بداية الفصل لهذه الحلقة</p>
            ) : (
              <>
                <p className="mb-3 text-[11px] font-bold text-silver-600">
                  {boardRange(b)} · تنتهي {dayLabel(b.endDate)}
                </p>
                {/* 🏆 اللوحة */}
                <div className="mb-3 rounded-xl bg-amber-50 p-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <p className="font-kufi text-sm font-bold text-amber-900">🏆 {boardTitle}</p>
                    {boardPicks.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onDesign(h.id, boardPicks.map((x) => x.studentId), boardTitle)}
                        className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-plum-700"
                      >
                        🎨 إعلان
                      </button>
                    )}
                  </div>
                  {boardPicks.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {boardPicks.map((x) => (
                        <span key={x.id} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-plum-800">
                          🏆 {nameOf(x.studentId)} <span className="text-[10px] text-silver-600">· {teacherOf(x.teacherId)}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-silver-600">لا اختيارات بعد</p>
                  )}
                  {missing.length > 0 && <p className="mt-1.5 text-[11px] font-bold text-amber-800">⏳ لم تختر بعد: {missing.map((t) => t.name).join("، ")}</p>}
                </div>

                {/* 🏅 لقاءات اللوحة */}
                <p className="mb-1.5 font-kufi text-sm font-bold text-plum-800">🏅 متميزات اللقاءات</p>
                {dates.length ? (
                  <div className="grid gap-1.5">
                    {dates.map((dt) => {
                      const picks = weekPicks.filter((x) => x.period === dt);
                      const miss = tIn.filter((t) => !picks.some((x) => x.teacherId === t.id));
                      return (
                        <div key={dt} className="rounded-xl bg-cream/70 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-plum-600">
                              لقاء {ar(sessionOf(dt))} · {dayLabel(dt)}
                            </span>
                            <button
                              type="button"
                              onClick={() => onDesign(h.id, picks.map((x) => x.studentId), "متميزات الأسبوع")}
                              className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-plum-700"
                            >
                              🎨
                            </button>
                          </div>
                          <p className="mt-0.5 text-sm font-bold text-plum-800">{picks.map((x) => nameOf(x.studentId)).join(" · ")}</p>
                          {miss.length > 0 && <p className="text-[10px] font-bold text-amber-700">⏳ لم تختر: {miss.map((t) => t.name).join("، ")}</p>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-silver-600">لا اختيارات في لقاءات هذه اللوحة بعد</p>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
