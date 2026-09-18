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
import {
  computeProgress,
  hifzMode,
  logFaces,
  murMode,
  partFaces,
  rangeForFaces,
  type PathMode,
  type PosRange,
} from "@/lib/progress";
import { surahName, surahNumber } from "@/lib/mushaf";
import { ayahCount, SURAHS } from "@/lib/surahs";
import { PrimaryBtn, inputCls } from "./ui";
import { supabase } from "@/lib/supabase";

const ar = (n: number) => n.toLocaleString("ar-EG");

type PartKey = "tasmi" | "tathbit" | "muraja";
interface RowState {
  attended: boolean;
  tasmi: boolean;
  tathbit: boolean;
  muraja: boolean;
  // تعديل المقطع الفعلي (زيادة/نقصان): نهاية مختلفة عن المطلوب
  edit?: Partial<Record<PartKey, PosRange>>;
}

const PARTS: { key: PartKey; icon: string; label: string }[] = [
  { key: "tasmi", icon: "📖", label: "حفظ" },
  { key: "tathbit", icon: "📌", label: "تثبيت" },
  { key: "muraja", icon: "🔁", label: "مراجعة" },
];

/** قسم تسميع إلى مقطع (للتثبيت المأخوذ من آخر حفظ) */
function partRange(p: RecitePart | null): PosRange | null {
  if (!p || p.status !== "done" || !p.fromSurah) return null;
  return {
    from: { surah: surahNumber(p.fromSurah), ayah: p.fromAyah ?? 1 },
    to: { surah: surahNumber(p.toSurah || p.fromSurah), ayah: p.toAyah ?? p.fromAyah ?? 1 },
  };
}

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

  // 🔤 ترتيب الطالبات: كما في القائمة (ترتيب الإدخال) أو أبجدياً — يُحفظ على الجهاز
  const [alpha, setAlpha] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem("almaher_qs_alpha") === "1";
    } catch {
      return false;
    }
  });
  const toggleAlpha = () => {
    setAlpha((v) => {
      try {
        window.localStorage.setItem("almaher_qs_alpha", v ? "0" : "1");
      } catch {
        /* لا تخزين */
      }
      return !v;
    });
  };
  const shown = useMemo(() => {
    const gs = groupKey === "all" ? groups : groups.filter((g) => g.key === groupKey);
    if (!alpha) return gs;
    return gs.map((g) => ({ ...g, list: [...g.list].sort((a, b) => a.name.localeCompare(b.name, "ar")) }));
  }, [groups, groupKey, alpha]);

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
  const [editing, setEditing] = useState<string | null>(null); // "studentId:part" المفتوح للتعديل الدقيق

  /** المقطع الفعلي لقسم: المعدَّل إن وُجد، وإلا المطلوب */
  const rangeOf = (s: Student, key: PartKey, st: RowState): PosRange | null => {
    const i = info[s.id];
    if (st.edit?.[key]) return st.edit[key]!;
    if (key === "tasmi") return i?.hifz ?? null;
    if (key === "muraja") return i?.mur ?? null;
    return partRange(i?.tathbit ?? null);
  };
  const modeOf = (s: Student, key: PartKey): PathMode =>
    key === "muraja" ? murMode(s.plan) : hifzMode(s.plan);
  const facesOf = (s: Student, key: PartKey, r: PosRange | null) =>
    partFaces(rangePart(r), modeOf(s, key) !== "asc", key === "muraja" ? "muraja" : "hifz");
  /** زيادة/نقصان وجه: يُعاد حساب النهاية من البداية نفسها */
  // المراجعة النازلة بالصفحات تُبنى من طرفها الأعلى («إلى») نزولاً؛ البقية من «من»
  const anchorIsTo = (s: Student, key: PartKey) => modeOf(s, key) === "pageDesc";
  const bump = (s: Student, key: PartKey, st: RowState, delta: number) => {
    const cur = rangeOf(s, key, st);
    if (!cur) return;
    const k = Math.max(1, facesOf(s, key, cur) + delta);
    const next = rangeForFaces(anchorIsTo(s, key) ? cur.to : cur.from, k, modeOf(s, key));
    if (next) setRow(s.id, { edit: { ...st.edit, [key]: next } }, st);
  };
  /** تحديد الطرف المتحرّك بدقة الآية (النهاية عادةً، والبداية في المراجعة النازلة) */
  const setEnd = (s: Student, key: PartKey, st: RowState, pos: { surah: number; ayah: number }) => {
    const cur = rangeOf(s, key, st);
    if (!cur) return;
    const next = anchorIsTo(s, key) ? { from: pos, to: cur.to } : { from: cur.from, to: pos };
    setRow(s.id, { edit: { ...st.edit, [key]: next } }, st);
  };

  const sessionNo = termRows?.find((r) => dateKey(r.date) === date)?.n;

  /** حفظ سجلّ طالبة واحدة كما هو معروض في صفّها — يعيد بيانات إشعارها */
  const saveOne = (s: Student, batch = false): SessionItem => {
    const i = info[s.id];
    const st = rowOf(s);
    const data: Omit<RecitationLog, "id" | "createdAt"> = {
      studentId: s.id,
      date,
      attended: st.attended,
      tasmi: st.attended && st.tasmi ? rangePart(rangeOf(s, "tasmi", st)) : { status: "none" },
      muraja: st.attended && st.muraja ? rangePart(rangeOf(s, "muraja", st)) : { status: "none" },
      tathbit:
        st.attended && st.tathbit ? rangePart(rangeOf(s, "tathbit", st)) : { status: "none" },
      note: i.existing?.note ?? "",
    };
    data.faces = logFaces(data, s.plan);
    if (i.existing) actions.updateRecitation(i.existing.id, data);
    else actions.addRecitation(data);
    // نُفرغ تعديلات هذا الصف فقط — يُعرض بعدها من سجلّه المحفوظ
    setRows((r) => {
      const next = { ...r };
      delete next[s.id];
      return next;
    });
    setJustSaved((j) => ({ ...j, [s.id]: Date.now() }));
    setTimeout(() => setJustSaved((j) => (j[s.id] ? { ...j, [s.id]: 0 } : j)), 2500);
    const item = itemOf(s, st, data);
    if (!batch) pushSession([item]);
    return item;
  };
  const [justSaved, setJustSaved] = useState<Record<string, number>>({});
  const [notify, setNotify] = useState(true); // 🔔 إشعار للطالبة عند الاعتماد
  const [notified, setNotified] = useState<string | null>(null);

  type SessionItem = { student_id: string; attended: boolean; hifz: number; tathbit: number; muraja: number; absences: number };
  /** بيانات إشعار طالبة من صفّها: الأوجه الفعلية، وعدد غياباتها هذا الفصل بعد هذا اللقاء */
  const itemOf = (s: Student, st: RowState, data: Omit<RecitationLog, "id" | "createdAt">): SessionItem => {
    const f = data.faces ?? { tasmi: 0, tathbit: 0, muraja: 0 };
    const term = halaqa.termStart ?? "";
    const prevAbs = recitations.filter(
      (r) => r.studentId === s.id && !r.attended && r.date !== date && (!term || r.date >= term)
    ).length;
    return {
      student_id: s.id,
      attended: st.attended,
      hifz: f.tasmi,
      tathbit: f.tathbit,
      muraja: f.muraja,
      absences: prevAbs + (st.attended ? 0 : 1),
    };
  };
  const pushSession = (items: SessionItem[]) => {
    if (!notify || items.length === 0) return;
    void supabase.functions
      .invoke("almaher-push", { body: { kind: "session", date, items } })
      .then(({ data }) => {
        const sent = (data as { sent?: number } | null)?.sent ?? 0;
        setNotified(sent > 0 ? `🔔 وصل الإشعار إلى ${ar(sent)} جهاز` : "🔕 لا أجهزة مفعّلة الإشعارات لهؤلاء");
        setTimeout(() => setNotified(null), 3500);
      })
      .catch(() => setNotified("تعذّر إرسال الإشعار"));
  };

  const saveAll = () => {
    const items: SessionItem[] = [];
    for (const g of shown) for (const s of g.list) items.push(saveOne(s, true));
    setRows({});
    setSaved(items.length);
    setTimeout(() => setSaved(null), 2500);
    pushSession(items);
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
          📋 تسجيل تسميع اللقاء
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

          <div className="mb-2 flex items-center gap-1.5 text-xs">
            <span className="font-bold text-plum-700">الترتيب:</span>
            {[
              { v: false, l: "كما في القائمة" },
              { v: true, l: "🔤 أبجدي" },
            ].map((o) => (
              <button
                key={String(o.v)}
                type="button"
                onClick={() => alpha !== o.v && toggleAlpha()}
                className={`rounded-full px-3 py-1 font-bold transition ${
                  alpha === o.v ? "bg-plum-600 text-white" : "bg-cream text-plum-700"
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setNotify((v) => !v)}
            className={`mb-2 flex w-full items-center justify-between rounded-xl border px-3 py-2 text-start text-xs font-bold ${
              notify ? "border-plum-500 bg-plum-50 text-plum-800" : "border-cream-dark bg-white text-silver-600"
            }`}
          >
            <span>
              {notify ? "🔔 إشعار للطالبة عند الاعتماد" : "🔕 بلا إشعار عند الاعتماد"}
              <span className="block text-[10px] font-normal">
                الحاضرة: تشجيع بما سمّعته · الغائبة: رسالة لطيفة تتدرّج مع تكرار الغياب
              </span>
            </span>
            <span className={`relative h-5 w-9 rounded-full ${notify ? "bg-plum-600" : "bg-silver-400"}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${notify ? "start-4" : "start-0.5"}`} />
            </span>
          </button>
          {notified && (
            <p className="mb-2 rounded-xl bg-emerald-50 px-3 py-1.5 text-center text-[11px] font-bold text-emerald-700">
              {notified}
            </p>
          )}
          <p className="mb-2 text-[11px] text-silver-600">
            الكل «حاضرة» وسمّعت وردها كاملاً افتراضياً — عدّلي الغائبات، ومن سمّعت
            أكثر أو أقل استخدمي «− / +» لتغيير الأوجه أو ✏️ لتحديد آية النهاية بدقة،
            ثم «اعتماد» لكل طالبة على حدة، أو زر الحفظ في الأسفل للجميع دفعة واحدة.
            من لها سجلّ لهذا اللقاء تظهر عليها «مسجّل ✓» ويُحدَّث.
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
                    tasmi: recitePartLabel(rangePart(rangeOf(s, "tasmi", st))),
                    tathbit: recitePartLabel(rangePart(rangeOf(s, "tathbit", st))),
                    muraja: recitePartLabel(rangePart(rangeOf(s, "muraja", st))),
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
                        <span className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setRow(s.id, { attended: !st.attended }, st)}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                              st.attended
                                ? "bg-emerald-500 text-white"
                                : "bg-red-500 text-white"
                            }`}
                          >
                            {st.attended ? "حاضرة ✓" : "غائبة ✗"}
                          </button>
                          <button
                            type="button"
                            onClick={() => saveOne(s)}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                              justSaved[s.id]
                                ? "bg-emerald-600 text-white"
                                : rows[s.id]
                                  ? "bg-amber-500 text-white"
                                  : "bg-plum-600 text-white"
                            }`}
                            title="اعتماد سجلّ هذه الطالبة وحدها"
                          >
                            {justSaved[s.id] ? "تم ✓" : rows[s.id] ? "💾 اعتماد*" : "💾 اعتماد"}
                          </button>
                        </span>
                      </div>
                      {st.attended && (
                        <div className="mt-1.5 grid gap-1.5">
                          {PARTS.map((p) => {
                            const has = !!labels[p.key];
                            const on = has && st[p.key];
                            const r = rangeOf(s, p.key, st);
                            const edited = !!st.edit?.[p.key];
                            const ek = `${s.id}:${p.key}`;
                            const isEditing = editing === ek;
                            const n = has ? facesOf(s, p.key, r) : 0;
                            return (
                              <div key={p.key}>
                                <div className="flex items-stretch gap-1">
                                  <button
                                    type="button"
                                    disabled={!has}
                                    title={labels[p.key] || "لا مطلوب"}
                                    onClick={() => setRow(s.id, { [p.key]: !st[p.key] }, st)}
                                    className={`min-w-0 flex-1 rounded-lg border px-2 py-1 text-start text-[11px] ${
                                      !has
                                        ? "border-cream-dark text-silver-400 line-through"
                                        : on
                                          ? edited
                                            ? "border-amber-500 bg-amber-500 text-white"
                                            : "border-plum-600 bg-plum-600 text-white"
                                          : "border-cream-dark bg-white text-silver-600"
                                    }`}
                                  >
                                    <span className="font-bold">
                                      {p.icon} {p.label}
                                      {has && (
                                        <span className={`ms-1 font-normal ${on ? "text-white/85" : ""}`}>
                                          ({ar(n)} {n === 1 ? "وجه" : n === 2 ? "وجهان" : "أوجه"})
                                          {edited && " ✏️"}
                                        </span>
                                      )}
                                    </span>
                                    {has && (
                                      <span className={`block ${on ? "text-white/85" : ""}`}>
                                        {labels[p.key]}
                                      </span>
                                    )}
                                  </button>
                                  {has && on && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => bump(s, p.key, st, -1)}
                                        className="w-8 rounded-lg bg-cream text-sm font-bold text-plum-700"
                                        aria-label="وجه أقل"
                                      >
                                        −
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => bump(s, p.key, st, +1)}
                                        className="w-8 rounded-lg bg-cream text-sm font-bold text-plum-700"
                                        aria-label="وجه أكثر"
                                      >
                                        +
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditing(isEditing ? null : ek)}
                                        className={`w-8 rounded-lg text-sm ${isEditing ? "bg-plum-600 text-white" : "bg-cream text-plum-700"}`}
                                        aria-label="تعديل آية النهاية"
                                      >
                                        ✏️
                                      </button>
                                    </>
                                  )}
                                </div>
                                {has && on && isEditing && r && (() => {
                                  const toAnchored = anchorIsTo(s, p.key);
                                  const fixed = toAnchored ? r.to : r.from;
                                  const mov = toAnchored ? r.from : r.to;
                                  return (
                                  <div className="mt-1 grid grid-cols-[1fr_auto_auto] items-center gap-1.5 rounded-lg bg-cream/60 px-2 py-1.5 text-[11px]">
                                    <span className="font-bold text-plum-700">
                                      {toAnchored
                                        ? `إلى ${surahName(fixed.surah)} ${ar(fixed.ayah)} — من:`
                                        : `من ${surahName(fixed.surah)} ${ar(fixed.ayah)} — إلى:`}
                                    </span>
                                    <select
                                      className={`${inputCls} py-1 text-[11px]`}
                                      value={surahName(mov.surah)}
                                      onChange={(e) =>
                                        setEnd(s, p.key, st, {
                                          surah: surahNumber(e.target.value),
                                          ayah: Math.min(mov.ayah, ayahCount(e.target.value)),
                                        })
                                      }
                                    >
                                      {SURAHS.map((x) => (
                                        <option key={x} value={x}>
                                          {x}
                                        </option>
                                      ))}
                                    </select>
                                    <select
                                      className={`${inputCls} py-1 text-[11px]`}
                                      value={mov.ayah}
                                      onChange={(e) =>
                                        setEnd(s, p.key, st, { surah: mov.surah, ayah: Number(e.target.value) })
                                      }
                                    >
                                      {Array.from({ length: ayahCount(surahName(mov.surah)) }, (_, k) => k + 1).map((k) => (
                                        <option key={k} value={k}>
                                          {ar(k)}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  );
                                })()}
                              </div>
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
                : `حفظ الجميع — لقاء ${sessionNo ? ar(sessionNo) : ""} لـ ${ar(total)} طالبة`}
            </PrimaryBtn>
            <p className="mt-1.5 text-center text-[10px] text-silver-600">
              «اعتماد*» بعلامة النجمة = صفّ فيه تعديل لم يُحفظ بعد
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
