"use client";

import { useMemo, useRef, useState } from "react";
import {
  actions,
  buildSchedule,
  dateKey,
  formatSchedDate,
  RECITE_PARTS,
  recitePartLabel,
  useApp,
  type Halaqa,
  type RecitationLog,
  type RecitePart,
  type ScheduleRow,
  type Student,
} from "@/lib/store";
import { partVerdict, sessionVerdict, type PartVerdict } from "@/lib/progress";
import { facesAcc, facesPlain } from "@/lib/arabic";
import { ayahCount, SURAHS } from "@/lib/surahs";
import { Field, inputCls, PrimaryBtn } from "./ui";

const ar = (n: number) => n.toLocaleString("ar-EG");

/** صوت الخطاب: الطالبة تُخاطَب («زدتِ»)، والإدارة تقرأ عنها («زادت») */
export type ChipVoice = "student" | "admin";

/** شارة قسم واحد: أنجزتِ المطلوب / زدتِ عنه / ناقص */
export function VerdictChip({
  v,
  voice = "student",
}: {
  v: PartVerdict | null;
  voice?: ChipVoice;
}) {
  if (!v) return null;
  if (v.status === "exceeded")
    return (
      <span
        className="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
        style={{ background: "linear-gradient(135deg,#b7973f,#8a6d3b)" }}
      >
        🌟 {voice === "student" ? "زدتِ" : "زادت"} {facesAcc(v.diff)}
      </span>
    );
  if (v.status === "met")
    return (
      <span className="inline-block rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
        ✓ {voice === "student" ? "أنجزتِ" : "أنجزت"} المطلوب
      </span>
    );
  return (
    <span className="inline-block rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
      ⏳ ناقص{" "}
      {v.partialFace
        ? // بدأت الوجه الأخير ولم تكمليه — النقص أقل من عدده الكامل
          -v.diff === 1
          ? "أقل من وجه"
          : `أقل من ${facesPlain(-v.diff)}`
        : facesPlain(-v.diff)}
    </span>
  );
}

/** شارة اللقاء كاملاً (الحفظ + التثبيت + المراجعة) */
export function SessionVerdictChip({
  status,
  voice = "student",
}: {
  status: PartVerdict["status"] | null;
  voice?: ChipVoice;
}) {
  if (!status) return null;
  if (status === "exceeded")
    return (
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
        style={{ background: "linear-gradient(135deg,#b7973f,#8a6d3b)" }}
      >
        🌟 فوق المطلوب
      </span>
    );
  if (status === "met")
    return (
      <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
        ✓ {voice === "student" ? "أنجزتِ" : "أنجزت"} المطلوب
      </span>
    );
  return (
    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
      ⏳ لم يكتمل المطلوب
    </span>
  );
}

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

/** تحويل قسم محفوظ إلى نموذج قابل للتعديل */
function partToForm(p?: RecitePart): PartForm {
  return p && p.status === "done" && p.fromSurah
    ? {
        status: "done",
        fromSurah: p.fromSurah,
        fromAyah: p.fromAyah ?? 1,
        toSurah: p.toSurah || p.fromSurah,
        toAyah: p.toAyah ?? p.fromAyah ?? 1,
      }
    : { ...EMPTY };
}

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

/** مطلوب كل قسم من صفّ الجدول — بمفاتيح أقسام التسميع */
const ROW_REQ: Record<string, "hifz" | "tathbit" | "murajaah"> = {
  tasmi: "hifz",
  tathbit: "tathbit",
  muraja: "murajaah",
};

/** سجلّ التسميع لطالبة — يُعرض في صفحتها وفي بيانات الإدارة */
export function ReciteHistory({
  studentId,
  canDelete = false,
  schedule,
  onEdit,
  editingId,
  voice = "student",
}: {
  studentId: string;
  canDelete?: boolean;
  schedule?: ScheduleRow[] | null;
  onEdit?: (r: RecitationLog) => void;
  editingId?: string | null;
  voice?: ChipVoice;
}) {
  const { recitations, terms } = useApp();
  const mine = useMemo(
    () =>
      recitations
        .filter((r) => r.studentId === studentId)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [recitations, studentId]
  );
  // مطلوب لقاءات الفصول المؤرشفة — تبقى شارات السجلّ القديم بعد بدء فصل جديد
  const archivedReqs = useMemo(() => {
    const map = new Map<
      string,
      { hifz: number; tathbit: number; murajaah: number }
    >();
    for (const t of terms) {
      const snap = t.students.find((x) => x.id === studentId);
      if (!snap) continue;
      const rows = buildSchedule(
        { day: t.day, termStart: t.termStart, termSessions: t.termSessions },
        snap.plan
      );
      for (const row of rows ?? []) {
        const k = dateKey(row.date);
        if (!map.has(k))
          map.set(k, {
            hifz: row.hifz,
            tathbit: row.tathbit,
            murajaah: row.murajaah,
          });
      }
    }
    return map;
  }, [terms, studentId]);
  // صفّ الجدول الموافق لتاريخ السجلّ — من الفصل الحالي أو من الأرشيف
  const rowFor = (
    dateISO: string
  ): { hifz: number; tathbit: number; murajaah: number } | undefined =>
    schedule?.find((s) => dateKey(s.date) === dateISO) ??
    archivedReqs.get(dateISO);

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
        const row = rowFor(r.date);
        const done = RECITE_PARTS.map((p) => ({
          p,
          label: recitePartLabel(r[p.key] as RecitePart),
          verdict:
            row && r.attended
              ? partVerdict(r[p.key] as RecitePart, row[ROW_REQ[p.key]])
              : null,
        })).filter((x) => x.label);
        const overall = row && r.attended ? sessionVerdict(r, row) : null;
        return (
          <div
            key={r.id}
            className={`rounded-xl px-3 py-2.5 ${
              editingId === r.id
                ? "bg-plum-50 ring-2 ring-plum-500"
                : "bg-cream/60"
            }`}
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-plum-700">
                📅 {fmtDate(r.date)}
                {editingId === r.id ? (
                  <span className="rounded-full bg-plum-600 px-1.5 py-0.5 text-[10px] text-white">
                    ✏️ قيد التعديل
                  </span>
                ) : (
                  <SessionVerdictChip status={overall} voice={voice} />
                )}
              </span>
              <span className="flex items-center gap-2.5">
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(r)}
                    className="text-[11px] font-bold text-plum-700"
                  >
                    ✏️ تعديل
                  </button>
                )}
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
              </span>
            </div>
            {!r.attended ? (
              <p className="text-sm font-bold text-amber-700">🚫 غائبة</p>
            ) : done.length === 0 ? (
              <p className="text-sm font-bold text-silver-600">
                حضرت — لم تُسمّع
              </p>
            ) : (
              <div className="grid gap-0.5">
                {done.map(({ p, label, verdict }) => (
                  <p key={p.key} className="text-sm font-bold text-plum-800">
                    {p.icon} {p.label.replace(" (الحفظ الجديد)", "")}:{" "}
                    <span className="text-ink">{label}</span>{" "}
                    <VerdictChip v={verdict} voice={voice} />
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
export function ReciteLogger({
  student,
  halaqa,
  voice = "student",
}: {
  student: Student;
  halaqa?: Halaqa;
  voice?: ChipVoice;
}) {
  const schedule = halaqa ? buildSchedule(halaqa, student.plan) : null;
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => {
    if (schedule && schedule.length) {
      // الافتراضي: آخر لقاء وقع فعلاً — التسجيل يكون بعد اللقاء لا قبله،
      // وإلا التصق السجلّ بلقاءٍ مستقبلي وأفسد حسبة «اللقاء القادم»
      const endOfToday = new Date().setHours(23, 59, 59, 999);
      const passed = [...schedule]
        .reverse()
        .find((s) => s.date.getTime() <= endOfToday);
      return dateKey((passed ?? schedule[0]).date);
    }
    return todayISO();
  });
  const [attended, setAttended] = useState(true);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  // سجلّ قيد التعديل — تصحيح خطأ دون إعادة الإدخال من البداية
  const [editingId, setEditingId] = useState<string | null>(null);
  const formTop = useRef<HTMLDivElement>(null);
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
    setEditingId(null);
  };

  /** تعبئة النموذج ببيانات سجلّ موجود لتعديله */
  const startEdit = (r: RecitationLog) => {
    setEditingId(r.id);
    setDate(r.date);
    setAttended(r.attended);
    setNote(r.note ?? "");
    setParts({
      tasmi: partToForm(r.tasmi),
      muraja: partToForm(r.muraja),
      tathbit: partToForm(r.tathbit),
    });
    formTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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

    let data: Omit<RecitationLog, "id" | "createdAt">;
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
      data = {
        studentId: student.id,
        date,
        attended: true,
        tasmi: t,
        muraja: m,
        tathbit: th,
        note: note.trim() || undefined,
      };
    } else {
      data = {
        studentId: student.id,
        date,
        attended: false,
        tasmi: { status: "none" },
        muraja: { status: "none" },
        tathbit: { status: "none" },
        note: note.trim() || undefined,
      };
    }
    if (editingId) actions.updateRecitation(editingId, data);
    else actions.addRecitation(data);
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
        <div className="mt-3" ref={formTop}>
          {editingId && (
            <div className="mb-3 flex items-center justify-between rounded-xl bg-plum-600 px-3 py-2.5">
              <span className="text-sm font-bold text-white">
                ✏️ تعديل سجلّ {fmtDate(date)}
              </span>
              <button
                type="button"
                onClick={reset}
                className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold text-white"
              >
                ✕ إلغاء التعديل
              </button>
            </div>
          )}
          {schedule && schedule.length ? (
            <Field label="اللقاء" icon="📅">
              <select
                className={inputCls}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              >
                {/* سجلّ قديم بتاريخ خارج الجدول — نُبقيه خياراً حتى لا يضيع */}
                {!schedule.some((s) => dateKey(s.date) === date) && (
                  <option value={date}>{fmtDate(date)}</option>
                )}
                {schedule.map((s) => (
                  <option key={s.n} value={dateKey(s.date)}>
                    لقاء {ar(s.n)} · {formatSchedDate(s.date)}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="تاريخ اللقاء" icon="📅">
              <input
                type="date"
                className={inputCls}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
          )}

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
            {saved
              ? "تم الحفظ ✓"
              : editingId
                ? "حفظ التعديل"
                : "حفظ التسميع"}
          </PrimaryBtn>

          <p className="mt-4 mb-2 font-kufi text-sm font-bold text-plum-700">
            السجلّات السابقة
          </p>
          <ReciteHistory
            studentId={student.id}
            canDelete
            schedule={schedule}
            onEdit={startEdit}
            editingId={editingId}
            voice={voice}
          />
        </div>
      )}
    </div>
  );
}
