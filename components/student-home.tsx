"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { GOAL_META, halaqaTitle, useApp } from "@/lib/store";
import { NameBox, Ribbon } from "./ui";
import { NotificationsCard } from "./notifications-card";

const PICK_KEY = "almaher-my-student-id";

/** شاشة الطالبة: تختار حلقتها واسمها مرة واحدة ثم ترى أهدافها (قراءة فقط) */
export function StudentHome() {
  const { halaqas, teachers, students } = useApp();
  const [myId, setMyId] = useState<string | null>(null);
  const [halaqaPick, setHalaqaPick] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setMyId(window.localStorage.getItem(PICK_KEY));
    setReady(true);
  }, []);

  if (!ready) return <main className="mx-auto max-w-2xl px-4 pt-10" />;

  const me = students.find((s) => s.id === myId);

  const logoutBtn = (
    <button
      type="button"
      onClick={async () => {
        await supabase.auth.signOut();
        window.location.reload();
      }}
      className="mx-auto mt-8 block text-sm font-bold text-silver-600 underline"
    >
      🚪 تسجيل الخروج
    </button>
  );

  /* اختيار الحلقة ثم الاسم */
  if (!me) {
    const pool = halaqaPick
      ? students.filter((s) => s.halaqaId === halaqaPick)
      : [];
    return (
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-10">
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="الماهر" className="mx-auto mb-3 h-16 w-auto" />
          <h1 className="font-kufi text-2xl font-bold text-plum-800">
            أهلاً بك طالبتنا 🌸
          </h1>
          <p className="mt-1 text-sm text-silver-600">
            {halaqaPick ? "اختاري اسمك" : "اختاري حلقتك أولاً"}
          </p>
        </div>

        {!halaqaPick ? (
          <div className="grid gap-3">
            {halaqas.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => setHalaqaPick(h.id)}
                className="name-box rounded-xl px-5 py-4 text-start font-kufi text-lg font-semibold text-white transition active:scale-[0.99]"
              >
                🕌 {halaqaTitle(h)}
              </button>
            ))}
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setHalaqaPick(null)}
              className="mb-4 text-sm font-bold text-plum-700 underline"
            >
              → تغيير الحلقة
            </button>
            {pool.length === 0 ? (
              <div className="card rounded-2xl p-8 text-center">
                <p className="text-3xl">⏳</p>
                <p className="mt-2 font-kufi font-bold text-plum-800">
                  لا توجد أسماء في هذه الحلقة بعد
                </p>
                <p className="mt-1 text-sm text-silver-600">
                  اطلبي من معلّمتك إضافة اسمك أولاً
                </p>
              </div>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {pool.map((s) => (
                  <NameBox
                    key={s.id}
                    onClick={() => {
                      window.localStorage.setItem(PICK_KEY, s.id);
                      setMyId(s.id);
                    }}
                  >
                    {s.name}
                  </NameBox>
                ))}
              </div>
            )}
          </>
        )}
        {logoutBtn}
      </main>
    );
  }

  /* بطاقة الأهداف */
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
        onClick={() => {
          window.localStorage.removeItem(PICK_KEY);
          setMyId(null);
          setHalaqaPick(null);
        }}
        className="mx-auto mt-8 block text-sm font-bold text-plum-700 underline"
      >
        🔄 لستُ {me.name}؟ تغيير الاسم
      </button>
      {logoutBtn}
    </main>
  );
}
