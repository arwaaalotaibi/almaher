"use client";

import Link from "next/link";
import { useState } from "react";
import { actions, halaqaTitle, studentCountLabel, useApp } from "@/lib/store";
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
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-8">
      <PageHeader title="المعلّمات" back="/" />

      {teachers.length === 0 ? (
        <div className="card rounded-2xl p-8 text-center">
          <p className="text-3xl">👩‍🏫</p>
          <p className="mt-2 font-kufi font-bold text-plum-800">
            أضيفي المعلّمات وحلقاتهنّ
          </p>
          <p className="mt-1 text-sm text-silver-600">
            كل معلّمة يظهر لها حلقاتها وطالباتها فقط
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {teachers.map((t) => {
            const count = students.filter((s) => s.teacherId === t.id).length;
            const herHalaqas = halaqas.filter((h) => t.halaqaIds.includes(h.id));
            return (
              <Link
                key={t.id}
                href={`/teacher/${t.id}`}
                className="card rounded-2xl p-4 transition active:scale-[0.99]"
              >
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
            );
          })}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-cream-dark bg-white/90 p-3 backdrop-blur">
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
