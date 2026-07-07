"use client";

import Link from "next/link";
import { studentCountLabel, useApp } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { Ribbon, useHydrated } from "@/components/ui";
import { useRole } from "@/components/auth-gate";
import { TeacherHome } from "@/components/teacher-home";
import { StudentHome } from "@/components/student-home";

export default function Home() {
  const role = useRole();
  const { halaqas, students } = useApp();
  const hydrated = useHydrated();

  if (role === "teacher") return <TeacherHome />;
  if (role === "student") return <StudentHome />;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-10">
      {/* الترويسة — بأسلوب البوستر */}
      <div className="mb-2 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="جمعية الماهر بالقرآن وعلومه"
          className="mx-auto mb-2 h-24 w-auto"
        />
      </div>

      <Ribbon className="my-6">حلقات التحفيظ</Ribbon>

      {/* بطاقات الحلقات */}
      <div className="grid gap-3">
        {halaqas.map((h) => {
          const count = students.filter((s) => s.halaqaId === h.id).length;
          return (
            <Link
              key={h.id}
              href={`/halaqa/${h.id}`}
              className="name-box flex items-center justify-between rounded-xl px-5 py-4 transition active:scale-[0.99]"
            >
              <span className="flex items-center gap-3">
                <span className="text-2xl">🕌</span>
                <span className="text-start">
                  <span className="block font-kufi text-lg font-semibold text-white">
                    {h.mosque}
                  </span>
                  {h.day && (
                    <span className="block text-xs font-bold text-white/75">
                      حلقات {h.day}
                    </span>
                  )}
                </span>
              </span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">
                {hydrated ? studentCountLabel(count) : "…"}
              </span>
            </Link>
          );
        })}
      </div>

      {/* أقسام إضافية (البقية في الشريط السفلي) */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link
          href="/announcements"
          className="card flex flex-col items-center gap-1.5 rounded-2xl py-4 transition active:scale-[0.97]"
        >
          <span className="text-2xl">📢</span>
          <span className="font-kufi text-sm font-bold text-plum-800">الإشعارات</span>
          <span className="text-[11px] text-silver-600">أرسلي للطالبات</span>
        </Link>
        <Link
          href="/honor"
          className="card flex flex-col items-center gap-1.5 rounded-2xl py-4 transition active:scale-[0.97]"
        >
          <span className="text-2xl">🏅</span>
          <span className="font-kufi text-sm font-bold text-plum-800">لوحة الشرف</span>
          <span className="text-[11px] text-silver-600">صمّمي إعلاناً</span>
        </Link>
        <Link
          href="/books"
          className="card flex flex-col items-center gap-1.5 rounded-2xl py-4 transition active:scale-[0.97]"
        >
          <span className="text-2xl">📚</span>
          <span className="font-kufi text-sm font-bold text-plum-800">كتب القراءة</span>
          <span className="text-[11px] text-silver-600">رفع PDF</span>
        </Link>
      </div>

      <button
        type="button"
        onClick={async () => {
          await supabase.auth.signOut();
          window.location.reload();
        }}
        className="mx-auto mt-8 block text-sm font-bold text-plum-700 underline"
      >
        🔄 تبديل الحساب / تسجيل الخروج
      </button>

      <p className="mt-6 text-center text-xs text-silver-500">
        📷 Maher.quran2
      </p>
    </main>
  );
}
