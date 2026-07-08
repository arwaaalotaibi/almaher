"use client";

import { useMemo, useState } from "react";
import {
  actions,
  RECITE_PARTS,
  recitePartLabel,
  useApp,
  type RecitePart,
  type Student,
} from "@/lib/store";
import { ayahCount, SURAHS } from "@/lib/surahs";
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

type PartForm = {
  status: "done" | "none";
  fromSurah: string;
  fromAyah: number;
  toSurah: string;
  toAyah: number;
};
const EMPTY: PartForm = {
  status: "none",
  fromSurah: "",
  fromAyah: 1,
  toSurah: "",
  toAyah: 1,
};

/** قائمة اختيار السورة + الآية */
function SurahAyah({
  surah,
  ayah,
  onSurah,
  onAyah,
}: {
  surah: string;
  ayah: number;
  onSurah: (v: string) => void;
  onAyah: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <select
        className={inputCls}
        value={surah}
        onChange={(e) => onSurah(e.target.value)}
      >
        <option value="">السورة…</option>
        {SURAHS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select
        className={inputCls}
        value={ayah}
        onChange={(e) => onAyah(Number(e.target.value))}
        disabled={!surah}
      >
        {Array.from({ length: Math.max(1, ayahCount(surah)) }, (_, i) => i + 1).map(
          (n) => (
            <option key={n} value={n}>
              آية {ar(n)}
            </option>
          )
        )}
      </select>
    </div>
  );
}

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

  return (
    <div className="grid gap-2">
      {mine.map((r) => {
        const done = RECITE_PARTS.map((p) => ({
          p,
          label: recitePartLabel(r[p.key] as RecitePart),
        })).filter((x) => x.label);
        return (
          <div key={r.id} className="rounded-xl bg-cream/60 px-3 py-2.5">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-bold text-plum-700">
                📅 {fmtDate(r.date)}
              </span>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("حذف هذا السجلّ؟"))
                      actions.removeRecitation(r.id);
                  }}
                  className="text-[11px] font-bold text-red-600"
                >
                  حذف
                </button>
              )}
            </div>
            {!r.attended ? (
              <p className="text-sm font-bold text-amber-700">🚫 غائبة</p>
            ) : done.length === 0 ? (
              <p className="text-sm font-bold text-silver-600">
                حضرت — لم تُسمّع
              </p>
            ) : (
              <div className="grid gap-0.5">
                {done.map(({ p, label }) => (
                  <p key={p.key} className="text-sm font-bold text-plum-800">
                    {p.icon} {p.label.replace(" (الحفظ الجديد)", "")}:{" "}
                    <span className="text-ink">{label}</span>
                  </p>
                ))}
              </div>
            )}
            {r.note && <p className="mt-1 text-xs text-silver-600">📝 {r.note}</p>}
          </div>
        );
      })}
    </div>
  );
}

/** نموذج تسجّل فيه الطالبة/المعلّمة ما سُمّع في اللقاء */
export function ReciteLogger({ student }: { student: Student }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [attended, setAttended] = useState(true);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [parts, setParts] = useState<Record<string, PartForm>>({
    tasmi: { ...EMPTY },
    muraja: { ...EMPTY },
    tathbit: { ...EMPTY },
  });

  const setPart = (key: string, patch: Partial<PartForm>) =>
    setParts((s) => ({ ...s, [key]: { ...s[key], ...patch } }));

  const reset = () => {
    setParts({ tasmi: { ...EMPTY }, muraja: { ...EMPTY }, tathbit: { ...EMPTY } });
    setNote("");
    setAttended(true);
  };

  const save = () => {
    const build = (p: PartForm): RecitePart =>
      p.status === "done" && p.fromSurah
        ? {
            status: "done",
            fromSurah: p.fromSurah,
            fromAyah: p.fromAyah,
            toSurah: p.toSurah || p.fromSurah,
            toAyah: p.toAyah,
          }
        : { status: "none" };

    if (attended) {
      const t = build(parts.tasmi),
        m = build(parts.muraja),
        th = build(parts.tathbit);
      if (t.status !== "done" && m.status !== "done" && th.status !== "done") {
        window.alert(
          "اختاري «سمّعت» وحدّدي المقطع لقسم واحد على الأقل، أو اختاري «غائبة»"
        );
        return;
      }
      actions.addRecitation({
        studentId: student.id,
        date,
        attended: true,
        tasmi: t,
        muraja: m,
        tathbit: th,
        note: note.trim() || undefined,
      });
    } else {
      actions.addRecitation({
        studentId: student.id,
        date,
        attended: false,
        tasmi: { status: "none" },
        muraja: { status: "none" },
        tathbit: { status: "none" },
        note: note.trim() || undefined,
      });
    }
    reset();
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

          {/* حضور / غياب */}
          <div className="mb-3 grid grid-cols-2 gap-2">
            {[
              { v: true, label: "✅ حضرت وسمّعت" },
              { v: false, label: "🚫 غائبة" },
            ].map((o) => (
              <button
                key={String(o.v)}
                type="button"
                onClick={() => setAttended(o.v)}
                className={`rounded-xl border-2 py-2.5 text-sm font-bold transition ${
                  attended === o.v
                    ? "border-plum-600 bg-plum-50 text-plum-800"
                    : "border-cream-dark text-silver-600"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {attended &&
            RECITE_PARTS.map((p) => {
              const pf = parts[p.key];
              const done = pf.status === "done";
              return (
                <div
                  key={p.key}
                  className="mb-2 rounded-2xl border border-cream-dark p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-bold text-plum-800">
                      {p.icon} {p.label}
                    </span>
                    <div className="flex gap-1">
                      {[
                        { s: "done", t: "سمّعت" },
                        { s: "none", t: "لم تسمّع" },
                      ].map((o) => (
                        <button
                          key={o.s}
                          type="button"
                          onClick={() =>
                            setPart(p.key, {
                              status: o.s as "done" | "none",
                            })
                          }
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                            pf.status === o.s
                              ? "bg-plum-600 text-white"
                              : "bg-cream text-silver-600"
                          }`}
                        >
                          {o.t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {done && (
                    <div className="grid gap-2">
                      <div>
                        <span className="mb-1 block text-[11px] font-bold text-plum-700">
                          من
                        </span>
                        <SurahAyah
                          surah={pf.fromSurah}
                          ayah={pf.fromAyah}
                          onSurah={(v) =>
                            setPart(p.key, {
                              fromSurah: v,
                              fromAyah: 1,
                              toSurah: pf.toSurah || v,
                            })
                          }
                          onAyah={(v) => setPart(p.key, { fromAyah: v })}
                        />
                      </div>
                      <div>
                        <span className="mb-1 block text-[11px] font-bold text-plum-700">
                          إلى
                        </span>
                        <SurahAyah
                          surah={pf.toSurah}
                          ayah={pf.toAyah}
                          onSurah={(v) => setPart(p.key, { toSurah: v, toAyah: 1 })}
                          onAyah={(v) => setPart(p.key, { toAyah: v })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

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
            السجلّات السابقة
          </p>
          <ReciteHistory studentId={student.id} canDelete />
        </div>
      )}
    </div>
  );
}
