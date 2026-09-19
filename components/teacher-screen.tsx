"use client";

import { useMemo, useState } from "react";
import {
  buildSchedule,
  dateKey,
  EMPTY_PLAN,
  formatSchedDate,
  halaqaTitle,
  isWithdrawn,
  useApp,
  type Halaqa,
  type Student,
  type Teacher,
} from "@/lib/store";
import { StudentSheet } from "./student-sheet";
import { QuickSession } from "./quick-session";
import { NotificationsCard } from "./notifications-card";

const ar = (n: number) => n.toLocaleString("ar-EG");

/** 👩‍🏫 شاشة المعلّمة — واضحة ومريحة: ترحيب، ثم لكل حلقة: اللقاء الحالي وحالة التسجيل،
    وبطاقة تسجيل التسميع مفتوحة، ثم طالباتها بحالة كل واحدة. */
export function TeacherScreen({ teacher, onLogout }: { teacher: Teacher; onLogout: () => void }) {
  const { halaqas, students, recitations } = useApp();
  const [selected, setSelected] = useState<Student | null>(null);

  const herHalaqas = halaqas.filter((h) => teacher.halaqaIds.includes(h.id));
  const mine = (h: Halaqa) =>
    students.filter((s) => s.halaqaId === h.id && s.teacherId === teacher.id && !isWithdrawn(s));
  const orphans = (h: Halaqa) =>
    students.filter((s) => s.halaqaId === h.id && !s.teacherId && !isWithdrawn(s));
  const total = herHalaqas.reduce((n, h) => n + mine(h).length, 0);
  const today = dateKey(new Date());
  const firstName = teacher.name.trim().split(/\s+/)[0] || teacher.name;

  /** اللقاء الحالي لكل حلقة: لقاء اليوم إن كان، وإلا آخر لقاء مضى، وإلا الأول */
  const currentOf = useMemo(() => {
    const map = new Map<string, { n: number; date: string; isToday: boolean; next?: string }>();
    for (const h of herHalaqas) {
      const rows = buildSchedule(h, EMPTY_PLAN) ?? [];
      if (!rows.length) continue;
      const keys = rows.map((r) => ({ n: r.n, key: dateKey(r.date), d: r.date }));
      const todayRow = keys.find((r) => r.key === today);
      const passed = [...keys].reverse().find((r) => r.key <= today);
      const cur = todayRow ?? passed ?? keys[0];
      const next = keys.find((r) => r.key > today);
      map.set(h.id, {
        n: cur.n,
        date: formatSchedDate(cur.d),
        isToday: cur.key === today,
        next: next ? formatSchedDate(next.d) : undefined,
      });
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [herHalaqas.map((h) => h.id + h.termStart + h.termSessions + h.day).join("|"), today]);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-6">
      {/* ترحيب */}
      <div className="name-box mb-5 rounded-3xl px-5 py-5 text-white">
        <p className="text-sm text-white/80">أهلاً معلّمتنا 🌷</p>
        <h1 className="font-kufi text-2xl font-bold">{firstName}</h1>
        <p className="mt-2 text-sm text-white/90">
          {herHalaqas.length === 0
            ? "لم تُسند لكِ حلقة بعد — تواصلي مع الإدارة"
            : `${ar(total)} طالبة في ${herHalaqas.map(halaqaTitle).join(" و")}`}
        </p>
      </div>

      {herHalaqas.map((h) => {
        const list = mine(h);
        const extra = orphans(h);
        const cur = currentOf.get(h.id);
        const all = [...list, ...extra];
        // حالة التسجيل للقاء الحالي
        const curDateKey = (() => {
          const rows = buildSchedule(h, EMPTY_PLAN) ?? [];
          const r = rows.find((x) => x.n === cur?.n);
          return r ? dateKey(r.date) : "";
        })();
        const recorded = curDateKey
          ? all.filter((s) => recitations.some((r) => r.studentId === s.id && r.date === curDateKey)).length
          : 0;
        return (
          <section key={h.id} className="mb-8">
            <div className="mb-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-cream-dark">
              <h2 className="font-kufi text-lg font-bold text-plum-800">🕌 {halaqaTitle(h)}</h2>
              {cur ? (
                <>
                  <p className={`mt-1 text-sm font-bold ${cur.isToday ? "text-emerald-700" : "text-plum-700"}`}>
                    {cur.isToday ? "📍 لقاء اليوم" : "📅 آخر لقاء"}: لقاء {ar(cur.n)} — {cur.date}
                  </p>
                  <p className="mt-1 text-xs text-silver-600">
                    {recorded === all.length && all.length > 0
                      ? `✅ سُجّل لكل الطالبات (${ar(all.length)})`
                      : `🧮 تم تسجيل ${ar(recorded)} من ${ar(all.length)} طالبة`}
                    {cur.next && !cur.isToday && ` · اللقاء القادم ${cur.next}`}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-xs text-silver-600">لم تُحدَّد بداية الفصل لهذه الحلقة بعد</p>
              )}
            </div>

            {all.length > 0 && (
              <QuickSession
                halaqa={h}
                groups={[
                  { key: teacher.id, title: `المعلّمة ${teacher.name}`, list },
                  ...(extra.length ? [{ key: "none", title: "بدون معلّمة", list: extra }] : []),
                ]}
                onOpenStudent={setSelected}
                defaultOpen
              />
            )}

            {/* الطالبات */}
            <h3 className="mb-2 mt-4 text-sm font-bold text-plum-700">🌸 طالباتكِ ({ar(list.length)})</h3>
            {list.length === 0 ? (
              <p className="rounded-xl bg-cream/60 px-4 py-3 text-center text-sm text-silver-600">لا طالبات بعد</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {[...list]
                  .sort((a, b) => a.name.localeCompare(b.name, "ar"))
                  .map((s) => {
                    const done = curDateKey
                      ? recitations.find((r) => r.studentId === s.id && r.date === curDateKey)
                      : undefined;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelected(s)}
                        className="flex items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 text-start shadow-sm ring-1 ring-cream-dark active:scale-[0.99]"
                      >
                        <span className="min-w-0 truncate font-kufi text-base font-bold text-plum-800">{s.name}</span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            !done ? "bg-cream text-silver-600" : done.attended ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                          }`}
                        >
                          {!done ? "لم يُسجَّل" : done.attended ? "حاضرة ✓" : "غائبة"}
                        </span>
                      </button>
                    );
                  })}
              </div>
            )}
          </section>
        );
      })}

      <NotificationsCard halaqaIds={teacher.halaqaIds} />

      <button
        type="button"
        onClick={() => {
          if (window.confirm("تسجيل الخروج من هذا الجهاز؟")) onLogout();
        }}
        className="mx-auto mt-8 block text-sm font-bold text-silver-600 underline"
      >
        🚪 تسجيل الخروج
      </button>

      <StudentSheet
        student={selected ? (students.find((s) => s.id === selected.id) ?? selected) : null}
        onClose={() => setSelected(null)}
      />
    </main>
  );
}
