"use client";

import { useMemo, useState } from "react";
import {
  activeStudents, halaqaTitle, useApp, whatsappLink, type Student } from "@/lib/store";
import { ALLOWED_ABSENCES, termAbsenceDates } from "@/lib/absence";
import { PageHeader, useHydrated } from "@/components/ui";
import { RoleOnly } from "@/components/admin-only";
import { StudentSheet } from "@/components/student-sheet";

const ar = (n: number) => n.toLocaleString("ar-EG");

const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("ar-u-ca-gregory-nu-arab", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

type Row = { st: Student; dates: string[] };

/** 🚫 متابعة الغياب — شاشة واحدة للإدارة: من غابت مرة، مرتين، ثلاثاً (بلغت الحدّ)،
    أو أكثر (تجاوزت الحدّ) هذا الفصل، مع تواريخ الغياب ومراسلة مباشرة. */
export default function AbsencesPage() {
  return (
    <RoleOnly roles={["admin", "teacher"]}>
      <AbsencesInner />
    </RoleOnly>
  );
}

const TIERS: { n: number; label: string; hint: string; cls: string; chip: string }[] = [
  { n: 1, label: "غابت مرة", hint: "غياب واحد", cls: "bg-cream text-plum-800", chip: "border-cream-dark bg-white" },
  { n: 2, label: "غابت مرتين", hint: "بقي غياب واحد مسموح", cls: "bg-amber-50 text-amber-900", chip: "border-amber-200 bg-amber-50" },
  { n: 3, label: "غابت ٣ مرات", hint: "بلغت الحدّ المسموح", cls: "bg-orange-100 text-orange-900", chip: "border-orange-300 bg-orange-50" },
  { n: 4, label: "أكثر من ٣", hint: "تجاوزت الحدّ المسموح", cls: "bg-red-100 text-red-900", chip: "border-red-300 bg-red-50" },
];

function AbsencesInner() {
  const { students: allStudents, halaqas, recitations } = useApp();
  const students = useMemo(() => activeStudents(allStudents), [allStudents]);
  const hydrated = useHydrated();
  const [halaqaId, setHalaqaId] = useState("");
  const [selected, setSelected] = useState<Student | null>(null);

  const groups = useMemo(() => {
    const byTier: Record<number, Row[]> = { 1: [], 2: [], 3: [], 4: [] };
    let present = 0;
    for (const st of students) {
      if (halaqaId && st.halaqaId !== halaqaId) continue;
      const h = halaqas.find((x) => x.id === st.halaqaId);
      const dates = termAbsenceDates(recitations, st.id, h?.termStart);
      if (dates.length === 0) {
        present++;
        continue;
      }
      byTier[Math.min(4, dates.length)].push({ st, dates });
    }
    for (const k of Object.keys(byTier)) {
      byTier[Number(k)].sort((a, b) =>
        b.dates.length !== a.dates.length ? b.dates.length - a.dates.length : a.st.name.localeCompare(b.st.name, "ar")
      );
    }
    return { byTier, present };
  }, [students, halaqas, recitations, halaqaId]);

  if (!hydrated) return <main className="mx-auto max-w-2xl px-4 pt-10" />;

  const hLabel = (st: Student) => {
    const h = halaqas.find((x) => x.id === st.halaqaId);
    return h ? halaqaTitle(h) : "";
  };
  const totalAbsent = Object.values(groups.byTier).reduce((n, g) => n + g.length, 0);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-8">
      <PageHeader title="🚫 متابعة الغياب" back="/" />
      <p className="-mt-2 mb-4 text-sm text-silver-600">
        غيابات هذا الفصل من تاريخ بدايته. المسموح {ar(ALLOWED_ABSENCES)} غيابات في الفصل بحسب اللائحة.
      </p>

      {/* تصفية بالحلقة */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {[{ id: "", label: "كل الحلقات" }, ...halaqas.map((h) => ({ id: h.id, label: halaqaTitle(h) }))].map(
          (h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setHalaqaId(h.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                halaqaId === h.id ? "bg-plum-600 text-white" : "bg-cream text-plum-700"
              }`}
            >
              {h.label}
            </button>
          )
        )}
      </div>

      {/* ملخّص */}
      <div className="mb-5 grid grid-cols-4 gap-1.5 text-center">
        {TIERS.map((t) => (
          <div key={t.n} className={`rounded-2xl py-3 ${t.cls}`}>
            <p className="text-xl font-bold">{ar(groups.byTier[t.n].length)}</p>
            <p className="text-[10px] font-bold">{t.label}</p>
          </div>
        ))}
      </div>
      <p className="mb-5 rounded-xl bg-emerald-50 px-3 py-2 text-center text-xs font-bold text-emerald-800">
        🌟 بلا غياب: {ar(groups.present)} طالبة
      </p>
      {totalAbsent === 0 && (
        <div className="card mb-4 rounded-2xl p-6 text-center text-sm text-silver-600">
          لا غيابات مسجّلة هذا الفصل 🎉
        </div>
      )}

      {[...TIERS].reverse().map((t) => {
        const rows = groups.byTier[t.n];
        if (rows.length === 0) return null;
        return (
          <section key={t.n} className="mb-6">
            <h2 className="mb-2 font-kufi text-base font-bold text-plum-800">
              {t.n >= ALLOWED_ABSENCES ? "⚠️ " : ""}
              {t.label} ({ar(rows.length)}) <span className="text-xs font-medium text-silver-600">— {t.hint}</span>
            </h2>
            <div className="grid gap-2">
              {rows.map(({ st, dates }) => (
                <div key={st.id} className={`rounded-2xl border-2 p-3 ${t.chip}`}>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelected(st)}
                      className="min-w-0 flex-1 text-start"
                    >
                      <span className="block truncate text-sm font-bold text-plum-800">🌸 {st.name}</span>
                      {!halaqaId && <span className="block text-[11px] text-silver-600">{hLabel(st)}</span>}
                    </button>
                    <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-plum-800">
                      {ar(dates.length)} غياب
                    </span>
                    <a
                      href={whatsappLink(
                        st.phone,
                        `السلام عليكم «${st.name}» 🌸\nافتقدناكِ في الحلقة، عدد غياباتكِ هذا الفصل ${ar(dates.length)} والمسموح ${ar(ALLOWED_ABSENCES)}. `
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-xl bg-emerald-500 px-2.5 py-1.5 text-xs font-bold text-white"
                      aria-label="مراسلة عبر واتساب"
                    >
                      📲
                    </a>
                  </div>
                  <p className="mt-1.5 text-[11px] text-silver-600">
                    📅 {dates.map(fmtDate).join(" · ")}
                  </p>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <StudentSheet
        student={selected ? (students.find((s) => s.id === selected.id) ?? selected) : null}
        onClose={() => setSelected(null)}
      />
    </main>
  );
}
