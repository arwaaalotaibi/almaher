"use client";

import Link from "next/link";
import { studentCountLabel, useApp } from "@/lib/store";
import { Ribbon, useHydrated } from "@/components/ui";

export default function Home() {
  const { halaqas, students, teachers } = useApp();
  const hydrated = useHydrated();

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-10">
      {/* الترويسة — بأسلوب البوستر */}
      <div className="mb-2 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="جمعية الماهر بالقرآن وعلومه"
          className="mx-auto mb-4 h-20 w-auto"
        />
        <h1 className="font-kufi text-4xl font-bold tracking-tight text-plum-800">
          الماهر
        </h1>
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

      {/* الأقسام */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <Link
          href="/teachers"
          className="card flex flex-col items-center gap-1.5 rounded-2xl py-4 transition active:scale-[0.97]"
        >
          <span className="text-2xl">👩‍🏫</span>
          <span className="font-kufi text-sm font-bold text-plum-800">المعلّمات</span>
          <span className="text-[11px] text-silver-600">
            {hydrated ? teachers.length.toLocaleString("ar-EG") : "…"}
          </span>
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
          href="/settings"
          className="card flex flex-col items-center gap-1.5 rounded-2xl py-4 transition active:scale-[0.97]"
        >
          <span className="text-2xl">⚙️</span>
          <span className="font-kufi text-sm font-bold text-plum-800">الإعدادات</span>
          <span className="text-[11px] text-silver-600">حلقات ونسخ</span>
        </Link>
      </div>

      <p className="mt-10 text-center text-xs text-silver-500">
        📷 Maher.quran2
      </p>
    </main>
  );
}
