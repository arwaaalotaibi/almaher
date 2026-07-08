"use client";

import { useMemo, useState } from "react";
import {
  actions,
  normalizeDigits,
  RECITE_PARTS,
  reciteRangeLabel,
  useApp,
  type Student,
} from "@/lib/store";
import { SURAHS } from "@/lib/surahs";
import { Field, inputCls, PrimaryBtn } from "./ui";

const ar = (n: number) => n.toLocaleString("ar-EG");

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("ar-u-ca-gregory-nu-arab", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
}

function numOr(v: string): number | undefined {
  const n = Number(normalizeDigits(v));
  return n > 0 ? n : undefined;
}

type PartState = { surah: string; from: string; to: string };
const EMPTY: PartState = { surah: "", from: "", to: "" };

/** سجلّ التسميع لطالبة — يُعرض في صفحتها وفي بيانات الإدارة */
export function ReciteHistory({
  studentId,
  canDelete = false,
}: {
  studentId: string;
  canDelete?: boolean;
}) {
  const { recitations } = useApp();
  const mine = useMemo(
    () =>
      recitations
        .filter((r) => r.studentId === studentId)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [recitations, studentId]
  );

  if (mine.length === 0) {
    return (
      <p className="rounded-xl bg-cream/60 px-3 py-4 text-center text-xs text-silver-600">
        لا سجلّات تسميع بعد
      </p>
    );
  }

  const parts = (r: (typeof mine)[number]) =>
    [
      { p: RECITE_PARTS[0], label: reciteRangeLabel(r.tasmiSurah, r.tasmiFrom, r.tasmiTo) },
      { p: RECITE_PARTS[1], label: reciteRangeLabel(r.murajaSurah, r.murajaFrom, r.murajaTo) },
      { p: RECITE_PARTS[2], label: reciteRangeLabel(r.tathbitSurah, r.tathbitFrom, r.tathbitTo) },
    ].filter((x) => x.label);

  return (
    <div className="grid gap-2">
      {mine.map((r) => (
        <div key={r.id} className="rounded-xl bg-cream/60 px-3 py-2.5">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-bold text-plum-700">
              📅 {fmtDate(r.date)}
            </span>
            {canDelete && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("حذف هذا السجلّ؟")) actions.removeRecitation(r.id);
                }}
                className="text-[11px] font-bold text-red-600"
              >
                حذف
              </button>
            )}
          </div>
          <div className="grid gap-0.5">
            {parts(r).map(({ p, label }) => (
              <p key={p.key} className="text-sm font-bold text-plum-800">
                {p.icon} {p.label.replace(" (الحفظ الجديد)", "")}:{" "}
                <span className="text-ink">{label}</span>
              </p>
            ))}
          </div>
          {r.note && <p className="mt-1 text-xs text-silver-600">📝 {r.note}</p>}
        </div>
      ))}
    </div>
  );
}

/** نموذج تسجّل فيه الطالبة ما سمّعته بعد اللقاء */
export function ReciteLogger({ student }: { student: Student }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [parts, setParts] = useState<Record<string, PartState>>({
    tasmi: { ...EMPTY },
    muraja: { ...EMPTY },
    tathbit: { ...EMPTY },
  });

  const setPart = (key: string, patch: Partial<PartState>) =>
    setParts((s) => ({ ...s, [key]: { ...s[key], ...patch } }));

  const save = () => {
    const t = parts.tasmi,
      m = parts.muraja,
      th = parts.tathbit;
    if (!t.surah && !m.surah && !th.surah) {
      window.alert("اختاري سورة لواحد على الأقل (تسميع/مراجعة/تثبيت)");
      return;
    }
    actions.addRecitation({
      studentId: student.id,
      date,
      tasmiSurah: t.surah || undefined,
      tasmiFrom: numOr(t.from),
      tasmiTo: numOr(t.to),
      murajaSurah: m.surah || undefined,
      murajaFrom: numOr(m.from),
      murajaTo: numOr(m.to),
      tathbitSurah: th.surah || undefined,
      tathbitFrom: numOr(th.from),
      tathbitTo: numOr(th.to),
      note: note.trim() || undefined,
    });
    setParts({ tasmi: { ...EMPTY }, muraja: { ...EMPTY }, tathbit: { ...EMPTY } });
    setNote("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="card mb-4 rounded-2xl p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-start"
        aria-expanded={open}
      >
        <span className="font-kufi text-base font-bold text-plum-800">
          🎙️ سجّلي تسميع اللقاء
        </span>
        <span
          className={`text-plum-600 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="mt-3">
          <Field label="تاريخ اللقاء" icon="📅">
            <input
              type="date"
              className={inputCls}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>

          {RECITE_PARTS.map((p) => (
            <div key={p.key} className="mb-2 rounded-2xl border border-cream-dark p-3">
              <p className="mb-2 text-sm font-bold text-plum-800">
                {p.icon} {p.label}
              </p>
              <select
                className={`${inputCls} mb-2`}
                value={parts[p.key].surah}
                onChange={(e) => setPart(p.key, { surah: e.target.value })}
              >
                <option value="">اختاري السورة…</option>
                {SURAHS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-plum-700">
                    من آية
                  </span>
                  <input
                    className={`${inputCls} text-center`}
                    inputMode="numeric"
                    placeholder="٠"
                    value={parts[p.key].from}
                    onChange={(e) => setPart(p.key, { from: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-plum-700">
                    إلى آية
                  </span>
                  <input
                    className={`${inputCls} text-center`}
                    inputMode="numeric"
                    placeholder="٠"
                    value={parts[p.key].to}
                    onChange={(e) => setPart(p.key, { to: e.target.value })}
                  />
                </label>
              </div>
            </div>
          ))}

          <Field label="ملاحظة (اختياري)" icon="📝">
            <input
              className={inputCls}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثال: أتقنت الحفظ، تحتاج مراجعة…"
            />
          </Field>

          <PrimaryBtn onClick={save}>
            {saved ? "تم الحفظ ✓" : "حفظ التسميع"}
          </PrimaryBtn>

          <p className="mt-4 mb-2 font-kufi text-sm font-bold text-plum-700">
            سجلّاتي السابقة
          </p>
          <ReciteHistory studentId={student.id} canDelete />
        </div>
      )}
    </div>
  );
}
