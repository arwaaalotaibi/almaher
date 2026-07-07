"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  goalItems,
  halaqaTitle,
  PLAN_FIELDS,
  sessionKindMeta,
  STUDENT_PICK_KEY,
  useApp,
} from "@/lib/store";
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
            <div className="grid gap-2.5">
              {books.map((b) => (
                <Link
                  key={b.id}
                  href={`/book/${b.id}`}
                  className="name-box flex items-center gap-3 rounded-xl px-5 py-4 text-start transition active:scale-[0.99]"
                >
                  <span className="text-2xl">📖</span>
                  <span className="font-kufi text-lg font-semibold text-white">
                    {b.title}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* شاشة القرآن */}
      {tab === "quran" && (
        <section>
          <Ribbon className="mb-6">أهدافي هذا الأسبوع</Ribbon>

          <div className="grid gap-3">
            {goalItems("hifz").map(({ key, label, icon }) => {
              const text = me.goals[key]?.trim();
              const isDone = me.done[key];
              return (
                <div key={key} className="card rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-kufi text-base font-bold text-plum-800">
                      {icon} {label}
                    </span>
                    {isDone && (
                      <span className="rounded-full bg-plum-600 px-3 py-0.5 text-xs font-bold text-white">
                        تمّ ✅
                      </span>
                    )}
                  </div>
                  <p
                    className={`mt-2 text-lg ${
                      text ? "font-semibold text-ink" : "text-sm text-silver-500"
                    }`}
                  >
                    {text || "لم يُحدَّد بعد — تابعي مع معلّمتك"}
                  </p>
                </div>
              );
            })}
          </div>

          {/* خطة الكورس */}
          {me.plan?.meetings ||
          me.plan?.hifz ||
          me.plan?.tathbit ||
          me.plan?.murajaah ? (
            <>
              <Ribbon className="mb-4 mt-8">خطة الكورس</Ribbon>
              <div className="card rounded-2xl p-4">
                {me.plan.meetings > 0 && (
                  <div className="mb-3">
                    <div className="mb-1 flex items-center justify-between text-sm font-bold">
                      <span className="text-plum-800">📅 اللقاءات المنجزة</span>
                      <span className="text-plum-700">
                        {(me.sessions?.length ?? 0).toLocaleString("ar-EG")} /{" "}
                        {me.plan.meetings.toLocaleString("ar-EG")}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-cream-dark">
                      <div
                        className="h-full rounded-full bg-plum-600"
                        style={{
                          width: `${Math.min(
                            100,
                            ((me.sessions?.length ?? 0) / me.plan.meetings) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 text-center">
                  {PLAN_FIELDS.filter((f) => f.key !== "meetings").map((f) => (
                    <div key={f.key} className="rounded-xl bg-plum-50 py-2">
                      <p className="text-lg font-bold text-plum-800">
                        {(me.plan[f.key] ?? 0).toLocaleString("ar-EG")}
                      </p>
                      <p className="text-[11px] font-bold text-silver-600">
                        {f.icon} {f.label.replace("صفحات ", "")}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {/* سجل الإنجاز */}
          {me.sessions && me.sessions.length > 0 && (
            <>
              <Ribbon className="mb-4 mt-8">سجل إنجازي</Ribbon>
              <div className="grid gap-2">
                {me.sessions.map((s) => {
                  const km = sessionKindMeta(s.kind);
                  return (
                    <div
                      key={s.id}
                      className="card flex items-center justify-between rounded-xl px-4 py-3"
                    >
                      <span className="font-kufi text-base font-bold text-plum-800">
                        {km.icon} {s.surah}
                        {s.fromAyah && (
                          <span dir="ltr" className="font-normal text-silver-600">
                            {" "}
                            {s.fromAyah}
                            {s.toAyah ? `-${s.toAyah}` : ""}
                          </span>
                        )}
                      </span>
                      <span className="rounded-full bg-plum-100 px-2.5 py-0.5 text-[11px] font-bold text-plum-700">
                        {km.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

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
