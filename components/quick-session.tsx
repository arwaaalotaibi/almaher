"use client";

import { useMemo, useState } from "react";
import {
  actions,
  buildSchedule,
  currentSessionIndex,
  dateKey,
  EMPTY_PLAN,
  formatSchedDate,
  recitePartLabel,
  useApp,
  type Halaqa,
  type RecitationLog,
  type RecitePart,
  type Student,
} from "@/lib/store";
import { computeProgress, type PosRange } from "@/lib/progress";
import { surahName } from "@/lib/mushaf";
import { PrimaryBtn, inputCls } from "./ui";

const ar = (n: number) => n.toLocaleString("ar-EG");

type PartKey = "tasmi" | "tathbit" | "muraja";
interface RowState {
  attended: boolean;
  tasmi: boolean;
  tathbit: boolean;
  muraja: boolean;
}

const PARTS: { key: PartKey; icon: string; label: string }[] = [
  { key: "tasmi", icon: "📖", label: "حفظ" },
  { key: "tathbit", icon: "📌", label: "تثبيت" },
  { key: "muraja", icon: "🔁", label: "مراجعة" },
];

/** مقطع من موضعين إلى قسم تسميع */
function rangePart(r: PosRange | null): RecitePart {
  if (!r) return { status: "none" };
  return {
    status: "done",
    fromSurah: surahName(r.from.surah),
    fromAyah: r.from.ayah,
    toSurah: surahName(r.to.surah),
    toAyah: r.to.ayah,
  };
}

/** 📋 التسجيل السريع للقاء: حضور كل طالبة وما سمّعته من وردها (حفظ/تثبيت/مراجعة)
    بضغطة — المقاطع تُملأ تلقائياً من «المطلوب القادم» لكل طالبة. */
export function QuickSession({
  halaqa,
  groups,
}: {
  halaqa: Halaqa;
  groups: { key: string; title: string; list: Student[] }[];
}) {
  const { recitations } = useApp();
  const termRows = useMemo(() => buildSchedule(halaqa, EMPTY_PLAN), [halaqa]);
  const [open, setOpen] = useState(false);
  const [groupKey, setGroupKey] = useState<string>("all");
  // الافتراضي: آخر لقاء وقع فعلاً (التسجيل بعد اللقاء لا قبله)
  const [date, setDate] = useState<string>(() => {
    if (termRows?.length) {
      const endOfToday = new Date().setHours(23, 59, 59, 999);
      const passed = [...termRows].reverse().find((r) => r.date.getTime() <= endOfToday);
      return dateKey((passed ?? termRows[0]).date);
    }
    return dateKey(new Date());
  });
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [saved, setSaved] = useState<number | null>(null);

  const shown = useMemo(
    () => (groupKey === "all" ? groups : groups.filter((g) => g.key === groupKey)),
    [groups, groupKey]
  );

  // لكل طالبة: سجلّ هذا التاريخ إن وُجد، والمطلوب القادم، وآخر مقطع حفظ (= التثبيت)
  const info = useMemo(() => {
    const map: Record<
      string,
      {
        existing?: RecitationLog;
        hifz: PosRange | null;
        mur: PosRange | null;
        tathbit: RecitePart | null;
      }
    > = {};
    for (const g of shown)
      for (const s of g.list) {
        const mine = recitations
          .filter((r) => r.studentId === s.id)
          .sort((a, b) => b.date.localeCompare(a.date));
        const existing = mine.find((r) => r.date === date);
        // المطلوب القادم يُحسب من السجلات قبل هذا التاريخ (حتى لا يقفز بعد الحفظ)
        const before = mine.filter((r) => r.date < date);
        const p = computeProgress(s, before, halaqa);
        const lastTasmi = before.find((r) => r.tasmi.status === "done")?.tasmi ?? null;
        map[s.id] = { existing, hifz: p.nextHifzRange, mur: p.nextMurRange, tathbit: lastTasmi };
      }
    return map;
  }, [shown, recitations, date, halaqa]);

  const rowOf = (s: Student): RowState => {
    if (rows[s.id]) return rows[s.id];
    const i = info[s.id];
    if (i?.existing) {
      const e = i.existing;
      return {
        attended: e.attended,
        tasmi: e.tasmi.status === "done",
        tathbit: e.tathbit.status === "done",
        muraja: e.muraja.status === "done",
      };
    }
    return {
      attended: true,
      tasmi: !!i?.hifz,
      tathbit: !!i?.tathbit,
      muraja: !!i?.mur,
    };
  };
  const setRow = (id: string, patch: Partial<RowState>, base: RowState) =>
    setRows((r) => ({ ...r, [id]: { ...base, ...patch } }));

  const sessionNo = termRows?.find((r) => dateKey(r.date) === date)?.n;

  const saveAll = () => {
    let n = 0;
    for (const g of shown)
      for (const s of g.list) {
        const i = info[s.id];
        const st = rowOf(s);
        const data: Omit<RecitationLog, "id" | "createdAt"> = {
          studentId: s.id,
          date,
          attended: st.attended,
          tasmi: st.attended && st.tasmi ? rangePart(i.hifz) : { status: "none" },
          muraja: st.attended && st.muraja ? rangePart(i.mur) : { status: "none" },
          tathbit:
            st.attended && st.tathbit && i.tathbit ? { ...i.tathbit } : { status: "none" },
          note: i.existing?.note ?? "",
        };
        if (i.existing) actions.updateRecitation(i.existing.id, data);
        else actions.addRecitation(data);
        n++;
      }
    setRows({});
    setSaved(n);
    setTimeout(() => setSaved(null), 2500);
  };

  const total = shown.reduce((n, g) => n + g.list.length, 0);
  if (!termRows?.length || total === 0) return null;

  return (
    <div className="card mb-4 rounded-2xl p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
      >
        <span className="font-kufi text-sm font-bold text-plum-800">
          📋 تسجيل لقاء كامل بضغطة
        </span>
        <span className="text-plum-600">{open ? "▴" : "▾"}</span>
      </button>
      {!open ? (
        <p className="mt-1 text-[11px] text-silver-600">
          حضور كل طالبة وما سمّعته من وردها — والمقاطع تُملأ تلقائياً من خطتها
        </p>
      ) : (
        <div className="mt-3">
          <div className="mb-3 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-plum-700">اللقاء</span>
              <select
                className={inputCls}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setRows({});
                }}
              >
                {termRows.map((r) => (
                  <option key={r.n} value={dateKey(r.date)}>
                    لقاء {ar(r.n)} — {formatSchedDate(r.date)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-plum-700">المعلّمة</span>
              <select
                className={inputCls}
                value={groupKey}
                onChange={(e) => {
                  setGroupKey(e.target.value);
                  setRows({});
                }}
              >
                <option value="all">كل المعلّمات ({ar(groups.reduce((n, g) => n + g.list.length, 0))})</option>
                {groups.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.title} ({ar(g.list.length)})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="mb-2 text-[11px] text-silver-600">
            الكل «حاضرة» وسمّعت وردها كاملاً افتراضياً — عدّلي الغائبات ومن سمّعت
            جزءاً فقط، ثم احفظي. من لها سجلّ لهذا اللقاء تظهر عليها «مسجّل ✓» ويُحدَّث.
          </p>

          <div className="grid gap-2">
            {shown.map((g) => (
              <div key={g.key}>
                {groupKey === "all" && (
                  <p className="mb-1 mt-2 text-xs font-bold text-plum-700">👩‍🏫 {g.title}</p>
                )}
                {g.list.map((s) => {
                  const i = info[s.id];
                  const st = rowOf(s);
                  const labels: Record<PartKey, string> = {
                    tasmi: i.hifz ? recitePartLabel(rangePart(i.hifz)) : "",
                    tathbit: i.tathbit ? recitePartLabel(i.tathbit) : "",
                    muraja: i.mur ? recitePartLabel(rangePart(i.mur)) : "",
                  };
                  return (
                    <div
                      key={s.id}
                      className={`mb-1.5 rounded-xl border px-3 py-2 ${
                        st.attended ? "border-cream-dark bg-white" : "border-red-200 bg-red-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-bold text-plum-800">
                          {s.name}
                          {i.existing && (
                            <span className="ms-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                              مسجّل ✓
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => setRow(s.id, { attended: !st.attended }, st)}
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            st.attended
                              ? "bg-emerald-500 text-white"
                              : "bg-red-500 text-white"
                          }`}
                        >
                          {st.attended ? "حاضرة ✓" : "غائبة ✗"}
                        </button>
                      </div>
                      {st.attended && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {PARTS.map((p) => {
                            const has = !!labels[p.key];
                            const on = has && st[p.key];
                            return (
                              <button
                                key={p.key}
                                type="button"
                                disabled={!has}
                                title={labels[p.key] || "لا مطلوب"}
                                onClick={() => setRow(s.id, { [p.key]: !st[p.key] }, st)}
                                className={`rounded-lg border px-2 py-1 text-start text-[11px] ${
                                  !has
                                    ? "border-cream-dark text-silver-400 line-through"
                                    : on
                                      ? "border-plum-600 bg-plum-600 text-white"
                                      : "border-cream-dark bg-white text-silver-600"
                                }`}
                              >
                                <span className="font-bold">
                                  {p.icon} {p.label}
                                </span>
                                {has && (
                                  <span className={`block ${on ? "text-white/85" : ""}`}>
                                    {labels[p.key]}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-3">
            <PrimaryBtn onClick={saveAll}>
              {saved !== null
                ? `تم حفظ ${ar(saved)} سجلّاً ✓`
                : `حفظ لقاء ${sessionNo ? ar(sessionNo) : ""} لـ ${ar(total)} طالبة`}
            </PrimaryBtn>
          </div>
        </div>
      )}
    </div>
  );
}
