"use client";

import { useEffect, useState } from "react";
import {
  actions,
  goalItems,
  TRACKS,
  TRACK_META,
  useApp,
  type Goals,
  type GoalsDone,
  type Student,
  type TrackKey,
} from "@/lib/store";
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
  const [track, setTrack] = useState<TrackKey>("hifz");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (student) {
      setName(student.name);
      setTeacherId(student.teacherId);
      setHalaqaId(student.halaqaId);
      setTrack(student.track ?? "hifz");
      setGoals({ ...student.goals });
      setDone({ ...student.done });
      setNote(student.note ?? "");
    }
  }, [student]);

  if (!student) return null;

  const save = () => {
    if (!name.trim()) return;
    actions.updateStudent(student.id, {
      name: name.trim(),
      teacherId,
      halaqaId,
      track,
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

      <div className="mb-3">
        <p className="mb-1 block text-sm font-bold text-plum-700">🛤️ المسار</p>
        <div className="grid grid-cols-3 gap-2">
          {TRACKS.map((tk) => (
            <button
              key={tk}
              type="button"
              onClick={() => setTrack(tk)}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 py-2.5 transition ${
                track === tk
                  ? "border-plum-600 bg-plum-50"
                  : "border-cream-dark bg-cream/40"
              }`}
            >
              <span className="text-xl">{TRACK_META[tk].icon}</span>
              <span
                className={`font-kufi text-sm font-bold ${
                  track === tk ? "text-plum-800" : "text-silver-600"
                }`}
              >
                {TRACK_META[tk].label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 rounded-2xl bg-plum-50 p-3">
        <p className="mb-2 font-kufi text-sm font-bold text-plum-800">
          أهداف مسار {TRACK_META[track].label} هذا الأسبوع
        </p>
        {goalItems(track).map(({ key, label, icon }) => (
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
      {goalItems(student.track).map(({ key, icon }) => {
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
