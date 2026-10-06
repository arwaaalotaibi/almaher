"use client";

import { useMemo, useState } from "react";
import { buildSchedule, dateKey, EMPTY_PLAN, halaqaTitle, useApp, type Halaqa } from "@/lib/store";
import { monthKey, monthLabel } from "./honor-month-card";

const ar = (n: number) => n.toLocaleString("ar-EG");
const dayLabel = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("ar-u-ca-gregory-nu-arab", { weekday: "long", day: "numeric", month: "long" });

/** 📋 اختيارات المعلّمات للإدارة: لوحة الشرف الشهرية ومتميزات اللقاءات — عرض وطباعة ونسخ */
export function HonorList({ onDesign }: { onDesign: (halaqaId: string, studentIds: string[], title: string) => void }) {
  const { honors, students, teachers, halaqas } = useApp();
  const all = useMemo(() => honors ?? [], [honors]);
  const now = new Date();
  const months = useMemo(() => {
    const set = new Set<string>([monthKey(now), monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1))]);
    for (const h of all) set.add(h.kind === "month" ? h.period : h.period.slice(0, 7));
    return [...set].sort().reverse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all]);
  const [month, setMonth] = useState(monthKey(now));
  const [hid, setHid] = useState("");

  const nameOf = (id: string) => students.find((s) => s.id === id)?.name ?? "—";
  const teacherOf = (id: string) => (id ? teachers.find((t) => t.id === id)?.name ?? "" : "الإدارة");
  const shown = halaqas.filter((h) => !hid || h.id === hid);
  const sessionNo = (h: Halaqa, d: string) => buildSchedule(h, EMPTY_PLAN)?.find((r) => dateKey(r.date) === d)?.n ?? 0;
  // معلّمات الحلقة اللواتي لهنّ طالبات فيها (لمعرفة من لم تختر بعد)
  const teachersIn = (h: Halaqa) =>
    teachers.filter((t) => t.halaqaIds.includes(h.id) && students.some((s) => s.halaqaId === h.id && s.teacherId === t.id));

  const data = shown.map((h) => {
    const monthPicks = all.filter((x) => x.kind === "month" && x.period === month && x.halaqaId === h.id);
    const weekPicks = all.filter((x) => x.kind === "week" && x.period.startsWith(month) && x.halaqaId === h.id);
    const dates = [...new Set(weekPicks.map((x) => x.period))].sort();
    return { h, monthPicks, weekPicks, dates };
  });

  /** نص للطباعة/النسخ */
  const asText = () =>
    data
      .filter((d) => d.monthPicks.length || d.weekPicks.length)
      .map((d) => {
        const lines = [`🕌 ${halaqaTitle(d.h)}`];
        if (d.monthPicks.length) lines.push(`🏆 لوحة الشرف — ${monthLabel(month)}:`, ...d.monthPicks.map((x) => `   • ${nameOf(x.studentId)}`));
        if (d.dates.length) {
          lines.push(`🏅 متميزات اللقاءات:`);
          for (const dt of d.dates)
            lines.push(`   لقاء ${ar(sessionNo(d.h, dt))} (${dayLabel(dt)}): ${d.weekPicks.filter((x) => x.period === dt).map((x) => nameOf(x.studentId)).join("، ")}`);
        }
        return lines.join("\n");
      })
      .join("\n\n");

  const print = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
    const body = data
      .filter((d) => d.monthPicks.length || d.weekPicks.length)
      .map(
        (d) => `<section><h2>🕌 ${esc(halaqaTitle(d.h))}</h2>
        ${d.monthPicks.length ? `<h3>🏆 لوحة الشرف — ${esc(monthLabel(month))}</h3><ol>${d.monthPicks.map((x) => `<li>${esc(nameOf(x.studentId))}</li>`).join("")}</ol>` : ""}
        ${d.dates.length ? `<h3>🏅 متميزات اللقاءات</h3><table>${d.dates.map((dt) => `<tr><td>لقاء ${ar(sessionNo(d.h, dt))}<br><small>${esc(dayLabel(dt))}</small></td><td>${d.weekPicks.filter((x) => x.period === dt).map((x) => esc(nameOf(x.studentId))).join("<br>")}</td></tr>`).join("")}</table>` : ""}
      </section>`
      )
      .join("");
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>لوحة الشرف — ${esc(monthLabel(month))}</title>
      <style>body{font-family:"Geeza Pro","Noto Naskh Arabic",Tahoma,serif;color:#4d3340;padding:24px}h1{text-align:center;margin:0 0 4px}p.s{text-align:center;color:#8b7c84;margin:0 0 18px}
      section{break-inside:avoid;border:2px solid #e8d9b5;border-radius:14px;padding:12px 16px;margin-bottom:14px}h2{margin:0 0 6px;font-size:20px}h3{margin:10px 0 4px;font-size:16px;color:#7d5a6c}
      ol{margin:0;padding-inline-start:26px;font-size:18px;font-weight:bold;list-style:arabic-indic}table{width:100%;border-collapse:collapse;font-size:15px}td{border-bottom:1px solid #eee;padding:5px 4px;vertical-align:top}td:first-child{width:34%;color:#7d5a6c;font-weight:bold}small{color:#8b7c84;font-weight:normal}</style></head>
      <body><h1>🏆 لوحة الشرف ومتميزات اللقاءات</h1><p class="s">جمعية الماهر بالقرآن — ${esc(monthLabel(month))}</p>${body || "<p class='s'>لا اختيارات في هذا الشهر</p>"}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`🏆 لوحة الشرف ومتميزات اللقاءات — ${monthLabel(month)}\n\n${asText()}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* */
    }
  };

  const any = data.some((d) => d.monthPicks.length || d.weekPicks.length);

  return (
    <div>
      {/* الشهر والحلقة */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {months.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMonth(m)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${month === m ? "bg-plum-600 text-white" : "bg-cream text-plum-700"}`}
          >
            {monthLabel(m)}
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
        <button type="button" onClick={print} disabled={!any} className="rounded-xl bg-plum-600 py-2.5 text-sm font-bold text-white disabled:opacity-40">
          🖨️ طباعة الأسماء
        </button>
        <button type="button" onClick={copy} disabled={!any} className="rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white disabled:opacity-40">
          {copied ? "✓ نُسخت" : "📋 نسخ للواتساب"}
        </button>
      </div>

      {data.map(({ h, monthPicks, weekPicks, dates }) => {
        const tIn = teachersIn(h);
        const missingMonth = tIn.filter((t) => !monthPicks.some((x) => x.teacherId === t.id));
        return (
          <div key={h.id} className="card mb-4 rounded-2xl p-4">
            <h2 className="mb-3 font-kufi text-base font-bold text-plum-800">🕌 {halaqaTitle(h)}</h2>

            {/* 🏆 الشهرية */}
            <div className="mb-3 rounded-xl bg-amber-50 p-3">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="font-kufi text-sm font-bold text-amber-900">🏆 لوحة الشرف — {monthLabel(month)}</p>
                {monthPicks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onDesign(h.id, monthPicks.map((x) => x.studentId), "لوحة الشرف")}
                    className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-plum-700"
                  >
                    🎨 إعلان
                  </button>
                )}
              </div>
              {monthPicks.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {monthPicks.map((x) => (
                    <span key={x.id} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-plum-800">
                      🏆 {nameOf(x.studentId)} <span className="text-[10px] text-silver-600">· {teacherOf(x.teacherId)}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-silver-600">لا اختيارات بعد</p>
              )}
              {missingMonth.length > 0 && (
                <p className="mt-1.5 text-[11px] font-bold text-amber-800">⏳ لم تختر بعد: {missingMonth.map((t) => t.name).join("، ")}</p>
              )}
            </div>

            {/* 🏅 اللقاءات */}
            <p className="mb-1.5 font-kufi text-sm font-bold text-plum-800">🏅 متميزات اللقاءات</p>
            {dates.length ? (
              <div className="grid gap-1.5">
                {dates.map((dt) => {
                  const picks = weekPicks.filter((x) => x.period === dt);
                  const missing = tIn.filter((t) => !picks.some((x) => x.teacherId === t.id));
                  return (
                    <div key={dt} className="rounded-xl bg-cream/70 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-plum-600">
                          لقاء {ar(sessionNo(h, dt))} · {dayLabel(dt)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onDesign(h.id, picks.map((x) => x.studentId), "متميزات الأسبوع")}
                          className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-plum-700"
                        >
                          🎨
                        </button>
                      </div>
                      <p className="mt-0.5 text-sm font-bold text-plum-800">
                        {picks.map((x) => nameOf(x.studentId)).join(" · ")}
                      </p>
                      {missing.length > 0 && <p className="text-[10px] font-bold text-amber-700">⏳ لم تختر: {missing.map((t) => t.name).join("، ")}</p>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-silver-600">لا اختيارات في هذا الشهر</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
