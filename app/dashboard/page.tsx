"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { halaqaTitle, useApp, type Student } from "@/lib/store";
import {
  buildReports,
  downloadCsv,
  reportsToCsv,
  type StudentReport,
} from "@/lib/report";
import { byFaces, facesLabel } from "@/lib/arabic";
import { PageHeader, useHydrated } from "@/components/ui";
import { RoleOnly } from "@/components/admin-only";
import { StudentSheet } from "@/components/student-sheet";

const ar = (n: number) => n.toLocaleString("ar-EG");

export default function DashboardPage() {
  return (
    <RoleOnly roles={["admin"]}>
      <DashboardInner />
    </RoleOnly>
  );
}

/** صفّ طالبة في قوائم المتابعة — يفتح بياناتها */
function Row({
  r,
  metric,
  onOpen,
}: {
  r: StudentReport;
  metric: string;
  onOpen: (s: Student) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(r.student)}
      className="card flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition active:scale-[0.99]"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-kufi text-sm font-bold text-plum-800">
          {r.student.name}
        </span>
        <span className="block text-[10px] text-silver-600">
          🕌 {r.halaqaLabel}
        </span>
      </span>
      <span className="shrink-0 text-xs font-bold text-plum-700">{metric}</span>
    </button>
  );
}

function DashboardInner() {
  const state = useApp();
  const hydrated = useHydrated();
  const [scope, setScope] = useState(""); // معرّف الحلقة (المسجد + اليوم)، "" = الكل
  const [selected, setSelected] = useState<Student | null>(null);

  const reports = useMemo(() => buildReports(state), [state]);

  if (!hydrated) return <main className="mx-auto max-w-2xl px-4 pt-10" />;

  const list = scope ? reports.filter((r) => r.student.halaqaId === scope) : reports;
  // المسؤولة عن تسجيل الطالبة (التسجيل عند المعلّمات والإدارة فقط)
  const teacherOf = (s: Student) => state.teachers.find((t) => t.id === s.teacherId)?.name ?? "";

  const weekActive = list.filter((r) => r.weekActive);
  const missed = list.filter((r) => r.missedLastMeeting);
  const absents = list.filter((r) => r.absentStreak >= 2);
  const behind = list
    .filter((r) => r.aheadPages !== null && r.aheadPages < 0)
    .sort((a, b) => (a.aheadPages ?? 0) - (b.aheadPages ?? 0));
  const topWeek = [...list]
    .filter((r) => r.weekPoints > 0)
    .sort((a, b) => b.weekPoints - a.weekPoints)
    .slice(0, 3);

  const exportCsv = () => {
    const stamp = new Date()
      .toISOString()
      .slice(0, 10);
    downloadCsv(
      reportsToCsv(list),
      `تقرير-الماهر${scope ? `-${halaqaTitle(state.halaqas.find((h) => h.id === scope)!)}` : ""}-${stamp}.csv`
    );
  };

  const kpis = [
    { l: "طالبة", v: list.length, i: "🌸" },
    { l: "نشِطة هذا الأسبوع", v: weekActive.length, i: "✅" },
    { l: "لم يُسجَّل لهن آخر لقاء", v: missed.length, i: "⏳" },
    { l: "متأخرات عن الخطة", v: behind.length, i: "📉" },
  ];

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-8">
      <PageHeader title="📊 لوحة المتابعة" back="/" />

      {/* النطاق */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {["", ...state.halaqas.map((h) => h.id)].map((id) => (
          <button
            key={id || "all"}
            type="button"
            onClick={() => setScope(id)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
              scope === id
                ? "bg-plum-600 text-white"
                : "bg-cream text-silver-600"
            }`}
          >
            {id ? halaqaTitle(state.halaqas.find((h) => h.id === id)!) : "🕌 كل الحلقات"}
          </button>
        ))}
      </div>

      {/* المؤشرات */}
      <div className="mb-4 grid grid-cols-4 gap-2">
        {kpis.map((k) => (
          <div key={k.l} className="card rounded-2xl px-1 py-3 text-center">
            <p className="text-lg font-bold text-plum-800">{ar(k.v)}</p>
            <p className="mt-0.5 text-[10px] font-bold leading-snug text-silver-600">
              {k.i} {k.l}
            </p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={exportCsv}
        className="mb-6 w-full rounded-xl bg-emerald-600 py-2.5 font-kufi text-sm font-bold text-white transition active:scale-[0.98]"
      >
        ⬇️ تصدير تقرير Excel ({ar(list.length)} طالبة)
      </button>

      {/* يحتجن متابعة اليوم */}
      {missed.length > 0 && (
        <section className="mb-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="font-kufi text-sm font-bold text-plum-800">
              ⏳ لم يُسجَّل لهن آخر لقاء ({ar(missed.length)})
            </h2>
            <Link href="/followup" className="shrink-0 text-xs font-bold text-plum-700 underline">
              👩‍🏫 ذكّري المعلّمات ←
            </Link>
          </div>
          <div className="grid gap-1.5">
            {missed.map((r) => (
              <Row
                key={r.student.id}
                r={r}
                metric={teacherOf(r.student) ? `👩‍🏫 ${teacherOf(r.student)}` : "بلا معلّمة"}
                onOpen={setSelected}
              />
            ))}
          </div>
        </section>
      )}

      {absents.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 font-kufi text-sm font-bold text-plum-800">
            🚫 غيابات متتالية ({ar(absents.length)})
          </h2>
          <div className="grid gap-1.5">
            {absents.map((r) => (
              <Row
                key={r.student.id}
                r={r}
                metric={`${ar(r.absentStreak)} لقاءات`}
                onOpen={setSelected}
              />
            ))}
          </div>
        </section>
      )}

      {behind.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 font-kufi text-sm font-bold text-plum-800">
            📉 متأخرات عن الخطة ({ar(behind.length)})
          </h2>
          <div className="grid gap-1.5">
            {behind.map((r) => (
              <Row
                key={r.student.id}
                r={r}
                metric={`متأخرة ${byFaces(-(r.aheadPages ?? 0))}`}
                onOpen={setSelected}
              />
            ))}
          </div>
        </section>
      )}

      {topWeek.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 font-kufi text-sm font-bold text-plum-800">
            🌟 الأنشط هذا الأسبوع
          </h2>
          <div className="grid gap-1.5">
            {topWeek.map((r, i) => (
              <Row
                key={r.student.id}
                r={r}
                metric={`${["🥇", "🥈", "🥉"][i]} ${ar(r.weekPoints)} نقطة`}
                onOpen={setSelected}
              />
            ))}
          </div>
        </section>
      )}

      {missed.length === 0 && absents.length === 0 && behind.length === 0 && (
        <div className="card rounded-2xl p-8 text-center">
          <p className="text-3xl">🌤️</p>
          <p className="mt-2 font-kufi font-bold text-plum-800">
            كل شيء على ما يرام
          </p>
          <p className="mt-1 text-sm text-silver-600">
            لا طالبات يحتجن متابعة عاجلة في هذا النطاق
          </p>
        </div>
      )}

      {/* كل الطالبات — نظرة سريعة */}
      <section className="mb-5">
        <h2 className="mb-2 font-kufi text-sm font-bold text-plum-800">
          🌸 كل الطالبات ({ar(list.length)})
        </h2>
        <div className="grid gap-1.5">
          {[...list]
            .sort((a, b) => b.weekPoints - a.weekPoints)
            .map((r) => (
              <Row
                key={r.student.id}
                r={r}
                metric={
                  r.hifzFaces > 0
                    ? `📖 ${facesLabel(r.hifzFaces)}${r.termPct !== null ? ` · ${ar(r.termPct)}٪` : ""}`
                    : "لم تبدأ بعد"
                }
                onOpen={setSelected}
              />
            ))}
        </div>
      </section>

      <StudentSheet student={selected} onClose={() => setSelected(null)} />
    </main>
  );
}
