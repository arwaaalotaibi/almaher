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
import { ThemeToggle } from "./theme-toggle";
import { PushToggle } from "./push-toggle";
import { PushPrompt } from "./push-prompt";
import { teacherFollowups } from "@/lib/followup";

const ar = (n: number) => n.toLocaleString("ar-EG");

/** 👩‍🏫 شاشة المعلّمة — بسيطة وواضحة: ترحيب، ثم «المطلوب منكِ» (لقاءات ناقصة بزرّ يفتحها)،
    ثم لكل حلقة بطاقة تسجيل اللقاء (واجهة مبسّطة)، وفي الأسفل المساعدة والإعدادات. */
export function TeacherScreen({ teacher, onLogout }: { teacher: Teacher; onLogout: () => void }) {
  const { halaqas, students, recitations, teachers, settings } = useApp();
  // 👭 معلّمات تشاركهنّ طالباتهنّ (حلقة مشتركة) — تراهنّ وتسجّل لهنّ من رابطها
  const shareIds = settings.teacherShares?.[teacher.id] ?? [];
  const [selected, setSelected] = useState<Student | null>(null);

  const assigned = halaqas.filter((h) => teacher.halaqaIds.includes(h.id));
  const own = (h: Halaqa) =>
    students.filter((s) => s.halaqaId === h.id && s.teacherId === teacher.id && !isWithdrawn(s));
  const sharedOf = (h: Halaqa, tid: string) =>
    students.filter((s) => s.halaqaId === h.id && s.teacherId === tid && !isWithdrawn(s));
  const mine = (h: Halaqa) => [...own(h), ...shareIds.flatMap((tid) => sharedOf(h, tid))];
  // الحلقات التي لها فيها طالبات فقط (وإن لم يكن لها طالبات بعد تظهر حلقاتها المسندة)
  const withStudents = assigned.filter((h) => mine(h).length > 0);
  const herHalaqas = withStudents.length ? withStudents : assigned;
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

  // 📋 المطلوب منكِ: لقاءات مضت ولم تُسجَّل (لطالباتها وللحلقة المشتركة)
  const tasks = useMemo(() => {
    const ts = [teacher, ...teachers.filter((t) => shareIds.includes(t.id))];
    const merged = new Map<string, { h: Halaqa; n: number; date: string; label: string; count: number }>();
    for (const f of teacherFollowups(ts, herHalaqas, students, recitations)) {
      for (const hf of f.halaqas)
        for (const m of hf.missing) {
          const k = `${hf.halaqa.id}|${m.date}`;
          const cur = merged.get(k);
          if (cur) cur.count += m.names.length;
          else merged.set(k, { h: hf.halaqa, n: m.n, date: m.date, label: m.dateLabel, count: m.names.length });
        }
    }
    return [...merged.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacher, teachers, shareIds.join(","), herHalaqas, students, recitations]);

  // فتح لقاء معيّن في بطاقة حلقته (من «المطلوب منكِ») — nonce يعيد فتح البطاقة على التاريخ
  const [focus, setFocus] = useState<{ hid: string; date: string; nonce: number } | null>(null);
  const openSession = (hid: string, date: string) => {
    setFocus({ hid, date, nonce: Date.now() });
    setTimeout(() => document.getElementById(`qs-${hid}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-6">
      {/* ترحيب */}
      <div className="name-box mb-4 rounded-3xl px-5 py-5 text-white">
        <p className="text-sm text-white/80">أهلاً معلّمتنا 🌷</p>
        <h1 className="font-kufi text-2xl font-bold">{firstName}</h1>
        <p className="mt-2 text-sm text-white/90">
          {herHalaqas.length === 0
            ? "لم تُسند لكِ حلقة بعد — تواصلي مع الإدارة"
            : `${ar(total)} طالبة · ${herHalaqas.map(halaqaTitle).join(" · ")}`}
        </p>
      </div>

      {/* 🔔 إشعارات جوال المعلّمة: تذكير التسجيل بعد الحلقة ورسائل الإدارة */}
      <PushPrompt owner={{ teacher: true }} enabled />
      <PushToggle owner={{ teacher: true }} />

      {/* 📋 المطلوب منكِ */}
      {herHalaqas.length > 0 &&
        (tasks.length === 0 ? (
          <div className="mb-5 rounded-2xl bg-emerald-50 px-4 py-3 text-center font-kufi text-base font-bold text-emerald-800 ring-1 ring-emerald-200">
            ✅ كل اللقاءات الماضية مسجّلة — جزاكِ الله خيراً
          </div>
        ) : (
          <div className="mb-5 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-300">
            <p className="font-kufi text-base font-bold text-amber-900">📋 المطلوب منكِ — لقاءات لم تُسجَّل</p>
            <p className="mb-2 text-xs text-amber-800">ابدئي بالأقدم؛ لا يُفتح اللقاء التالي قبل تسجيل ما قبله 🔒</p>
            <div className="grid gap-2">
              {tasks.map((t) => (
                <button
                  key={t.h.id + t.date}
                  type="button"
                  onClick={() => openSession(t.h.id, t.date)}
                  className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2.5 text-start shadow-sm ring-1 ring-amber-200 active:scale-[0.99]"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-plum-800">
                      لقاء {ar(t.n)} · {t.label}
                    </span>
                    <span className="block text-xs text-silver-600">
                      {herHalaqas.length > 1 ? `${halaqaTitle(t.h)} · ` : ""}
                      {ar(t.count)} طالبة لم تُسجَّل
                    </span>
                  </span>
                  <span className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-bold text-white">سجّليه ←</span>
                </button>
              ))}
            </div>
          </div>
        ))}

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
        const f = focus?.hid === h.id ? focus : null;
        return (
          <section key={h.id} id={`qs-${h.id}`} className="mb-8 scroll-mt-4">
            <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-cream-dark">
              <div className="min-w-0">
                <h2 className="font-kufi text-lg font-bold text-plum-800">🕌 {halaqaTitle(h)}</h2>
                {cur ? (
                  <p className={`text-sm font-bold ${cur.isToday ? "text-emerald-700" : "text-plum-700"}`}>
                    {cur.isToday ? "📍 لقاء اليوم" : "📅 آخر لقاء"}: {ar(cur.n)} — {cur.date}
                  </p>
                ) : (
                  <p className="text-xs text-silver-600">لم تُحدَّد بداية الفصل لهذه الحلقة بعد</p>
                )}
              </div>
              {cur && all.length > 0 && (
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${
                    recorded === all.length ? "bg-emerald-100 text-emerald-800" : "bg-plum-50 text-plum-800"
                  }`}
                >
                  {recorded === all.length ? "✅ " : ""}
                  {ar(recorded)}/{ar(all.length)}
                </span>
              )}
            </div>

            {all.length > 0 && (
              <QuickSession
                key={f ? `${f.date}-${f.nonce}` : "cur"}
                halaqa={h}
                groups={[
                  { key: teacher.id, title: `طالباتي`, list: own(h) },
                  ...shareIds
                    .map((tid) => ({
                      key: tid,
                      title: `👭 مع المعلّمة ${teachers.find((t) => t.id === tid)?.name ?? ""}`,
                      list: sharedOf(h, tid),
                    }))
                    .filter((g) => g.list.length > 0),
                  ...(extra.length ? [{ key: "none", title: "بدون معلّمة", list: extra }] : []),
                ]}
                onOpenStudent={setSelected}
                defaultOpen
                initialDate={f?.date}
                simple
              />
            )}
          </section>
        );
      })}

      <NotificationsCard halaqaIds={teacher.halaqaIds} />

      {/* ⚙️ المساعدة والإعدادات — مطويّة لتبقى الشاشة بسيطة */}
      <details className="mt-6 rounded-2xl bg-white shadow-sm ring-1 ring-cream-dark open:pb-3">
        <summary className="cursor-pointer list-none px-4 py-3 font-kufi text-base font-bold text-plum-800">
          ❓ المساعدة والإعدادات <span className="float-start text-plum-500">▾</span>
        </summary>
        <div className="grid gap-3 px-4">
          <ol className="grid gap-2 text-sm leading-relaxed text-ink">
            {[
              ["📋", "تحت كل حلقة بطاقة التسجيل، واللقاء الحالي مختار تلقائياً. لتسجيل لقاء آخر غيّريه من قائمة «اللقاء»."],
              ["✅", "كل طالبة «حاضرة ✓» بوردها كاملاً. من غابت اضغطي الزر ليصير «غائبة ✗»."],
              ["➖➕", "من سمّعت أقل أو أكثر: − و+ يغيّران الأوجه، و✏️ يحدّد آية النهاية بدقة. ولإطفاء قسم لم تسمّعه اضغطي عليه."],
              ["💾", "«اعتماد» عند كل طالبة، أو «حفظ الجميع» في الأسفل. يصير الزر أخضر «تم الاعتماد»."],
              ["🔒", "لا يُفتح لقاء قبل تسجيل ما قبله — اضغطي «افتحي لقاء …» في الرسالة الصفراء."],
              ["📝", "زر 📝 لملاحظة على لقاء الطالبة، واضغطي اسمها لفتح ملفها وخطتها."],
            ].map(([icon, text], i) => (
              <li key={i} className="flex gap-2">
                <span className="w-8 shrink-0 text-center">{icon}</span>
                <span>{text}</span>
              </li>
            ))}
          </ol>
          <ThemeToggle />
          <button
            type="button"
            onClick={() => {
              if (window.confirm("تسجيل الخروج من هذا الجهاز؟")) onLogout();
            }}
            className="w-full rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-bold text-red-700"
          >
            🚪 تسجيل الخروج
          </button>
        </div>
      </details>

      <StudentSheet
        student={selected ? (students.find((s) => s.id === selected.id) ?? selected) : null}
        onClose={() => setSelected(null)}
      />
    </main>
  );
}
