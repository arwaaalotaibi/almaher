"use client";

import { confirmDanger } from "@/lib/confirm";
import { ALLOWED_ABSENCES, termAbsenceDates } from "@/lib/absence";
import { printCodeCards } from "@/lib/print-codes";
import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  actions,
  buildSchedule,
  codeMessage,
  codesListMessage,
  currentSessionIndex,
  dateKey,
  EMPTY_PLAN,
  normalizeDigits,
  studentCountLabel,
  useApp,
  planConfirmMark,
  WEEK_DAYS,
  whatsappLink,
  type CoursePlan,
  type Student,
  isWithdrawn,
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
import { QuickSession } from "@/components/quick-session";

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
  const { halaqas, teachers, students, recitations, support } = useApp();
  const hydrated = useHydrated();

  const halaqa = halaqas.find((h) => h.id === id);
  // طالبات الحلقة النشطات (المنسحبات في قسم منفصل أسفل الصفحة)
  const halaqaStudents = useMemo(
    () => students.filter((s) => s.halaqaId === id && !isWithdrawn(s)),
    [students, id]
  );
  const withdrawnStudents = useMemo(
    () => students.filter((s) => s.halaqaId === id && isWithdrawn(s)),
    [students, id]
  );
  const halaqaTeachers = teachers.filter((t) => t.halaqaIds.includes(id));

  const [selected, setSelected] = useState<Student | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTeacher, setNewTeacher] = useState("");
  const [showCodes, setShowCodes] = useState(false);
  const [planOpen, setPlanOpen] = useState(false); // 📅 خطة الفصل مطوية افتراضياً
  const [copied, setCopied] = useState<string | null>(null); // آخر ما نُسخ من الرموز
  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    } catch {
      window.prompt("انسخي النص:", text);
    }
  };
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
      !confirmDanger(
        `أرشفة الفصل الحالي وبدء فصل جديد (${newTermCount.toLocaleString("ar-EG")} لقاء) — ستنطلق كل طالبة من آخر ما وصلت له`,
        "فصل جديد"
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

      {/* إعدادات الفصل — تُضبط مرة وتُطبَّق على جدول كل طالبة (مطوية افتراضياً) */}
      <div className="card mb-4 rounded-2xl p-4">
        <button
          type="button"
          onClick={() => setPlanOpen((o) => !o)}
          className="flex w-full items-center justify-between"
        >
          <span className="font-kufi text-sm font-bold text-plum-800">📅 خطة الفصل</span>
          <span className="text-plum-600">{planOpen ? "▴" : "▾"}</span>
        </button>
        {!planOpen && (
          <p className="mt-1 text-[11px] text-silver-600">
            {[
              halaqa.day ? `يوم ${halaqa.day}` : "اليوم غير محدد",
              halaqa.termStart
                ? `تبدأ ${new Date(halaqa.termStart + "T00:00:00").toLocaleDateString("ar-u-ca-gregory-nu-arab", { day: "numeric", month: "long" })}`
                : "بداية الفصل غير محددة",
              halaqa.termSessions ? `${halaqa.termSessions.toLocaleString("ar-EG")} لقاءً` : "عدد اللقاءات غير محدد",
            ].join(" · ")}
          </p>
        )}
        <div className={planOpen ? "mt-3 grid grid-cols-3 gap-2" : "hidden"}>
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

        {/* المحطتان الذهبيتان بعد اللقاءات — تظهران على درب حفظ كل طالبة مع عدّ تنازلي */}
        <div className={planOpen ? "mt-3 grid grid-cols-2 gap-2" : "hidden"}>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-plum-700">
              🎙️ يوم السرد القرآني
            </span>
            <input
              type="date"
              className={inputCls}
              value={halaqa.sardDate ?? ""}
              onChange={(e) =>
                actions.updateHalaqa(id, { sardDate: e.target.value })
              }
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-plum-700">
              🏁 يوم الاختبار
            </span>
            <input
              type="date"
              className={inputCls}
              value={halaqa.examDate ?? ""}
              onChange={(e) =>
                actions.updateHalaqa(id, { examDate: e.target.value })
              }
            />
          </label>
        </div>
        {planOpen && (
          <p className="mt-2 text-[11px] text-silver-600">
            أوجه الحفظ/التثبيت/المراجعة لكل طالبة تُدخل من بيانات الطالبة، ويولّد
            النظام جدولها تلقائياً.
          </p>
        )}
      </div>

      {/* 📋 التسجيل السريع للقاء كامل */}
      <QuickSession halaqa={halaqa} groups={groups} onOpenStudent={setSelected} />

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

      {halaqaStudents.length > 0 && halaqa.termStart && (() => {
        let ok = 0, issue = 0, pending = 0;
        for (const s of halaqaStudents) {
          const m = planConfirmMark(s, halaqa, support);
          if (m === "✅") ok++;
          else if (m === "⚠️") issue++;
          else pending++;
        }
        return (
          <Link
            href="/plans"
            className="mb-3 block rounded-xl bg-plum-50 px-3 py-2 text-center text-xs font-bold text-plum-700"
          >
            📋 تأكيد خطط الفصل: ✅ {ok.toLocaleString("ar-EG")} · ⚠️ {issue.toLocaleString("ar-EG")} · ⏳ {pending.toLocaleString("ar-EG")} — التفاصيل ‹
          </Link>
        );
      })()}

      {halaqaStudents.length > 0 && (() => {
        const counts = halaqaStudents.map((s) => termAbsenceDates(recitations, s.id, halaqa.termStart).length);
        const once = counts.filter((n) => n === 1).length;
        const twice = counts.filter((n) => n === 2).length;
        const limit = counts.filter((n) => n >= ALLOWED_ABSENCES).length;
        if (once + twice + limit === 0) return null;
        return (
          <Link
            href="/absences"
            className="mb-3 block rounded-xl bg-amber-50 px-3 py-2 text-center text-xs font-bold text-amber-900"
          >
            🚫 الغياب هذا الفصل: مرة {once.toLocaleString("ar-EG")} · مرتين {twice.toLocaleString("ar-EG")} · ٣ فأكثر {limit.toLocaleString("ar-EG")} — التفاصيل ‹
          </Link>
        );
      })()}

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
            {g.list.map((s) => {
              const mark = planConfirmMark(s, halaqa, support);
              return (
                <NameBox key={s.id} onClick={() => setSelected(s)}>
                  <span className="block">
                    {mark && (
                      <span
                        className="me-1.5 text-sm"
                        title={
                          mark === "✅"
                            ? "أكّدت خطتها"
                            : mark === "⚠️"
                              ? "أبلغت عن خطأ في الخطة — راجعي الدعم وعدّليها من هنا"
                              : "لم تؤكّد خطتها بعد"
                        }
                      >
                        {mark}
                      </span>
                    )}
                    {s.name}
                  </span>
                  <GoalDots student={s} />
                </NameBox>
              );
            })}
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
                confirmDanger(
                  `حذف حلقة «${halaqa.mosque}${halaqa.day ? " — " + halaqa.day : ""}» وكل طالباتها`
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
          رسالة كل طالبة فيها رمزها ورابط يُدخلها مباشرة بضغطة واحدة.
          📲 يفتح واتساب برسالة جاهزة، و📋 ينسخها.
        </p>

        {/* الحلقة كاملة دفعة واحدة — للمعلّمة أو لمجموعة الحلقة */}
        <div className="mb-3 grid grid-cols-2 gap-2">
          <a
            href={whatsappLink(
              "",
              codesListMessage(
                `${halaqa.mosque}${halaqa.day ? " — " + halaqa.day : ""}`,
                halaqaStudents.map((s) => ({ name: s.name, code: s.code ?? "" }))
              )
            )}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-emerald-500 py-2.5 text-center text-xs font-bold text-white"
          >
            📲 كل الرموز للمعلّمة
          </a>
          <button
            type="button"
            onClick={() =>
              copyText(
                codesListMessage(
                  `${halaqa.mosque}${halaqa.day ? " — " + halaqa.day : ""}`,
                  halaqaStudents.map((s) => ({ name: s.name, code: s.code ?? "" }))
                ),
                "all"
              )
            }
            className="rounded-xl bg-plum-600 py-2.5 text-xs font-bold text-white"
          >
            {copied === "all" ? "✓ نُسخت" : "📋 نسخ كل الرموز"}
          </button>
          <button
            type="button"
            onClick={() =>
              printCodeCards(
                `${halaqa.mosque}${halaqa.day ? " — " + halaqa.day : ""}`,
                halaqaStudents.map((s) => ({ name: s.name, code: s.code ?? "" }))
              )
            }
            className="col-span-2 rounded-xl border-2 border-plum-300 bg-white py-2.5 text-xs font-bold text-plum-700"
          >
            🖨️ طباعة بطاقات الرموز للتوزيع اليدوي
          </button>
        </div>

        <div className="grid gap-2">
          {halaqaStudents.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-cream px-3 py-2.5"
            >
              <span className="min-w-0 truncate text-sm font-bold text-plum-800">
                {s.name}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span
                  className="font-kufi text-base font-bold tracking-[0.15em] text-plum-700"
                  dir="ltr"
                >
                  {s.code || "—"}
                </span>
                {s.code && (
                  <>
                    <button
                      type="button"
                      onClick={() => copyText(codeMessage(s.name, s.code!), s.id)}
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        copied === s.id
                          ? "bg-plum-600 text-white"
                          : "bg-white text-plum-700 ring-1 ring-cream-dark"
                      }`}
                      aria-label={`نسخ رسالة رمز ${s.name}`}
                    >
                      {copied === s.id ? "✓" : "📋"}
                    </button>
                    <a
                      href={whatsappLink(s.phone, codeMessage(s.name, s.code))}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-bold text-white"
                      aria-label={`إرسال رمز ${s.name} عبر واتساب`}
                    >
                      📲
                    </a>
                  </>
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

      {/* النسخة الحيّة من الطالبة (بعد الحفظ) لا اللقطة وقت الضغط */}
      {withdrawnStudents.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 font-kufi text-sm font-bold text-silver-600">
            🚪 المنسحبات ({withdrawnStudents.length.toLocaleString("ar-EG")})
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {withdrawnStudents.map((s) => (
              <NameBox key={s.id} onClick={() => setSelected(s)} className="opacity-60 grayscale">
                {s.name}
                <span className="block text-[10px] font-normal text-white/80">
                  منسحبة{s.plan.withdrawReason ? ` · ${s.plan.withdrawReason}` : ""}
                </span>
              </NameBox>
            ))}
          </div>
        </section>
      )}

      <StudentSheet
        student={selected ? (students.find((s) => s.id === selected.id) ?? selected) : null}
        onClose={() => setSelected(null)}
      />
    </main>
  );
}
