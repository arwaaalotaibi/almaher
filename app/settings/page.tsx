"use client";

import { useRef, useState } from "react";
import { actions, halaqaTitle, useApp, WEEK_DAYS } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import {
  DangerBtn,
  Field,
  inputCls,
  PageHeader,
  PrimaryBtn,
  Sheet,
  useHydrated,
} from "@/components/ui";

import { RoleOnly } from "@/components/admin-only";

export default function SettingsPage() {
  return (
    <RoleOnly roles={["admin"]}>
      <SettingsInner />
    </RoleOnly>
  );
}

function SettingsInner() {
  const { halaqas, students, teachers } = useApp();
  const hydrated = useHydrated();
  const fileRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [mosque, setMosque] = useState("");
  const [day, setDay] = useState("");

  if (!hydrated) return <main className="mx-auto max-w-2xl px-4 pt-10" />;

  const exportBackup = () => {
    const blob = new Blob([actions.exportJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `الماهر-نسخة-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importBackup = async (file: File) => {
    const text = await file.text();
    if (actions.importJSON(text)) {
      window.alert("تم استيراد النسخة بنجاح ✅");
    } else {
      window.alert("الملف غير صالح ❌");
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-8">
      <PageHeader title="الإعدادات" back="/" />

      {/* الحلقات */}
      <section className="card mb-4 rounded-2xl p-4">
        <h2 className="mb-3 font-kufi text-lg font-bold text-plum-800">
          🕌 الحلقات
        </h2>
        <div className="grid gap-2">
          {halaqas.map((h) => (
            <div
              key={h.id}
              className="flex items-center justify-between rounded-xl bg-cream px-3 py-2.5"
            >
              <span className="text-sm font-bold text-plum-800">
                {halaqaTitle(h)}
              </span>
              <span className="text-xs text-silver-600">
                {students
                  .filter((s) => s.halaqaId === h.id)
                  .length.toLocaleString("ar-EG")}{" "}
                طالبة
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <PrimaryBtn onClick={() => setAdding(true)}>+ إضافة حلقة / مسجد</PrimaryBtn>
        </div>
        <p className="mt-2 text-center text-xs text-silver-600">
          تعديل أو حذف الحلقة من داخل صفحتها
        </p>
      </section>

      {/* الحساب */}
      <section className="card mb-4 rounded-2xl p-4">
        <h2 className="mb-1 font-kufi text-lg font-bold text-plum-800">
          ☁️ قاعدة البيانات
        </h2>
        <p className="mb-3 text-sm text-silver-600">
          البيانات مشتركة ومتزامنة لحظياً بين كل أجهزة المعلّمات.
        </p>
        <button
          type="button"
          onClick={async () => {
            if (window.confirm("تسجيل الخروج من هذا الجهاز؟")) {
              await supabase.auth.signOut();
              window.location.reload();
            }
          }}
          className="card w-full rounded-xl py-2.5 text-sm font-bold text-plum-700"
        >
          🚪 تسجيل الخروج
        </button>
      </section>

      {/* النسخ الاحتياطي */}
      <section className="card mb-4 rounded-2xl p-4">
        <h2 className="mb-1 font-kufi text-lg font-bold text-plum-800">
          💾 النسخ الاحتياطي
        </h2>
        <p className="mb-3 text-sm text-silver-600">
          نسخة إضافية للاحتياط: التصدير يحفظ ملفاً، والاستيراد يستبدل بيانات
          الجميع بمحتوى الملف.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <PrimaryBtn onClick={exportBackup}>⬇️ تصدير نسخة</PrimaryBtn>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="card w-full rounded-xl py-3 font-kufi text-base font-bold text-plum-700"
          >
            ⬆️ استيراد نسخة
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importBackup(f);
            e.target.value = "";
          }}
        />
      </section>

      {/* إحصائية سريعة */}
      <section className="card mb-4 rounded-2xl p-4 text-center">
        <p className="text-sm text-silver-600">
          {halaqas.length.toLocaleString("ar-EG")} حلقات ·{" "}
          {teachers.length.toLocaleString("ar-EG")} معلّمات ·{" "}
          {students.length.toLocaleString("ar-EG")} طالبات
        </p>
      </section>

      <DangerBtn
        onClick={() => {
          if (window.confirm("مسح كل البيانات من قاعدة البيانات لكل الأجهزة والبدء من جديد؟ لا يمكن التراجع!")) {
            actions.resetAll();
          }
        }}
      >
        🗑️ مسح كل البيانات
      </DangerBtn>

      <Sheet open={adding} onClose={() => setAdding(false)} title="إضافة حلقة">
        <Field label="اسم المسجد" icon="🕌">
          <input
            className={inputCls}
            value={mosque}
            onChange={(e) => setMosque(e.target.value)}
            placeholder="مسجد …"
            autoFocus
          />
        </Field>
        <Field label="يوم الحلقة" icon="🗓️">
          <select
            className={inputCls}
            value={day}
            onChange={(e) => setDay(e.target.value)}
          >
            {WEEK_DAYS.map((d) => (
              <option key={d} value={d}>
                {d || "غير محدد"}
              </option>
            ))}
          </select>
        </Field>
        <PrimaryBtn
          onClick={() => {
            if (!mosque.trim()) return;
            actions.addHalaqa(mosque, day);
            setMosque("");
            setDay("");
            setAdding(false);
          }}
        >
          إضافة
        </PrimaryBtn>
      </Sheet>
    </main>
  );
}
