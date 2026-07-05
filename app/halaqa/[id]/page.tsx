"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  actions,
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
  Ribbon,
  Sheet,
  useHydrated,
} from "@/components/ui";
import { GoalDots, StudentSheet } from "@/components/student-sheet";

import { RoleOnly } from "@/components/admin-only";

export default function HalaqaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <RoleOnly roles={["admin"]}>
      <HalaqaInner params={params} />
    </RoleOnly>
  );
}

function HalaqaInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { halaqas, teachers, students } = useApp();
  const hydrated = useHydrated();

  const halaqa = halaqas.find((h) => h.id === id);
  const halaqaStudents = useMemo(
    () => students.filter((s) => s.halaqaId === id),
    [students, id]
  );
  const halaqaTeachers = teachers.filter((t) => t.halaqaIds.includes(id));

  const [selected, setSelected] = useState<Student | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTeacher, setNewTeacher] = useState("");

  if (!hydrated) {
    return <main className="mx-auto max-w-2xl px-4 pt-10" />;
  }
  if (!halaqa) {
    return (
      <main className="mx-auto max-w-2xl px-4 pt-10">
        <PageHeader title="الحلقة غير موجودة" back="/" />
      </main>
    );
  }

  // مجموعات: كل معلّمة وطالباتها، ثم «بدون معلّمة»
  const groups = [
    ...halaqaTeachers.map((t) => ({
      key: t.id,
      title: `المعلّمة ${t.name}`,
      list: halaqaStudents.filter((s) => s.teacherId === t.id),
    })),
    {
      key: "none",
      title: "بدون معلّمة",
      list: halaqaStudents.filter(
        (s) => !s.teacherId || !teachers.some((t) => t.id === s.teacherId)
      ),
    },
  ].filter((g) => g.key !== "none" || g.list.length > 0);

  const addStudent = () => {
    if (!newName.trim()) return;
    actions.addStudent(newName, id, newTeacher);
    setNewName("");
    setAdding(false);
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-8">
      <PageHeader title={halaqa.mosque} back="/" />
      <Ribbon className="mb-1">حلقات {halaqa.mosque}</Ribbon>
      {halaqa.day && (
        <p className="mb-4 mt-2 text-center">
          <span className="rounded-lg bg-plum-800 px-4 py-1 font-kufi text-sm font-semibold text-white">
            حلقات {halaqa.day}
          </span>
        </p>
      )}

      <p className="mb-5 mt-3 text-center text-sm font-bold text-silver-600">
        {studentCountLabel(halaqaStudents.length)}
      </p>

      {halaqaStudents.length === 0 && (
        <div className="card rounded-2xl p-8 text-center">
          <p className="text-3xl">🌱</p>
          <p className="mt-2 font-kufi font-bold text-plum-800">
            ابدئي بإضافة طالبات الحلقة
          </p>
          <p className="mt-1 text-sm text-silver-600">
            اضغطي زر «إضافة طالبة» بالأسفل
          </p>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.key} className="mb-6">
          {(groups.length > 1 || g.key !== "none") && g.list.length > 0 && (
            <h2 className="mb-2 font-kufi text-base font-bold text-plum-700">
              👩‍🏫 {g.title}
            </h2>
          )}
          <div className="grid gap-2.5 sm:grid-cols-2">
            {g.list.map((s) => (
              <NameBox key={s.id} onClick={() => setSelected(s)}>
                <span className="block">{s.name}</span>
                <GoalDots student={s} />
              </NameBox>
            ))}
          </div>
        </section>
      ))}

      {/* أزرار سفلية ثابتة */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-cream-dark bg-white/90 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl gap-2">
          <PrimaryBtn onClick={() => setAdding(true)}>+ إضافة طالبة</PrimaryBtn>
          <button
            type="button"
            onClick={() => {
              const mosque = window.prompt("اسم المسجد:", halaqa.mosque);
              if (mosque === null) return;
              const day = window.prompt(
                "يوم الحلقة (اتركيه فارغاً إن لم يتحدد):",
                halaqa.day
              );
              if (day === null) return;
              actions.updateHalaqa(id, {
                mosque: mosque.trim() || halaqa.mosque,
                day: day.trim(),
              });
            }}
            className="card w-24 shrink-0 rounded-xl text-sm font-bold text-plum-700"
          >
            ✏️ تعديل
          </button>
        </div>
      </div>

      {/* إضافة طالبة */}
      <Sheet open={adding} onClose={() => setAdding(false)} title="إضافة طالبة">
        <Field label="اسم الطالبة" icon="🌸">
          <input
            className={inputCls}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="الاسم الثلاثي كما في الإعلان"
            autoFocus
          />
        </Field>
        <Field label="المعلّمة" icon="👩‍🏫">
          <select
            className={inputCls}
            value={newTeacher}
            onChange={(e) => setNewTeacher(e.target.value)}
          >
            <option value="">بدون معلّمة</option>
            {halaqaTeachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <PrimaryBtn onClick={addStudent}>إضافة</PrimaryBtn>
        <div className="mt-4">
          <DangerBtn
            onClick={() => {
              if (
                window.confirm(
                  `حذف «${halaqa.mosque}${halaqa.day ? " — " + halaqa.day : ""}» وكل طالباتها؟`
                )
              ) {
                actions.removeHalaqa(id);
                router.push("/");
              }
            }}
          >
            حذف هذه الحلقة نهائياً
          </DangerBtn>
        </div>
      </Sheet>

      <StudentSheet student={selected} onClose={() => setSelected(null)} />
    </main>
  );
}
