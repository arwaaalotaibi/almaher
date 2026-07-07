"use client";

import { useEffect, useState } from "react";
import {
  actions,
  CoursePlan,
  EMPTY_PLAN,
  goalItems,
  normalizeDigits,
  PLAN_FIELDS,
  uid,
  useApp,
  type Goals,
  type GoalsDone,
  type SessionLog,
  type Student,
} from "@/lib/store";
import { SURAHS } from "@/lib/surahs";
import { DangerBtn, Field, inputCls, PrimaryBtn, Sheet } from "./ui";

/** عدّاد سريع بأزرار +/− للأوجه */
function Stepper({
  icon,
  label,
  value,
  onChange,
  hint,
}: {
  icon: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  hint?: string;
}) {
  return (
    <div className="rounded-xl bg-white p-2 text-center shadow-sm">
      <p className="text-xs font-bold text-plum-700">
        {icon} {label}
      </p>
      {hint && <p className="text-[9px] text-silver-500">{hint}</p>}
      <div className="mt-1 flex items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-cream text-lg font-bold text-plum-700 active:scale-95"
          aria-label="نقص"
        >
          −
        </button>
        <span className="w-6 font-kufi text-xl font-bold text-plum-800">
          {value.toLocaleString("ar-EG")}
        </span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-plum-600 text-lg font-bold text-white active:scale-95"
          aria-label="زيادة"
        >
          +
        </button>
      </div>
    </div>
  );
}

/** نافذة بيانات الطالبة: الاسم + المعلّمة + الأهداف الثلاثة */
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
  const [goals, setGoals] = useState<Goals>({ hifz: "", tathbit: "", murajaah: "" });
  const [done, setDone] = useState<GoalsDone>({ hifz: false, tathbit: false, murajaah: false });
  const [note, setNote] = useState("");
  const [plan, setPlan] = useState<CoursePlan>({ ...EMPTY_PLAN });
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [copied, setCopied] = useState(false);

  // مسودّة الحصّة (أوجه) — التثبيت يُعبّأ تلقائياً بحفظ الحصة السابقة
  const [sHifz, setSHifz] = useState(0);
  const [sTathbit, setSTathbit] = useState(0);
  const [sMuraj, setSMuraj] = useState(0);
  const [sSurah, setSSurah] = useState("");
  const [sFrom, setSFrom] = useState("");
  const [sTo, setSTo] = useState("");

  useEffect(() => {
    if (student) {
      setName(student.name);
      setTeacherId(student.teacherId);
      setHalaqaId(student.halaqaId);
      setPlan({ ...EMPTY_PLAN, ...student.plan });
      setSessions(student.sessions ?? []);
      setGoals({ ...student.goals });
      setDone({ ...student.done });
      setNote(student.note ?? "");
      setSHifz(0);
      // تثبيت هذه الحصة = حفظ الحصة الفائتة تلقائياً
      setSTathbit(student.sessions?.[0]?.hifz ?? 0);
      setSMuraj(0);
      setSSurah("");
      setSFrom("");
      setSTo("");
    }
  }, [student]);

  const addSession = () => {
    if (!sHifz && !sTathbit && !sMuraj && !sSurah.trim()) return;
    setSessions([
      {
        id: uid(),
        date: new Date().toISOString(),
        hifz: sHifz,
        tathbit: sTathbit,
        murajaah: sMuraj,
        surah: sSurah.trim(),
        fromAyah: normalizeDigits(sFrom),
        toAyah: normalizeDigits(sTo),
      },
      ...sessions,
    ]);
    // الحصة القادمة: تثبيتها = حفظ هذه الحصة
    setSTathbit(sHifz);
    setSHifz(0);
    setSMuraj(0);
    setSSurah("");
    setSFrom("");
    setSTo("");
  };

  const planNum = (v: string) => Math.max(0, Number(normalizeDigits(v)) || 0);

  if (!student) return null;

  const save = () => {
    if (!name.trim()) return;
    actions.updateStudent(student.id, {
      name: name.trim(),
      teacherId,
      halaqaId,
      plan,
      sessions,
      goals,
      done,
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

      <div className="mb-3 rounded-2xl bg-plum-50 p-3">
        <p className="mb-2 font-kufi text-sm font-bold text-plum-800">
          أهداف هذا الأسبوع
        </p>
        {goalItems("hifz").map(({ key, label, icon }) => (
          <div key={key} className="mb-2 last:mb-0">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-bold text-plum-700">
                {icon} {label}
              </span>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs font-bold text-plum-600">
                <input
                  type="checkbox"
                  checked={done[key] ?? false}
                  onChange={(e) => setDone({ ...done, [key]: e.target.checked })}
                  className="h-4 w-4 accent-plum-600"
                />
                تمّ ✅
              </label>
            </div>
            <input
              className={inputCls}
              placeholder="مثال: سورة الملك ١ – ١٥"
              value={goals[key] ?? ""}
              onChange={(e) => setGoals({ ...goals, [key]: e.target.value })}
            />
          </div>
        ))}
      </div>

      {/* خطة الفصل بالأوجه */}
      <div className="mb-3 rounded-2xl border border-cream-dark p-3">
        <p className="mb-1 font-kufi text-sm font-bold text-plum-800">
          📋 خطة الفصل (بالأوجه)
        </p>
        <p className="mb-2 text-[11px] text-silver-600">
          إجمالي أوجه الفصل — يوزّعها النظام على اللقاءات تلقائياً
        </p>
        <div className="grid grid-cols-3 gap-2">
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

      {/* تسجيل سريع للحصص بالأوجه */}
      <div className="mb-3 rounded-2xl border border-cream-dark p-3">
        <p className="mb-0.5 font-kufi text-sm font-bold text-plum-800">
          ⚡ تسجيل الحصة (بالأوجه)
        </p>
        <p className="mb-2 text-[11px] text-silver-600">
          التثبيت يُعبّأ تلقائياً بحفظ الحصة السابقة ✨
        </p>

        <div className="mb-2 rounded-xl bg-plum-50 p-2.5">
          <div className="grid grid-cols-3 gap-2">
            <Stepper icon="📖" label="حفظ" value={sHifz} onChange={setSHifz} />
            <Stepper
              icon="📌"
              label="تثبيت"
              value={sTathbit}
              onChange={setSTathbit}
              hint="الحصة الفائتة"
            />
            <Stepper icon="🔁" label="مراجعة" value={sMuraj} onChange={setSMuraj} />
          </div>

          <details className="mt-2">
            <summary className="cursor-pointer text-[11px] font-bold text-plum-700">
              + تفاصيل السورة (اختياري)
            </summary>
            <input
              className={`${inputCls} mb-2 mt-2`}
              list="surah-list"
              placeholder="السورة"
              value={sSurah}
              onChange={(e) => setSSurah(e.target.value)}
            />
            <datalist id="surah-list">
              {SURAHS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <div className="grid grid-cols-2 gap-2">
              <input
                className={inputCls}
                inputMode="numeric"
                placeholder="من آية"
                value={sFrom}
                onChange={(e) => setSFrom(e.target.value)}
              />
              <input
                className={inputCls}
                inputMode="numeric"
                placeholder="إلى آية"
                value={sTo}
                onChange={(e) => setSTo(e.target.value)}
              />
            </div>
          </details>

          <button
            type="button"
            onClick={addSession}
            className="mt-2 w-full rounded-xl bg-plum-600 py-2.5 text-sm font-bold text-white"
          >
            ➕ تسجيل الحصة
          </button>
        </div>

        {/* سجل الحصص */}
        {sessions.length > 0 && (
          <p className="mb-1 text-xs font-bold text-plum-700">
            سجل الحصص ({sessions.length.toLocaleString("ar-EG")})
          </p>
        )}
        {sessions.map((s) => (
          <div
            key={s.id}
            className="mb-1.5 flex items-center justify-between rounded-lg bg-cream px-3 py-2 text-sm"
          >
            <span className="flex flex-wrap items-center gap-2 font-bold text-plum-800">
              {(s.hifz ?? 0) > 0 && <span>📖 {s.hifz}</span>}
              {(s.tathbit ?? 0) > 0 && <span>📌 {s.tathbit}</span>}
              {(s.murajaah ?? 0) > 0 && <span>🔁 {s.murajaah}</span>}
              {s.surah && (
                <span className="text-xs font-normal text-silver-600">
                  {s.surah}
                  {s.fromAyah && (
                    <span dir="ltr">
                      {" "}
                      {s.fromAyah}
                      {s.toAyah ? `-${s.toAyah}` : ""}
                    </span>
                  )}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setSessions(sessions.filter((x) => x.id !== s.id))}
              className="shrink-0 text-xs font-bold text-red-600"
              aria-label="حذف"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <Field label="ملاحظات" icon="📝">
        <textarea
          className={`${inputCls} min-h-16`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

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

/** شارات حالة الأهداف الصغيرة على صندوق الطالبة */
export function GoalDots({ student }: { student: Student }) {
  return (
    <span className="flex items-center justify-center gap-1 text-[11px]">
      {goalItems("hifz").map(({ key, icon }) => {
        const has = Boolean(student.goals[key]?.trim());
        const isDone = student.done[key];
        return (
          <span
            key={key}
            className={`rounded-full px-1 ${
              isDone
                ? "bg-white/90"
                : has
                  ? "bg-white/40"
                  : "bg-white/10 opacity-40 grayscale"
            }`}
            title={key}
          >
            {icon}
          </span>
        );
      })}
    </span>
  );
}
