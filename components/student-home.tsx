"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  GOAL_META,
  halaqaTitle,
  STUDENT_PICK_KEY,
  useApp,
} from "@/lib/store";
import { Ribbon } from "./ui";
import { NotificationsCard } from "./notifications-card";

/** شاشة الطالبة: تدخل برمزها فتُعرض أهدافها مباشرة (قراءة فقط) */
export function StudentHome() {
  const { halaqas, teachers, students } = useApp();
  const [myId, setMyId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

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

      <Ribbon className="mb-6">أهدافي هذا الأسبوع</Ribbon>

      <div className="grid gap-3">
        {GOAL_META.map(({ key, label, icon }) => {
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

      {updatedLabel && (
        <p className="mt-4 text-center text-xs text-silver-600">
          آخر تحديث: {updatedLabel}
        </p>
      )}

      <button
        type="button"
        onClick={logout}
        className="mx-auto mt-8 block text-sm font-bold text-silver-600 underline"
      >
        🚪 تسجيل الخروج
      </button>
    </main>
  );
}
