"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  actions,
  halaqaTitle,
  studentCountLabel,
  useApp,
  type Student,
} from "@/lib/store";
import {
  DangerBtn,
  Field,
  inputCls,
  NameBox,
  PageHeader,
  PrimaryBtn,
  Sheet,
} from "@/components/ui";
import { GoalDots, StudentSheet } from "@/components/student-sheet";

/** عرض حلقات وطالبات معلّمة — يستخدم في صفحة الإدارة وفي شاشة المعلّمة */
export function TeacherView({
  teacherId,
  isAdmin,
  back,
  bottomExtra,
}: {
  teacherId: string;
  isAdmin: boolean;
  back?: string;
  bottomExtra?: ReactNode;
}) {
  const router = useRouter();
  const { teachers, halaqas, students } = useApp();

  const [selected, setSelected] = useState<Student | null>(null);
  const [adding, setAdding] = useState<string | null>(null); // halaqaId
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editHalaqas, setEditHalaqas] = useState<string[]>([]);

  const teacher = teachers.find((t) => t.id === teacherId);
  if (!teacher) {
    return (
      <main className="mx-auto max-w-2xl px-4 pt-10">
        <PageHeader title="المعلّمة غير موجودة" back={back} />
      </main>
    );
  }

  const herHalaqas = halaqas.filter((h) => teacher.halaqaIds.includes(h.id));
  const herStudents = students.filter((s) => s.teacherId === teacherId);

  const openEdit = () => {
    setEditName(teacher.name);
    setEditHalaqas([...teacher.halaqaIds]);
    setEditing(true);
  };

  const saveEdit = () => {
    if (!editName.trim()) return;
    actions.updateTeacher(teacherId, {
      name: editName.trim(),
      halaqaIds: editHalaqas,
    });
    setEditing(false);
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-8">
      <PageHeader title={`المعلّمة ${teacher.name}`} back={back} />
      <p className="mb-6 text-center text-sm font-bold text-silver-600">
        {studentCountLabel(herStudents.length)} في{" "}
        {herHalaqas.length.toLocaleString("ar-EG")} حلقة
      </p>

      {herHalaqas.length === 0 && (
        <div className="card rounded-2xl p-8 text-center">
          <p className="text-3xl">🕌</p>
          <p className="mt-2 font-kufi font-bold text-plum-800">
            لا توجد حلقات لهذه المعلّمة
          </p>
          <p className="mt-1 text-sm text-silver-600">
            {isAdmin
              ? "اضغطي «تعديل» بالأسفل واختاري حلقاتها"
              : "تواصلي مع الإدارة لإسناد حلقاتك"}
          </p>
        </div>
      )}

      {herHalaqas.map((h) => {
        const list = herStudents.filter((s) => s.halaqaId === h.id);
        return (
          <section key={h.id} className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-kufi text-base font-bold text-plum-700">
                🕌 {halaqaTitle(h)}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setAdding(h.id);
                  setNewName("");
                }}
                className="rounded-full bg-plum-100 px-3 py-1 text-xs font-bold text-plum-700"
              >
                + طالبة
              </button>
            </div>
            {list.length === 0 ? (
              <p className="rounded-xl bg-cream-dark/40 px-4 py-3 text-center text-sm text-silver-600">
                لا طالبات بعد في هذه الحلقة
              </p>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {list.map((s) => (
                  <NameBox key={s.id} onClick={() => setSelected(s)}>
                    <span className="block">{s.name}</span>
                    <GoalDots student={s} />
                  </NameBox>
                ))}
              </div>
            )}
          </section>
        );
      })}

      {(isAdmin || bottomExtra) && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-cream-dark bg-white/90 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl gap-2">
            {isAdmin ? (
              <PrimaryBtn onClick={openEdit}>✏️ تعديل بيانات المعلّمة</PrimaryBtn>
            ) : (
              bottomExtra
            )}
          </div>
        </div>
      )}

      {/* إضافة طالبة لحلقة معيّنة */}
      <Sheet
        open={adding !== null}
        onClose={() => setAdding(null)}
        title="إضافة طالبة"
      >
        <Field label="اسم الطالبة" icon="🌸">
          <input
            className={inputCls}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
        </Field>
        <PrimaryBtn
          onClick={() => {
            if (!newName.trim() || !adding) return;
            actions.addStudent(newName, adding, teacherId);
            setAdding(null);
          }}
        >
          إضافة
        </PrimaryBtn>
      </Sheet>

      {/* تعديل المعلّمة — للإدارة فقط */}
      {isAdmin && (
        <Sheet open={editing} onClose={() => setEditing(false)} title="تعديل المعلّمة">
          <Field label="الاسم" icon="👩‍🏫">
            <input
              className={inputCls}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </Field>
          <Field label="حلقاتها" icon="🕌">
            <div className="grid gap-2">
              {halaqas.map((h) => (
                <label
                  key={h.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold ${
                    editHalaqas.includes(h.id)
                      ? "border-plum-500 bg-plum-50 text-plum-800"
                      : "border-cream-dark bg-cream/40 text-silver-600"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={editHalaqas.includes(h.id)}
                    onChange={() =>
                      setEditHalaqas((prev) =>
                        prev.includes(h.id)
                          ? prev.filter((x) => x !== h.id)
                          : [...prev, h.id]
                      )
                    }
                    className="h-4 w-4 accent-plum-600"
                  />
                  {halaqaTitle(h)}
                </label>
              ))}
            </div>
          </Field>
          <PrimaryBtn onClick={saveEdit}>حفظ</PrimaryBtn>
          <div className="mt-4">
            <DangerBtn
              onClick={() => {
                if (
                  window.confirm(
                    `حذف المعلّمة «${teacher.name}»؟ (طالباتها ستبقى بدون معلّمة)`
                  )
                ) {
                  actions.removeTeacher(teacherId);
                  router.push("/teachers");
                }
              }}
            >
              حذف المعلّمة
            </DangerBtn>
          </div>
        </Sheet>
      )}

      <StudentSheet student={selected} onClose={() => setSelected(null)} />
    </main>
  );
}
