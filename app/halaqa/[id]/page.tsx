"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  actions,
  buildSchedule,
  codeMessage,
  currentSessionIndex,
  dateKey,
  EMPTY_PLAN,
  normalizeDigits,
  studentCountLabel,
  useApp,
  WEEK_DAYS,
  whatsappLink,
  type CoursePlan,
  type Student,
} from "@/lib/store";
import { computeProgress } from "@/lib/progress";
import { surahName } from "@/lib/mushaf";
import { meetingsLabel } from "@/lib/arabic";
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
  const { halaqas, teachers, students, recitations } = useApp();
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
  const [showCodes, setShowCodes] = useState(false);
  const [newTermOpen, setNewTermOpen] = useState(false);
  const [newTermStart, setNewTermStart] = useState("");
  const [newTermCount, setNewTermCount] = useState(0);

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

  // هل انتهت كل لقاءات الفصل الحالي؟
  const termRows = buildSchedule(halaqa, EMPTY_PLAN);
  const termEnded =
    !!termRows && termRows.length > 0 && currentSessionIndex(termRows) === 0;

  // موضع استئناف كل طالبة (من آخر ما وصلت فعلاً)
  const resumeFor = (s: Student) => {
    const p = computeProgress(s, recitations, halaqa);
    return {
      prog: p,
      hifz:
        p.hasData && p.nextHifzFrom
          ? { surah: surahName(p.nextHifzFrom.surah), ayah: p.nextHifzFrom.ayah }
          : null,
      mur:
        p.currentMurLabel && p.nextMurFrom
          ? { surah: surahName(p.nextMurFrom.surah), ayah: p.nextMurFrom.ayah }
          : null,
    };
  };

  const openNewTerm = () => {
    // مقترح تلقائي: بعد آخر لقاء بأسبوع، وبنفس عدد اللقاءات
    if (termRows && termRows.length) {
      const d = new Date(termRows[termRows.length - 1].date);
      d.setDate(d.getDate() + 7);
      setNewTermStart(dateKey(d));
    }
    setNewTermCount(halaqa.termSessions || 0);
    setNewTermOpen(true);
  };

  const startNewTerm = () => {
    if (!newTermStart || newTermCount < 1) return;
    if (
      !window.confirm(
        `أرشفة الفصل الحالي وبدء فصل جديد (${newTermCount.toLocaleString("ar-EG")} لقاء)؟\nستنطلق كل طالبة من آخر ما وصلت له.`
      )
    )
      return;
    // ١) حفظ الفصل المنتهي كاملاً: جدوله + خطة كل طالبة (تبقى الشارات والتاريخ)
    actions.archiveTerm({
      halaqaId: id,
      day: halaqa.day,
      termStart: halaqa.termStart,
      termSessions: halaqa.termSessions,
      students: halaqaStudents.map((s) => ({
        id: s.id,
        name: s.name,
        plan: s.plan,
      })),
    });
    // ٢) الفصل الجديد بتاريخه وعدد لقاءاته
    actions.updateHalaqa(id, {
      termStart: newTermStart,
      termSessions: newTermCount,
    });
    // ٣) كل طالبة عائدة تستأنف حفظها ومراجعتها من آخر ما وصلت
    for (const s of halaqaStudents) {
      const r = resumeFor(s);
      const patch: Partial<CoursePlan> = {};
      if (r.hifz) {
        patch.startSurah = r.hifz.surah;
        patch.startAyah = r.hifz.ayah;
      }
      if (r.mur) {
        patch.murStartSurah = r.mur.surah;
        patch.murStartAyah = r.mur.ayah;
      }
      if (Object.keys(patch).length)
        actions.updateStudent(s.id, { plan: { ...s.plan, ...patch } });
    }
    setNewTermOpen(false);
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

      <p className="mb-3 mt-3 text-center text-sm font-bold text-silver-600">
        {studentCountLabel(halaqaStudents.length)}
      </p>

      {/* إعدادات الفصل — تُضبط مرة وتُطبَّق على جدول كل طالبة */}
      <div className="card mb-4 rounded-2xl p-4">
        <p className="mb-3 font-kufi text-sm font-bold text-plum-800">
          📅 خطة الفصل
        </p>
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-plum-700">
              يوم الحلقة
            </span>
            <select
              className={inputCls}
              value={halaqa.day}
              onChange={(e) => actions.updateHalaqa(id, { day: e.target.value })}
            >
              {WEEK_DAYS.map((d) => (
                <option key={d} value={d}>
                  {d || "غير محدد"}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-plum-700">
              بداية الفصل
            </span>
            <input
              type="date"
              className={inputCls}
              value={halaqa.termStart}
              onChange={(e) =>
                actions.updateHalaqa(id, { termStart: e.target.value })
              }
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-plum-700">
              عدد اللقاءات
            </span>
            <input
              type="text"
              inputMode="numeric"
              className={inputCls}
              placeholder="٠"
              value={halaqa.termSessions || ""}
              onChange={(e) =>
                actions.updateHalaqa(id, {
                  termSessions: Math.max(
                    0,
                    Number(normalizeDigits(e.target.value)) || 0
                  ),
                })
              }
            />
          </label>
        </div>
        <p className="mt-2 text-[11px] text-silver-600">
          أوجه الحفظ/التثبيت/المراجعة لكل طالبة تُدخل من بيانات الطالبة، ويولّد
          النظام جدولها تلقائياً.
        </p>
      </div>

      {/* انتهى الفصل — بدء فصل جديد */}
      {termEnded && (
        <div
          className="mb-4 rounded-2xl p-5 text-center text-white shadow"
          style={{ background: "linear-gradient(135deg,#5d3f4e,#a8894f)" }}
        >
          <p className="text-3xl">🎓</p>
          <p className="mt-1 font-kufi text-lg font-bold">
            انتهى الفصل — بارك الله في طالباتك!
          </p>
          <p className="mt-1 text-sm text-white/90">
            اكتملت لقاءات الفصل ({meetingsLabel(halaqa.termSessions)}). ابدئي
            فصلاً جديداً وستنطلق كل طالبة من آخر ما وصلت له تلقائياً.
          </p>
          <button
            type="button"
            onClick={openNewTerm}
            className="mt-3 rounded-xl bg-white px-6 py-2.5 font-kufi text-sm font-bold text-plum-800 transition active:scale-[0.98]"
          >
            🚀 بدء فصل جديد
          </button>
        </div>
      )}

      {halaqaStudents.length > 0 && (
        <button
          type="button"
          onClick={() => setShowCodes(true)}
          className="mx-auto mb-5 block rounded-full bg-plum-100 px-4 py-1.5 text-xs font-bold text-plum-700"
        >
          🔑 عرض أرقام الدخول
        </button>
      )}

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
            placeholder="الاسم الثلاثي"
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

      {/* أرقام الدخول للتوزيع */}
      <Sheet
        open={showCodes}
        onClose={() => setShowCodes(false)}
        title="🔑 أرقام دخول الطالبات"
      >
        <p className="mb-3 text-sm text-silver-600">
          كل طالبة تدخل التطبيق باختيار «الطالبات» ثم كتابة رمزها.
        </p>
        <div className="grid gap-2">
          {halaqaStudents.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-cream px-4 py-2.5"
            >
              <span className="min-w-0 truncate text-sm font-bold text-plum-800">
                {s.name}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span
                  className="font-kufi text-lg font-bold tracking-[0.15em] text-plum-700"
                  dir="ltr"
                >
                  {s.code || "—"}
                </span>
                {s.code && (
                  <a
                    href={whatsappLink(s.phone, codeMessage(s.name, s.code))}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-bold text-white"
                    aria-label={`إرسال رمز ${s.name} عبر واتساب`}
                  >
                    📲
                  </a>
                )}
              </span>
            </div>
          ))}
        </div>
      </Sheet>

      {/* بدء فصل جديد */}
      <Sheet
        open={newTermOpen}
        onClose={() => setNewTermOpen(false)}
        title="🚀 بدء فصل جديد"
      >
        <p className="mb-3 rounded-xl bg-plum-50 px-3 py-2.5 text-xs font-bold text-plum-700">
          يُحفظ الفصل الحالي كاملاً (جدوله وبيانات الطالبات وشاراتهن)، ثم يبدأ
          الفصل الجديد وكل طالبة تستأنف من آخر ما وصلت له.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="أول لقاء في الفصل الجديد" icon="📅">
            <input
              type="date"
              className={inputCls}
              value={newTermStart}
              onChange={(e) => setNewTermStart(e.target.value)}
            />
          </Field>
          <Field label="عدد اللقاءات" icon="🔢">
            <input
              type="text"
              inputMode="numeric"
              className={inputCls}
              placeholder="٠"
              value={newTermCount || ""}
              onChange={(e) =>
                setNewTermCount(
                  Math.max(0, Number(normalizeDigits(e.target.value)) || 0)
                )
              }
            />
          </Field>
        </div>

        {halaqaStudents.length > 0 && (
          <div className="mb-3 rounded-2xl border border-cream-dark p-3">
            <p className="mb-2 text-xs font-bold text-plum-700">
              🧭 من أين ستنطلق كل طالبة؟
            </p>
            <div className="grid gap-1.5">
              {halaqaStudents.map((s) => {
                const r = resumeFor(s);
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-xl bg-cream px-3 py-2"
                  >
                    <span className="text-sm font-bold text-plum-800">
                      {s.name}
                    </span>
                    <span className="text-[11px] font-bold text-silver-600">
                      {r.hifz
                        ? `📖 ${r.hifz.surah} ${r.hifz.ayah.toLocaleString("ar-EG")}`
                        : "تُحدَّد من بياناتها"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <PrimaryBtn onClick={startNewTerm}>
          🚀 انطلقي بالفصل الجديد
        </PrimaryBtn>
      </Sheet>

      <StudentSheet student={selected} onClose={() => setSelected(null)} />
    </main>
  );
}
