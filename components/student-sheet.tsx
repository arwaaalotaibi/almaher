"use client";

import { useEffect, useState } from "react";
import {
  actions,
  buildSchedule,
  CoursePlan,
  EMPTY_PLAN,
  formatSchedDate,
  halaqaTitle,
  hifzStartLabel,
  normalizeDigits,
  PLAN_FIELDS,
  useApp,
  type Student,
} from "@/lib/store";

const ar = (n: number) => n.toLocaleString("ar-EG");
import { ayahCount, SURAHS } from "@/lib/surahs";
import { printHifzSchedule } from "@/lib/print-schedule";
import { DangerBtn, Field, inputCls, PrimaryBtn, Sheet } from "./ui";
import { ReciteLogger } from "./recite-log";
import { ProgressSummary } from "./motivation-panel";

/** نافذة بيانات الطالبة: الاسم + المعلّمة + بداية الحفظ + خطة الفصل */
export function StudentSheet({
  student,
  onClose,
}: {
  student: Student | null;
  onClose: () => void;
}) {
  const { teachers, halaqas } = useApp();
  const [name, setName] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [halaqaId, setHalaqaId] = useState("");
  const [note, setNote] = useState("");
  const [plan, setPlan] = useState<CoursePlan>({ ...EMPTY_PLAN });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (student) {
      setName(student.name);
      setTeacherId(student.teacherId);
      setHalaqaId(student.halaqaId);
      setPlan({ ...EMPTY_PLAN, ...student.plan });
      setNote(student.note ?? "");
    }
  }, [student]);

  const planNum = (v: string) => Math.max(0, Number(normalizeDigits(v)) || 0);

  if (!student) return null;

  const save = () => {
    if (!name.trim()) return;
    actions.updateStudent(student.id, {
      name: name.trim(),
      teacherId,
      halaqaId,
      plan,
      note: note.trim(),
    });
    onClose();
  };

  const remove = () => {
    if (window.confirm(`حذف الطالبة «${student.name}»؟`)) {
      actions.removeStudent(student.id);
      onClose();
    }
  };

  const updatedLabel = student.updatedAt
    ? new Date(student.updatedAt).toLocaleDateString("ar-u-ca-gregory-nu-arab", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const halaqa = halaqas.find((h) => h.id === halaqaId);
  const schedule = halaqa ? buildSchedule(halaqa, plan) : null;

  const printSchedule = () => {
    if (!schedule || !halaqa) return;
    printHifzSchedule({
      studentName: name,
      halaqaLabel: halaqaTitle(halaqa),
      startLabel: hifzStartLabel(plan),
      schedule,
    });
  };

  return (
    <Sheet open onClose={onClose} title="بيانات الطالبة">
      <Field label="اسم الطالبة" icon="🌸">
        <input
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>

      {student.code && (
        <div className="mb-3 flex items-center justify-between rounded-2xl bg-plum-50 px-4 py-3">
          <div>
            <p className="text-xs font-bold text-plum-700">🔑 رمز دخول الطالبة</p>
            <p
              className="font-kufi text-2xl font-bold tracking-[0.2em] text-plum-800"
              dir="ltr"
            >
              {student.code}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(student.code).then(
                () => setCopied(true),
                () => setCopied(false)
              );
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="rounded-xl bg-plum-600 px-4 py-2 text-sm font-bold text-white"
          >
            {copied ? "تم النسخ ✓" : "نسخ"}
          </button>
        </div>
      )}

      <div className="mb-1 grid grid-cols-2 gap-3">
        <Field label="المعلّمة" icon="👩‍🏫">
          <select
            className={inputCls}
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
          >
            <option value="">بدون معلّمة</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="الحلقة" icon="🕌">
          <select
            className={inputCls}
            value={halaqaId}
            onChange={(e) => setHalaqaId(e.target.value)}
          >
            {halaqas.map((h) => (
              <option key={h.id} value={h.id}>
                {h.mosque} {h.day && `— ${h.day}`}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* بداية الحفظ */}
      <div className="mb-1 grid grid-cols-2 gap-3">
        <Field label="بداية الحفظ — السورة" icon="📖">
          <select
            className={inputCls}
            value={plan.startSurah ?? ""}
            onChange={(e) =>
              setPlan({ ...plan, startSurah: e.target.value, startAyah: 1 })
            }
          >
            <option value="">اختاري السورة…</option>
            {SURAHS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="رقم الآية" icon="🔢">
          <select
            className={inputCls}
            value={plan.startAyah ?? 1}
            onChange={(e) =>
              setPlan({ ...plan, startAyah: Number(e.target.value) })
            }
            disabled={!plan.startSurah}
          >
            {Array.from(
              { length: Math.max(1, ayahCount(plan.startSurah ?? "")) },
              (_, i) => i + 1
            ).map((n) => (
              <option key={n} value={n}>
                {n.toLocaleString("ar-EG")}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* بداية المراجعة */}
      <div className="mb-1 grid grid-cols-2 gap-3">
        <Field label="بداية المراجعة — السورة" icon="🔁">
          <select
            className={inputCls}
            value={plan.murStartSurah ?? ""}
            onChange={(e) =>
              setPlan({ ...plan, murStartSurah: e.target.value, murStartAyah: 1 })
            }
          >
            <option value="">اختاري السورة…</option>
            {SURAHS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="رقم الآية" icon="🔢">
          <select
            className={inputCls}
            value={plan.murStartAyah ?? 1}
            onChange={(e) =>
              setPlan({ ...plan, murStartAyah: Number(e.target.value) })
            }
            disabled={!plan.murStartSurah}
          >
            {Array.from(
              { length: Math.max(1, ayahCount(plan.murStartSurah ?? "")) },
              (_, i) => i + 1
            ).map((n) => (
              <option key={n} value={n}>
                {n.toLocaleString("ar-EG")}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* خطة الفصل بالأوجه */}
      <div className="mb-3 rounded-2xl border border-cream-dark p-3">
        <p className="mb-1 font-kufi text-sm font-bold text-plum-800">
          📋 أوجه كل لقاء
        </p>
        <p className="mb-2 text-[11px] text-silver-600">
          كمية كل لقاء — يحسب النظام مقطعها عبر المصحف، والتثبيت تلقائياً (= حفظ
          اللقاء السابق)
        </p>
        <div className="grid grid-cols-2 gap-2">
          {PLAN_FIELDS.map(({ key, label, icon }) => (
            <label key={key} className="block">
              <span className="mb-1 block text-xs font-bold text-plum-700">
                {icon} {label.replace("أوجه ", "")}
              </span>
              <input
                className={`${inputCls} text-center`}
                inputMode="numeric"
                placeholder="٠"
                value={plan[key] || ""}
                onChange={(e) =>
                  setPlan({ ...plan, [key]: planNum(e.target.value) })
                }
              />
            </label>
          ))}
        </div>
      </div>

      {/* جدول الحفظ المولّد */}
      {schedule ? (
        <div className="mb-3 rounded-2xl border border-cream-dark p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-kufi text-sm font-bold text-plum-800">
              📅 جدول الحفظ ({ar(schedule.length)} لقاء)
            </p>
            <button
              type="button"
              onClick={printSchedule}
              className="rounded-full bg-plum-600 px-3 py-1 text-xs font-bold text-white"
            >
              🖨️ طباعة
            </button>
          </div>
          <div className="grid gap-1.5">
            {schedule.map((s) => (
              <div key={s.n} className="rounded-xl bg-cream px-3 py-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-plum-700">لقاء {ar(s.n)}</span>
                  <span className="text-silver-600">
                    {formatSchedDate(s.date)}
                  </span>
                </div>
                <p className="mt-0.5 font-kufi text-sm font-bold text-plum-800">
                  📖 {s.hifzLabel || (s.hifz ? `${ar(s.hifz)} أوجه` : "—")}
                </p>
                <p className="text-[11px] text-silver-600">
                  🔁 مراجعة:{" "}
                  {s.murajaahLabel ||
                    (s.murajaah ? `${ar(s.murajaah)} أوجه` : "—")}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (plan.hifz || plan.murajaah) && halaqa ? (
        <p className="mb-3 rounded-xl bg-cream px-3 py-2.5 text-center text-xs font-bold text-silver-600">
          حدّدي «تاريخ البداية وعدد اللقاءات» من صفحة الحلقة ليظهر الجدول
        </p>
      ) : null}

      {/* ملخّص تقدّم الطالبة */}
      <div className="mb-3 rounded-2xl border border-cream-dark p-3">
        <p className="mb-2 font-kufi text-sm font-bold text-plum-800">
          🧭 تقدّم الطالبة
        </p>
        <ProgressSummary student={student} halaqa={halaqa} />
      </div>

      {/* سجلّ تسميع الطالبة — الإدارة/المعلّمة تقدر تُدخل أيضاً */}
      <ReciteLogger student={student} />

      <Field label="ملاحظات" icon="📝">
        <textarea
          className={`${inputCls} min-h-16`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

      {/* حالة إقرار اللائحة */}
      <div
        className={`mb-3 rounded-xl px-4 py-2.5 text-center text-xs font-bold ${
          student.agreedAt
            ? "bg-plum-50 text-plum-700"
            : "bg-cream text-silver-600"
        }`}
      >
        {student.agreedAt
          ? `✅ أقرّت باللائحة — ${new Date(student.agreedAt).toLocaleDateString(
              "ar-u-ca-gregory-nu-arab",
              { day: "numeric", month: "long", year: "numeric" }
            )}`
          : "⏳ لم تُقرّ باللائحة بعد"}
      </div>

      {updatedLabel && (
        <p className="mb-3 text-center text-xs text-silver-600">
          آخر تحديث: {updatedLabel}
        </p>
      )}

      <PrimaryBtn onClick={save}>حفظ البيانات</PrimaryBtn>
      <div className="mt-2">
        <DangerBtn onClick={remove}>حذف الطالبة</DangerBtn>
      </div>
    </Sheet>
  );
}

/** سطر صغير تحت اسم الطالبة: بداية الحفظ إن وُجدت */
export function GoalDots({ student }: { student: Student }) {
  const start = hifzStartLabel(student.plan);
  if (!start) return null;
  return (
    <span className="text-[11px] font-normal text-white/80">📖 {start}</span>
  );
}
