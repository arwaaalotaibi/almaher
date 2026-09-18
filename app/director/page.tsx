"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  activeStudents,
  dateKey,
  halaqaTitle,
  isDesc,
  isMurDesc,
  useApp,
  type Student,
} from "@/lib/store";
import { computeProgress, partFaces } from "@/lib/progress";
import { computeRace, sinceDays } from "@/lib/points";
import { buildReports, downloadCsv, reportsToCsv } from "@/lib/report";
import { ALLOWED_ABSENCES, termAbsenceDates } from "@/lib/absence";
import { PageHeader, useHydrated } from "@/components/ui";
import { RoleOnly } from "@/components/admin-only";
import { StudentSheet } from "@/components/student-sheet";

const ar = (n: number) => n.toLocaleString("ar-EG");
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("ar-u-ca-gregory-nu-arab", { day: "numeric", month: "short" });

type PeriodKey = "term" | "30" | "7" | "all";
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "term", label: "هذا الفصل" },
  { key: "30", label: "٣٠ يوماً" },
  { key: "7", label: "٧ أيام" },
  { key: "all", label: "الكل" },
];

type SortKey = "points" | "hifz" | "mur" | "attend" | "name";

/** 📈 نبض الماهر (شاشة المديرة) — نظرة واحدة على كل الحلقات: نتائج السباق، كمية التسميع،
    الحضور، ومن تحتاج متابعة. مختصرة في الأعلى وتفصيلية في الأسفل. */
export default function DirectorPage() {
  return (
    <RoleOnly roles={["admin"]}>
      <DirectorInner />
    </RoleOnly>
  );
}

function DirectorInner() {
  const state = useApp();
  const { halaqas, recitations, readingProgress, tajweedResults } = state;
  const students = useMemo(() => activeStudents(state.students), [state.students]);
  const hydrated = useHydrated();
  const [halaqaId, setHalaqaId] = useState("");
  const [period, setPeriod] = useState<PeriodKey>("term");
  const [sort, setSort] = useState<SortKey>("points");
  const [showAllRace, setShowAllRace] = useState(false);
  const [selected, setSelected] = useState<Student | null>(null);
  const [more, setMore] = useState<Record<string, boolean>>({});

  const scope = useMemo(
    () => (halaqaId ? students.filter((s) => s.halaqaId === halaqaId) : students),
    [students, halaqaId]
  );

  /** بداية الفترة لكل طالبة (هذا الفصل = بداية فصل حلقتها) */
  const sinceFor = (s: Student): string => {
    if (period === "all") return "";
    if (period === "term") return halaqas.find((h) => h.id === s.halaqaId)?.termStart ?? "";
    return sinceDays(Number(period));
  };

  /** نقاط السباق ضمن الفترة — تُحسب لكل مجموعة بداية على حدة ثم تُدمج وتُرتّب */
  const race = useMemo(() => {
    const groups = new Map<string, Student[]>();
    for (const s of scope) {
      const k = sinceFor(s);
      groups.set(k, [...(groups.get(k) ?? []), s]);
    }
    const all = [...groups.entries()].flatMap(([since, list]) =>
      computeRace(list, halaqas, recitations, readingProgress, tajweedResults, { sinceISO: since || undefined })
    );
    all.sort((a, b) => b.points - a.points || b.faces - a.faces || a.name.localeCompare(b.name, "ar"));
    let rank = 0;
    let prev = -1;
    all.forEach((e, i) => {
      if (e.points !== prev) {
        rank = i + 1;
        prev = e.points;
      }
      e.rank = rank;
    });
    return all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, halaqas, recitations, readingProgress, tajweedResults, period]);

  const reports = useMemo(() => buildReports(state), [state]);
  const reportOf = useMemo(() => new Map(reports.map((r) => [r.student.id, r])), [reports]);
  const pointsOf = useMemo(() => new Map(race.map((e) => [e.studentId, e])), [race]);

  /** كمية التسميع لكل طالبة ضمن الفترة */
  const rows = useMemo(() => {
    const today = dateKey(new Date());
    return scope.map((s) => {
      const since = sinceFor(s);
      const h = halaqas.find((x) => x.id === s.halaqaId);
      const mine = recitations.filter((r) => r.studentId === s.id && (!since || r.date >= since) && r.date <= today);
      let attends = 0,
        absents = 0,
        hifz = 0,
        tathbit = 0,
        mur = 0;
      for (const r of mine) {
        if (!r.attended) {
          absents++;
          continue;
        }
        attends++;
        hifz += r.faces?.tasmi ?? partFaces(r.tasmi, isDesc(s.plan));
        tathbit += r.faces?.tathbit ?? partFaces(r.tathbit, isDesc(s.plan));
        mur += r.faces?.muraja ?? partFaces(r.muraja, isMurDesc(s.plan), "muraja");
      }
      const rep = reportOf.get(s.id);
      const prog = computeProgress(s, recitations, h);
      return {
        s,
        h,
        attends,
        absents,
        hifz,
        tathbit,
        mur,
        points: pointsOf.get(s.id)?.points ?? 0,
        rank: pointsOf.get(s.id)?.rank ?? 0,
        termPct: rep?.termPct ?? null,
        ahead: rep?.aheadPages ?? null,
        absentStreak: rep?.absentStreak ?? 0,
        missedLast: rep?.missedLastMeeting ?? false,
        termAbs: termAbsenceDates(recitations, s.id, h?.termStart).length,
        pos: prog.currentTasmiLabel || "",
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, halaqas, recitations, reportOf, pointsOf, period]);

  if (!hydrated) return <main className="mx-auto max-w-2xl px-4 pt-10" />;

  // ===== مؤشرات عامة =====
  const tAttends = rows.reduce((n, r) => n + r.attends, 0);
  const tAbsents = rows.reduce((n, r) => n + r.absents, 0);
  const tHifz = rows.reduce((n, r) => n + r.hifz, 0);
  const tMur = rows.reduce((n, r) => n + r.mur, 0);
  const behind = rows.filter((r) => r.ahead !== null && r.ahead < 0).sort((a, b) => (a.ahead ?? 0) - (b.ahead ?? 0));
  const streaks = rows.filter((r) => r.absentStreak >= 2).sort((a, b) => b.absentStreak - a.absentStreak);
  const missed = rows.filter((r) => r.missedLast);
  const overLimit = rows.filter((r) => r.termAbs >= ALLOWED_ABSENCES).sort((a, b) => b.termAbs - a.termAbs);
  const needAttention = new Set([...behind, ...streaks, ...overLimit].map((r) => r.s.id)).size;
  const leader = race.find((e) => e.points > 0);

  // ===== الحلقات =====
  const byHalaqa = halaqas
    .filter((h) => !halaqaId || h.id === halaqaId)
    .map((h) => {
      const hr = rows.filter((r) => r.s.halaqaId === h.id);
      const at = hr.reduce((n, r) => n + r.attends, 0);
      const ab = hr.reduce((n, r) => n + r.absents, 0);
      const hf = hr.reduce((n, r) => n + r.hifz, 0);
      const mr = hr.reduce((n, r) => n + r.mur, 0);
      const best = [...hr].sort((a, b) => b.points - a.points)[0];
      const lastDate = recitations
        .filter((r) => hr.some((x) => x.s.id === r.studentId))
        .map((r) => r.date)
        .sort()
        .pop();
      return { h, n: hr.length, at, ab, hf, mr, best, lastDate, behind: hr.filter((r) => r.ahead !== null && r.ahead < 0).length };
    });

  // ===== السباق =====
  const active = race.filter((e) => e.points > 0);
  const raceList = showAllRace ? active : active.slice(0, 10);

  // ===== الجدول التفصيلي =====
  const sorted = [...rows].sort((a, b) => {
    if (sort === "name") return a.s.name.localeCompare(b.s.name, "ar");
    if (sort === "hifz") return b.hifz - a.hifz || b.points - a.points;
    if (sort === "mur") return b.mur - a.mur || b.points - a.points;
    if (sort === "attend") return pct(b.attends, b.attends + b.absents) - pct(a.attends, a.attends + a.absents) || b.attends - a.attends;
    return b.points - a.points || b.hifz - a.hifz;
  });

  const open = (s: Student) => setSelected(s);
  const periodLabel = PERIODS.find((p) => p.key === period)!.label;

  const exportCsv = () => {
    const list = halaqaId ? reports.filter((r) => r.student.halaqaId === halaqaId) : reports;
    downloadCsv(reportsToCsv(list), `نبض-الماهر-${dateKey(new Date())}.csv`);
  };

  const Section = ({ title, children, hint }: { title: string; hint?: string; children: React.ReactNode }) => (
    <section className="mb-6">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="font-kufi text-base font-bold text-plum-800">{title}</h2>
        {hint && <span className="text-[11px] text-silver-600">{hint}</span>}
      </div>
      {children}
    </section>
  );

  const Person = ({ r, metric, tone = "plum" }: { r: (typeof rows)[number]; metric: string; tone?: "plum" | "amber" | "red" }) => (
    <button
      type="button"
      onClick={() => open(r.s)}
      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-start ${
        tone === "red" ? "border-red-200 bg-red-50" : tone === "amber" ? "border-amber-200 bg-amber-50" : "border-cream-dark bg-white"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-plum-800">{r.s.name}</span>
        {!halaqaId && r.h && <span className="block text-[10px] text-silver-600">{halaqaTitle(r.h)}</span>}
      </span>
      <span className="shrink-0 text-xs font-bold text-plum-700">{metric}</span>
    </button>
  );

  const ListMore = ({ id, items, render, empty }: { id: string; items: (typeof rows)[number][]; render: (r: (typeof rows)[number]) => React.ReactNode; empty: string }) => {
    const lim = more[id] ? items.length : 5;
    return items.length === 0 ? (
      <p className="rounded-xl bg-cream/60 px-3 py-2 text-xs text-silver-600">{empty}</p>
    ) : (
      <div className="grid gap-1.5">
        {items.slice(0, lim).map(render)}
        {items.length > 5 && (
          <button type="button" onClick={() => setMore((m) => ({ ...m, [id]: !m[id] }))} className="text-xs font-bold text-plum-700 underline">
            {more[id] ? "أقل" : `عرض الكل (${ar(items.length)})`}
          </button>
        )}
      </div>
    );
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-8">
      <PageHeader title="📈 نبض الماهر" back="/" />

      {/* النطاق والفترة */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {[{ id: "", label: "🌍 كل الحلقات" }, ...halaqas.map((h) => ({ id: h.id, label: halaqaTitle(h) }))].map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => setHalaqaId(h.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${halaqaId === h.id ? "bg-plum-600 text-white" : "bg-cream text-plum-700"}`}
          >
            {h.label}
          </button>
        ))}
      </div>
      <div className="mb-4 flex gap-1 rounded-2xl bg-cream p-1">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriod(p.key)}
            className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition ${period === p.key ? "bg-white text-plum-800 shadow-sm" : "text-silver-600"}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* المؤشرات */}
      <div className="mb-5 grid grid-cols-3 gap-2">
        {[
          { i: "🌸", l: "طالبة", v: ar(rows.length) },
          { i: "✅", l: "نسبة الحضور", v: `${ar(pct(tAttends, tAttends + tAbsents))}٪`, sub: `${ar(tAttends)} حضور · ${ar(tAbsents)} غياب` },
          { i: "📖", l: "أوجه الحفظ", v: ar(tHifz), sub: tAttends ? `${(tHifz / tAttends).toFixed(1)} للقاء` : "" },
          { i: "🔁", l: "أوجه المراجعة", v: ar(tMur), sub: tAttends ? `${(tMur / tAttends).toFixed(1)} للقاء` : "" },
          { i: "⚠️", l: "يحتجن متابعة", v: ar(needAttention), sub: `${ar(behind.length)} متأخرة · ${ar(overLimit.length)} غياب ≥${ar(ALLOWED_ABSENCES)}` },
          { i: "🏆", l: "المتصدرة", v: leader ? leader.name.split(/\s+/).slice(0, 2).join(" ") : "—", sub: leader ? `${ar(leader.points)} نقطة` : "", small: true },
        ].map((k) => (
          <div key={k.l} className="card rounded-2xl px-2 py-3 text-center">
            <p className={`font-bold text-plum-800 ${k.small ? "truncate text-sm" : "text-xl"}`}>{k.v}</p>
            <p className="mt-0.5 text-[10px] font-bold text-silver-600">{k.i} {k.l}</p>
            {k.sub && <p className="text-[10px] text-silver-500">{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* الحلقات */}
      {!halaqaId && (
        <Section title="🕌 الحلقات" hint={periodLabel}>
          <div className="overflow-x-auto rounded-2xl border border-cream-dark">
            <table className="w-full min-w-[520px] text-xs">
              <thead className="bg-cream text-[11px] text-plum-800">
                <tr>
                  <th className="px-2 py-2 text-start">الحلقة</th>
                  <th className="px-2 py-2">طالبات</th>
                  <th className="px-2 py-2">حضور</th>
                  <th className="px-2 py-2">📖 حفظ</th>
                  <th className="px-2 py-2">🔁 مراجعة</th>
                  <th className="px-2 py-2">متأخرات</th>
                  <th className="px-2 py-2 text-start">آخر تسجيل</th>
                  <th className="px-2 py-2 text-start">الأولى</th>
                </tr>
              </thead>
              <tbody>
                {byHalaqa.map((x) => (
                  <tr key={x.h.id} className="border-t border-cream-dark">
                    <td className="px-2 py-2">
                      <button type="button" onClick={() => setHalaqaId(x.h.id)} className="font-bold text-plum-800 underline decoration-dotted underline-offset-4">
                        {halaqaTitle(x.h)}
                      </button>
                    </td>
                    <td className="px-2 py-2 text-center">{ar(x.n)}</td>
                    <td className="px-2 py-2 text-center font-bold">{x.at + x.ab ? `${ar(pct(x.at, x.at + x.ab))}٪` : "—"}</td>
                    <td className="px-2 py-2 text-center">{ar(x.hf)}</td>
                    <td className="px-2 py-2 text-center">{ar(x.mr)}</td>
                    <td className={`px-2 py-2 text-center ${x.behind ? "font-bold text-amber-800" : ""}`}>{ar(x.behind)}</td>
                    <td className="px-2 py-2 text-silver-600">{x.lastDate ? fmtDate(x.lastDate) : "—"}</td>
                    <td className="px-2 py-2 truncate text-plum-700">{x.best && x.best.points > 0 ? x.best.s.name.split(/\s+/).slice(0, 2).join(" ") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* السباق */}
      <Section title="🏆 نتائج السباق" hint={`${periodLabel} · ${ar(active.length)} طالبة لها نقاط`}>
        {active.length === 0 ? (
          <p className="rounded-xl bg-cream/60 px-3 py-2 text-xs text-silver-600">لا نقاط في هذه الفترة بعد</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-cream-dark">
            {raceList.map((e, i) => {
              const r = rows.find((x) => x.s.id === e.studentId);
              const medal = e.rank === 1 ? "🥇" : e.rank === 2 ? "🥈" : e.rank === 3 ? "🥉" : ar(e.rank);
              return (
                <button
                  key={e.studentId}
                  type="button"
                  onClick={() => r && open(r.s)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-start ${i % 2 ? "bg-cream/40" : "bg-white"} ${e.rank <= 3 ? "font-bold" : ""}`}
                >
                  <span className="w-7 shrink-0 text-center text-sm">{medal}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-plum-800">{e.name}</span>
                    {!halaqaId && <span className="block text-[10px] font-normal text-silver-600">{e.halaqaLabel}</span>}
                  </span>
                  <span className="shrink-0 text-[11px] text-silver-600">📖 {ar(e.faces)} · 🕌 {ar(e.attends)}</span>
                  <span className="w-16 shrink-0 text-end text-sm font-bold text-plum-700">{ar(e.points)} ن</span>
                </button>
              );
            })}
            {active.length > 10 && (
              <button type="button" onClick={() => setShowAllRace((v) => !v)} className="w-full bg-cream py-2 text-xs font-bold text-plum-700">
                {showAllRace ? "أعلى ١٠ فقط" : `عرض الكل (${ar(active.length)})`}
              </button>
            )}
          </div>
        )}
      </Section>

      {/* متابعة */}
      <Section title="⚠️ يحتجن متابعة" hint="من الأهم إلى الأقل">
        <div className="grid gap-4">
          <div>
            <p className="mb-1.5 text-xs font-bold text-red-800">🚫 بلغن الحدّ المسموح من الغياب أو تجاوزنه ({ar(overLimit.length)})</p>
            <ListMore id="abs" items={overLimit} empty="لا أحد 🌸" render={(r) => <Person key={r.s.id} r={r} metric={`${ar(r.termAbs)} غيابات`} tone="red" />} />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-bold text-amber-900">📉 متأخرات عن خطة الحفظ ({ar(behind.length)})</p>
            <ListMore id="behind" items={behind} empty="الجميع على الخطة أو متقدّمات 🎉" render={(r) => <Person key={r.s.id} r={r} metric={`متأخرة ${ar(-(r.ahead ?? 0))} وجه`} tone="amber" />} />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-bold text-plum-800">🔁 غيابات متتالية ({ar(streaks.length)})</p>
            <ListMore id="streak" items={streaks} empty="لا غيابات متتالية" render={(r) => <Person key={r.s.id} r={r} metric={`${ar(r.absentStreak)} لقاءات متتالية`} />} />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-bold text-plum-800">⏳ لم يُسجَّل لهن آخر لقاء ({ar(missed.length)})</p>
            <ListMore id="missed" items={missed} empty="كل اللقاءات مسجّلة ✓" render={(r) => <Person key={r.s.id} r={r} metric="بلا سجل" />} />
          </div>
        </div>
      </Section>

      {/* كمية التسميع لكل طالبة */}
      <Section title="📖 كمية التسميع لكل طالبة" hint={periodLabel}>
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="font-bold text-plum-700">ترتيب:</span>
          {([
            ["points", "النقاط"],
            ["hifz", "الحفظ"],
            ["mur", "المراجعة"],
            ["attend", "الحضور"],
            ["name", "الاسم"],
          ] as [SortKey, string][]).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setSort(k)} className={`rounded-full px-2.5 py-1 font-bold ${sort === k ? "bg-plum-600 text-white" : "bg-cream text-plum-700"}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto rounded-2xl border border-cream-dark">
          <table className="w-full min-w-[560px] text-xs">
            <thead className="bg-cream text-[11px] text-plum-800">
              <tr>
                <th className="px-2 py-2 text-start">الطالبة</th>
                <th className="px-2 py-2">📖 حفظ</th>
                <th className="px-2 py-2">📌 تثبيت</th>
                <th className="px-2 py-2">🔁 مراجعة</th>
                <th className="px-2 py-2">حضور / غياب</th>
                <th className="px-2 py-2">نقاط</th>
                <th className="px-2 py-2">الخطة</th>
                <th className="px-2 py-2 text-start">وصلت إلى</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={r.s.id} className={`border-t border-cream-dark ${i % 2 ? "bg-cream/30" : ""}`}>
                  <td className="px-2 py-1.5">
                    <button type="button" onClick={() => open(r.s)} className="text-start font-bold text-plum-800">
                      {r.s.name}
                      {!halaqaId && r.h && <span className="block text-[10px] font-normal text-silver-600">{halaqaTitle(r.h)}</span>}
                    </button>
                  </td>
                  <td className="px-2 py-1.5 text-center font-bold">{ar(r.hifz)}</td>
                  <td className="px-2 py-1.5 text-center">{ar(r.tathbit)}</td>
                  <td className="px-2 py-1.5 text-center">{ar(r.mur)}</td>
                  <td className="px-2 py-1.5 text-center">
                    <span className="text-emerald-700">{ar(r.attends)}</span> / <span className={r.absents ? "text-red-700" : ""}>{ar(r.absents)}</span>
                  </td>
                  <td className="px-2 py-1.5 text-center font-bold text-plum-700">{ar(r.points)}</td>
                  <td className={`px-2 py-1.5 text-center ${r.ahead !== null && r.ahead < 0 ? "text-amber-800" : r.ahead !== null && r.ahead > 0 ? "text-emerald-700" : ""}`}>
                    {r.termPct !== null ? `${ar(r.termPct)}٪` : "—"}
                    {r.ahead !== null && r.ahead !== 0 && <span className="block text-[10px]">{r.ahead > 0 ? `+${ar(r.ahead)}` : `−${ar(-r.ahead)}`}</span>}
                  </td>
                  <td className="px-2 py-1.5 text-silver-600">{r.pos || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={exportCsv} className="rounded-xl bg-emerald-600 py-2.5 font-kufi text-sm font-bold text-white">
          ⬇️ تصدير Excel
        </button>
        <Link href="/absences" className="rounded-xl bg-cream py-2.5 text-center font-kufi text-sm font-bold text-plum-800">
          🚫 متابعة الغياب
        </Link>
      </div>

      <StudentSheet student={selected ? (students.find((s) => s.id === selected.id) ?? selected) : null} onClose={() => setSelected(null)} />
    </main>
  );
}
