"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  buildSchedule,
  currentSessionIndex,
  formatSchedDate,
  halaqaTitle,
  hifzStartLabel,
  PLAN_FIELDS,
  segDateLabel,
  STUDENT_PICK_KEY,
  todaySegment,
  useApp,
} from "@/lib/store";

const ar = (n: number) => n.toLocaleString("ar-EG");
import Link from "next/link";
import { Ribbon } from "./ui";
import { NotificationsCard } from "./notifications-card";

/** شاشة الطالبة: تدخل برمزها فتُعرض أهدافها مباشرة (قراءة فقط) */
// تبويبات صفحة الطالبة (التجويد لاحقاً)
const STUDENT_TABS = [
  { key: "reading", icon: "📖", label: "القراءة" },
  { key: "quran", icon: "🕋", label: "القرآن" },
] as const;
type StudentTab = (typeof STUDENT_TABS)[number]["key"];

export function StudentHome() {
  const { halaqas, teachers, students, books } = useApp();
  const [myId, setMyId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<StudentTab>("reading");

  useEffect(() => {
    setMyId(window.localStorage.getItem(STUDENT_PICK_KEY));
    setReady(true);
  }, []);

  if (!ready) return <main className="mx-auto max-w-2xl px-4 pt-10" />;

  const me = students.find((s) => s.id === myId);

  const logout = async () => {
    window.localStorage.removeItem(STUDENT_PICK_KEY);
    await supabase.auth.signOut();
    window.location.reload();
  };

  // رمز لم يعد له بيانات (حُذفت الطالبة مثلاً)
  if (!me) {
    return (
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-10">
        <div className="card mx-auto max-w-sm rounded-3xl p-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="الماهر" className="mx-auto mb-3 h-16 w-auto" />
          <p className="text-3xl">🔑</p>
          <p className="mt-2 font-kufi font-bold text-plum-800">
            لم نجد بياناتك
          </p>
          <p className="mt-1 text-sm text-silver-600">
            تواصلي مع الإدارة للحصول على رمزك، ثم أدخليه من جديد
          </p>
          <button
            type="button"
            onClick={logout}
            className="mt-5 text-sm font-bold text-plum-700 underline"
          >
            الدخول برمز آخر
          </button>
        </div>
      </main>
    );
  }

  const halaqa = halaqas.find((h) => h.id === me.halaqaId);
  const teacher = teachers.find((t) => t.id === me.teacherId);
  const schedule = halaqa ? buildSchedule(halaqa, me.plan) : null;
  const curIdx = schedule ? currentSessionIndex(schedule) : 0;
  const passed = schedule ? (curIdx > 0 ? curIdx - 1 : schedule.length) : 0;
  const totalFaces =
    (me.plan?.hifz ?? 0) + (me.plan?.tathbit ?? 0) + (me.plan?.murajaah ?? 0);
  const updatedLabel = me.updatedAt
    ? new Date(me.updatedAt).toLocaleDateString("ar-u-ca-gregory-nu-arab", {
        day: "numeric",
        month: "long",
      })
    : null;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-10">
      <div className="mb-4 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="الماهر" className="mx-auto mb-3 h-16 w-auto" />
        <h1 className="font-kufi text-3xl font-bold text-plum-800">{me.name}</h1>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
          {halaqa && (
            <span className="rounded-lg bg-plum-100 px-2.5 py-0.5 text-xs font-bold text-plum-700">
              🕌 {halaqaTitle(halaqa)}
            </span>
          )}
          {teacher && (
            <span className="rounded-lg bg-plum-100 px-2.5 py-0.5 text-xs font-bold text-plum-700">
              👩‍🏫 المعلّمة {teacher.name}
            </span>
          )}
        </p>
      </div>

      <NotificationsCard halaqaIds={me.halaqaId ? [me.halaqaId] : []} />

      {/* شريط التبويبات */}
      <div className="mb-6 flex gap-1.5 rounded-2xl bg-cream p-1.5">
        {STUDENT_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 font-kufi text-base font-bold transition ${
              tab === t.key
                ? "bg-plum-600 text-white shadow"
                : "text-silver-600"
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* شاشة القراءة */}
      {tab === "reading" && (
        <section>
          {books.length === 0 ? (
            <div className="card rounded-2xl p-8 text-center">
              <p className="text-3xl">📚</p>
              <p className="mt-2 font-kufi font-bold text-plum-800">
                لا توجد كتب قراءة بعد
              </p>
              <p className="mt-1 text-sm text-silver-600">
                ستظهر هنا الكتب التي تضيفها الإدارة
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {books.map((b) => {
                const ts = todaySegment(b.readingPlan);
                return (
                  <div key={b.id} className="overflow-hidden rounded-xl">
                    <Link
                      href={`/book/${b.id}`}
                      className="name-box flex items-center gap-3 rounded-xl px-5 py-4 text-start transition active:scale-[0.99]"
                    >
                      <span className="text-2xl">📖</span>
                      <span className="font-kufi text-lg font-semibold text-white">
                        {b.title}
                      </span>
                    </Link>
                    {ts && (
                      <div
                        className={`mt-1.5 rounded-xl px-4 py-2.5 text-sm ${
                          ts.when === "today"
                            ? "bg-plum-600 text-white"
                            : "bg-plum-50 text-plum-800"
                        }`}
                      >
                        {ts.seg.isExam ? (
                          <span className="font-bold">
                            📝 {ts.when === "today" ? "اليوم اختبار!" : "اختبار"}{" "}
                            <span className="font-normal opacity-90">
                              — {segDateLabel(ts.seg.date)}
                            </span>
                          </span>
                        ) : (
                          <span className="font-bold">
                            📅 {ts.when === "today" ? "مهمة اليوم" : "التالي"}:
                            صفحات {ar(ts.seg.fromPage)}–{ar(ts.seg.toPage)}{" "}
                            <span className="font-normal opacity-80">
                              ({segDateLabel(ts.seg.date)})
                            </span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* شاشة القرآن */}
      {tab === "quran" && (
        <section>
          {hifzStartLabel(me.plan) && (
            <div className="mb-3 flex items-center justify-between rounded-2xl bg-plum-600 px-4 py-3">
              <span className="font-kufi text-sm font-bold text-white">
                📖 بداية الحفظ
              </span>
              <span className="font-kufi text-base font-bold text-white">
                {hifzStartLabel(me.plan)}
              </span>
            </div>
          )}

          {/* خطة الفصل — جدول مولّد تلقائياً */}
          {schedule ? (
            <>
              <Ribbon className="mb-4 mt-8">خطة الفصل</Ribbon>

              {/* التقدّم في الفصل */}
              <div className="card mb-3 rounded-2xl p-4">
                <div className="mb-1 flex items-center justify-between text-sm font-bold">
                  <span className="text-plum-800">📅 لقاءات الفصل</span>
                  <span className="text-plum-700">
                    {ar(passed)} / {ar(schedule.length)}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-cream-dark">
                  <div
                    className="h-full rounded-full bg-plum-600"
                    style={{ width: `${(passed / schedule.length) * 100}%` }}
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  {[
                    { l: "حفظ", v: me.plan.hifz, i: "📖" },
                    { l: "مراجعة", v: me.plan.murajaah, i: "🔁" },
                  ].map((x) => (
                    <div key={x.l} className="rounded-xl bg-plum-50 py-2">
                      <p className="text-lg font-bold text-plum-800">
                        {ar(x.v ?? 0)}
                      </p>
                      <p className="text-[11px] font-bold text-silver-600">
                        {x.i} {x.l} (وجه)
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* مطلوب اللقاء القادم */}
              {curIdx > 0 ? (
                (() => {
                  const s = schedule[curIdx - 1];
                  return (
                    <div className="mb-3 rounded-2xl border-2 border-plum-500 bg-plum-50 p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-kufi text-base font-bold text-plum-800">
                          📌 مطلوب اللقاء القادم
                        </span>
                        <span className="rounded-full bg-plum-600 px-2.5 py-0.5 text-xs font-bold text-white">
                          لقاء {ar(s.n)} · {formatSchedDate(s.date)}
                        </span>
                      </div>
                      <div className="mt-3 rounded-xl bg-white p-3 text-center shadow-sm">
                        <p className="text-[11px] font-bold text-silver-600">
                          📖 الحفظ الجديد
                        </p>
                        <p className="mt-0.5 font-kufi text-lg font-bold text-plum-800">
                          {s.hifzLabel || (s.hifz ? `${ar(s.hifz)} أوجه` : "—")}
                        </p>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-center text-xs">
                        <div className="rounded-xl bg-white py-2">
                          <p className="font-bold text-plum-700">
                            📌 {s.tathbitLabel || (s.tathbit ? `${ar(s.tathbit)} أوجه` : "—")}
                          </p>
                          <p className="text-[10px] text-silver-600">تثبيت</p>
                        </div>
                        <div className="rounded-xl bg-white py-2">
                          <p className="font-bold text-plum-700">
                            🔁{" "}
                            {s.murajaahLabel ||
                              (s.murajaah ? `${ar(s.murajaah)} أوجه` : "—")}
                          </p>
                          <p className="text-[10px] text-silver-600">مراجعة</p>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="mb-3 rounded-2xl bg-plum-50 p-4 text-center font-kufi text-sm font-bold text-plum-700">
                  🎉 اكتمل الفصل — أحسنتِ!
                </div>
              )}

              {/* جدول اللقاءات كاملاً */}
              <div className="grid gap-1.5">
                {schedule.map((s) => {
                  const isCur = s.n === curIdx;
                  return (
                    <div
                      key={s.n}
                      className={`rounded-xl px-3 py-2.5 ${
                        isCur
                          ? "bg-plum-600 text-white"
                          : "card"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span
                          className={`font-bold ${isCur ? "text-white" : "text-plum-700"}`}
                        >
                          لقاء {ar(s.n)}
                        </span>
                        <span className={isCur ? "text-white/85" : "text-silver-600"}>
                          {formatSchedDate(s.date)}
                        </span>
                      </div>
                      <p
                        className={`mt-0.5 font-kufi text-sm font-bold ${
                          isCur ? "text-white" : "text-plum-800"
                        }`}
                      >
                        📖 {s.hifzLabel || (s.hifz ? `${ar(s.hifz)} أوجه` : "—")}
                      </p>
                      <p
                        className={`text-[11px] ${
                          isCur ? "text-white/85" : "text-silver-600"
                        }`}
                      >
                        {s.tathbitLabel && `📌 ${s.tathbitLabel} · `}
                        🔁 مراجعة{" "}
                        {s.murajaahLabel ||
                          (s.murajaah ? `${ar(s.murajaah)} أوجه` : "—")}
                      </p>
                    </div>
                  );
                })}
              </div>
            </>
          ) : totalFaces > 0 ? (
            <>
              <Ribbon className="mb-4 mt-8">خطة الفصل</Ribbon>
              <div className="card rounded-2xl p-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  {PLAN_FIELDS.map((f) => (
                    <div key={f.key} className="rounded-xl bg-plum-50 py-2">
                      <p className="text-lg font-bold text-plum-800">
                        {ar(me.plan[f.key] ?? 0)}
                      </p>
                      <p className="text-[11px] font-bold text-silver-600">
                        {f.icon} {f.label.replace("أوجه ", "")}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-center text-xs text-silver-600">
                  لم تُحدَّد مواعيد الفصل بعد — سيظهر الجدول فور تحديدها
                </p>
              </div>
            </>
          ) : null}

          {updatedLabel && (
            <p className="mt-6 text-center text-xs text-silver-600">
              آخر تحديث: {updatedLabel}
            </p>
          )}
        </section>
      )}

      <button
        type="button"
        onClick={logout}
        className="mx-auto mt-10 block text-sm font-bold text-silver-600 underline"
      >
        🚪 تسجيل الخروج
      </button>
    </main>
  );
}
