"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { studentCountLabel, TEACHER_CLAIMED_KEY, TEACHER_PICK_KEY, useApp } from "@/lib/store";
import { TeacherView } from "./teacher-view";
import { NotificationsCard } from "./notifications-card";

const PICK_KEY = TEACHER_PICK_KEY;

/** شاشة المعلّمة: تختار اسمها مرة واحدة ثم ترى حلقاتها وطالباتها */
export function TeacherHome() {
  const { teachers, students } = useApp();
  const [myId, setMyId] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false); // دخلت برمزها الخاص (لا تبديل اسم)
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setMyId(window.localStorage.getItem(PICK_KEY));
    setClaimed(window.localStorage.getItem(TEACHER_CLAIMED_KEY) === "1");
    setReady(true);
  }, []);

  const logout = async () => {
    window.localStorage.removeItem(PICK_KEY);
    window.localStorage.removeItem(TEACHER_CLAIMED_KEY);
    try {
      await supabase.rpc("almaher_unclaim_teacher");
    } catch {
      /* بلا إنترنت */
    }
    await supabase.auth.signOut();
    window.location.reload();
  };

  if (!ready) return <main className="mx-auto max-w-2xl px-4 pt-10" />;

  const me = teachers.find((t) => t.id === myId);

  if (!me) {
    return (
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-10">
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="الماهر" className="mx-auto mb-3 h-16 w-auto" />
          <h1 className="font-kufi text-2xl font-bold text-plum-800">
            أهلاً بك معلّمتنا 🌷
          </h1>
          <p className="mt-1 text-sm text-silver-600">
            اختاري اسمك — يُحفظ على جهازك لمرة واحدة
          </p>
        </div>

        {teachers.length === 0 ? (
          <div className="card rounded-2xl p-8 text-center">
            <p className="text-3xl">⏳</p>
            <p className="mt-2 font-kufi font-bold text-plum-800">
              لم تُسجَّل معلّمات بعد
            </p>
            <p className="mt-1 text-sm text-silver-600">
              اطلبي من الإدارة إضافة اسمك أولاً
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {teachers.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  window.localStorage.setItem(PICK_KEY, t.id);
                  setMyId(t.id);
                }}
                className="name-box flex items-center justify-between rounded-xl px-5 py-4 text-start transition active:scale-[0.99]"
              >
                <span className="font-kufi text-lg font-semibold text-white">
                  👩‍🏫 {t.name}
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">
                  {studentCountLabel(
                    students.filter((s) => s.teacherId === t.id).length
                  )}
                </span>
              </button>
            ))}
          </div>
        )}

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
      </main>
    );
  }

  return (
    <TeacherView
      teacherId={me.id}
      isAdmin={false}
      topExtra={<NotificationsCard halaqaIds={me.halaqaIds} />}
      bottomExtra={
        <>
          {!claimed && (
            <button
              type="button"
              onClick={() => {
                window.localStorage.removeItem(PICK_KEY);
                setMyId(null);
              }}
              className="card w-full rounded-xl py-3 font-kufi text-base font-bold text-plum-700"
            >
              🔄 تبديل الاسم
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (window.confirm("تسجيل الخروج من هذا الجهاز؟")) void logout();
            }}
            className={`card rounded-xl py-3 text-sm font-bold text-plum-700 ${claimed ? "w-full font-kufi text-base" : "w-24 shrink-0"}`}
          >
            🚪 خروج
          </button>
        </>
      }
    />
  );
}
