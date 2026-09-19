"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  actions,
  genTeacherCode,
  halaqaTitle,
  studentCountLabel,
  teacherCodeLink,
  teacherCodeMessage,
  useApp,
  whatsappLink,
} from "@/lib/store";
import {
  Field,
  inputCls,
  PageHeader,
  PrimaryBtn,
  Sheet,
  useHydrated,
} from "@/components/ui";

import { RoleOnly } from "@/components/admin-only";

export default function TeachersPage() {
  return (
    <RoleOnly roles={["admin"]}>
      <TeachersInner />
    </RoleOnly>
  );
}

function TeachersInner() {
  const { teachers, halaqas, students } = useApp();
  const hydrated = useHydrated();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [selectedHalaqas, setSelectedHalaqas] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  // معلّمة بلا رمز (أُضيفت قبل نظام الحسابات) — يُولَّد لها رمز تلقائياً
  useEffect(() => {
    if (!hydrated) return;
    for (const t of teachers) if (!t.code) actions.setTeacherCode(t.id, genTeacherCode(teachers));
  }, [hydrated, teachers]);

  const copy = async (t: { id: string; name: string; code?: string }) => {
    if (!t.code) return;
    try {
      await navigator.clipboard.writeText(teacherCodeMessage(t.name, t.code));
      setCopied(t.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt("انسخي الرسالة:", teacherCodeMessage(t.name, t.code));
    }
  };

  if (!hydrated) return <main className="mx-auto max-w-2xl px-4 pt-10" />;

  const toggle = (id: string) =>
    setSelectedHalaqas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const add = () => {
    if (!name.trim()) return;
    actions.addTeacher(name, selectedHalaqas);
    setName("");
    setSelectedHalaqas([]);
    setAdding(false);
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pb-40 pt-8">
      <PageHeader title="المعلّمات" back="/" />

      {teachers.length === 0 ? (
        <div className="card rounded-2xl p-8 text-center">
          <p className="text-3xl">👩‍🏫</p>
          <p className="mt-2 font-kufi font-bold text-plum-800">
            أضيفي المعلّمات وحلقاتهنّ
          </p>
          <p className="mt-1 text-sm text-silver-600">
            كل معلّمة لها رمز ورابط دخول خاص، تسجّل به تسميع طالبات حلقاتها
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {teachers.map((t) => {
            const count = students.filter((s) => s.teacherId === t.id).length;
            const herHalaqas = halaqas.filter((h) => t.halaqaIds.includes(h.id));
            return (
              <div key={t.id} className="card rounded-2xl p-4">
                <Link href={`/teacher/${t.id}`} className="block transition active:scale-[0.99]">
                  <div className="flex items-center justify-between">
                    <span className="font-kufi text-lg font-bold text-plum-800">
                      👩‍🏫 المعلّمة {t.name}
                    </span>
                    <span className="rounded-full bg-plum-100 px-3 py-1 text-xs font-bold text-plum-700">
                      {studentCountLabel(count)}
                    </span>
                  </div>
                  {herHalaqas.length > 0 && (
                    <p className="mt-2 flex flex-wrap gap-1.5">
                      {herHalaqas.map((h) => (
                        <span
                          key={h.id}
                          className="rounded-lg bg-cream px-2 py-0.5 text-[11px] font-bold text-silver-600"
                        >
                          🕌 {halaqaTitle(h)}
                        </span>
                      ))}
                    </p>
                  )}
                </Link>

                {/* 🔑 حساب المعلّمة: رمزها ورابط دخولها */}
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-cream/60 px-3 py-2">
                  <span className="text-[11px] font-bold text-silver-600">🔑 رمز الدخول</span>
                  <span className="font-mono text-base font-bold tracking-[0.2em] text-plum-800">{t.code || "…"}</span>
                  <span className="flex-1" />
                  <button
                    type="button"
                    onClick={() => copy(t)}
                    className="rounded-lg bg-plum-600 px-2.5 py-1.5 text-[11px] font-bold text-white"
                    title="نسخ رسالة الدخول مع الرابط"
                  >
                    {copied === t.id ? "تم النسخ ✓" : "📋 نسخ الرسالة"}
                  </button>
                  <a
                    href={whatsappLink("", t.code ? teacherCodeMessage(t.name, t.code) : "")}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg bg-emerald-500 px-2.5 py-1.5 text-[11px] font-bold text-white"
                    title="إرسال عبر واتساب"
                  >
                    📲
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`رمز جديد للمعلّمة «${t.name}»؟ الرمز الحالي سيتوقف.`))
                        actions.setTeacherCode(t.id, genTeacherCode(teachers));
                    }}
                    className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-bold text-plum-700 ring-1 ring-cream-dark"
                    title="توليد رمز جديد"
                  >
                    🔄
                  </button>
                  {t.code && (
                    <p className="w-full truncate text-[10px] text-silver-500" dir="ltr">
                      {teacherCodeLink(t.code)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-20 z-40 border-y border-cream-dark bg-white/90 p-3 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <PrimaryBtn onClick={() => setAdding(true)}>+ إضافة معلّمة</PrimaryBtn>
        </div>
      </div>

      <Sheet open={adding} onClose={() => setAdding(false)} title="إضافة معلّمة">
        <Field label="اسم المعلّمة" icon="👩‍🏫">
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="حلقاتها" icon="🕌">
          <div className="grid gap-2">
            {halaqas.map((h) => (
              <label
                key={h.id}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold ${
                  selectedHalaqas.includes(h.id)
                    ? "border-plum-500 bg-plum-50 text-plum-800"
                    : "border-cream-dark bg-cream/40 text-silver-600"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedHalaqas.includes(h.id)}
                  onChange={() => toggle(h.id)}
                  className="h-4 w-4 accent-plum-600"
                />
                {halaqaTitle(h)}
              </label>
            ))}
          </div>
        </Field>
        <PrimaryBtn onClick={add}>إضافة</PrimaryBtn>
      </Sheet>
    </main>
  );
}
