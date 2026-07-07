"use client";

import { useEffect, useState } from "react";
import {
  actions,
  CoursePlan,
  EMPTY_PLAN,
  goalItems,
  normalizeDigits,
  PLAN_FIELDS,
  SESSION_KINDS,
  sessionKindMeta,
  uid,
  useApp,
  type Goals,
  type GoalsDone,
  type SessionLog,
  type Student,
} from "@/lib/store";
import { SURAHS } from "@/lib/surahs";
import { DangerBtn, Field, inputCls, PrimaryBtn, Sheet } from "./ui";

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

  // مسودّة إنجاز اللقاء
  const [sKind, setSKind] = useState<string>("hifz");
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
      setSKind("hifz");
      setSSurah("");
      setSFrom("");
      setSTo("");
    }
  }, [student]);

  const addSession = () => {
    if (!sSurah.trim()) return;
    setSessions([
      {
        id: uid(),
        date: new Date().toISOString(),
        kind: sKind,
        surah: sSurah.trim(),
        fromAyah: normalizeDigits(sFrom),
        toAyah: normalizeDigits(sTo),
      },
      ...sessions,
    ]);
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

      {/* سجل إنجاز اللقاءات */}
      <div className="mb-3 rounded-2xl border border-cream-dark p-3">
        <p className="mb-2 font-kufi text-sm font-bold text-plum-800">
          ✅ إنجاز اللقاءات ({sessions.length.toLocaleString("ar-EG")}
          {plan.meetings ? ` من ${plan.meetings.toLocaleString("ar-EG")}` : ""})
        </p>

        {/* إضافة إنجاز لقاء جديد */}
        <div className="mb-2 rounded-xl bg-plum-50 p-2.5">
          <div className="mb-2 flex gap-1.5">
            {SESSION_KINDS.map((k) => (
              <button
                key={k.key}
                type="button"
                onClick={() => setSKind(k.key)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition ${
                  sKind === k.key
                    ? "bg-plum-600 text-white"
                    : "bg-white text-silver-600"
                }`}
              >
                {k.icon} {k.label}
              </button>
            ))}
          </div>
          <input
            className={`${inputCls} mb-2`}
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
          <div className="mb-2 grid grid-cols-2 gap-2">
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
          <button
            type="button"
            onClick={addSession}
            className="w-full rounded-xl bg-plum-600 py-2 text-sm font-bold text-white"
          >
            ➕ تسجيل إنجاز اللقاء
          </button>
        </div>

        {/* قائمة الإنجازات */}
        {sessions.map((s, i) => {
          const km = sessionKindMeta(s.kind);
          return (
            <div
              key={s.id}
              className="mb-1.5 flex items-center justify-between rounded-lg bg-cream px-3 py-2 text-sm"
            >
              <span className="font-bold text-plum-800">
                {km.icon} {s.surah}
                {s.fromAyah && (
                  <span dir="ltr" className="text-silver-600">
                    {" "}
                    {s.fromAyah}
                    {s.toAyah ? `-${s.toAyah}` : ""}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => setSessions(sessions.filter((x) => x.id !== s.id))}
                className="text-xs font-bold text-red-600"
                aria-label="حذف"
              >
                ✕
              </button>
            </div>
          );
        })}
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
