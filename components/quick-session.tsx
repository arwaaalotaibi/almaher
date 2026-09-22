"use client";

import { useMemo, useState } from "react";
import {
  actions,
  buildSchedule,
  currentSessionIndex,
  dateKey,
  EMPTY_PLAN,
  formatSchedDate,
  mergeReciteParts,
  recitePartLabel,
  tathbitSpan,
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
import { facesText } from "@/lib/faces";
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
  // 📝 ملاحظة اللقاء (undefined = كما هي في السجلّ المحفوظ)
  note?: string;
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
  onOpenStudent,
  defaultOpen = false,
}: {
  halaqa: Halaqa;
  groups: { key: string; title: string; list: Student[] }[];
  /** الضغط على اسم الطالبة يفتح ملفها (بطاقتها) */
  onOpenStudent?: (s: Student) => void;
  /** مفتوحة من البداية (شاشة المعلّمة) */
  defaultOpen?: boolean;
}) {
  const { recitations } = useApp();
  const termRows = useMemo(() => buildSchedule(halaqa, EMPTY_PLAN), [halaqa]);
  const [open, setOpen] = useState(defaultOpen);
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

  // لكل طالبة: سجلّ هذا التاريخ إن وُجد، والمطلوب القادم، وحفظ آخر لقاء/لقاءين/ثلاثة مدمجاً (= التثبيت)
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
        const lastTasmi = mergeReciteParts(
          before
            .filter((r) => r.tasmi.status === "done")
            .slice(0, tathbitSpan(s.plan))
            .reverse()
            .map((r) => r.tasmi)
        );
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
  // 🔎 فرز القائمة: الكل / لم يُسجَّل بعد / مسجّل
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");
  const passes = (s: Student) =>
    filter === "all" ? true : filter === "done" ? !!info[s.id]?.existing : !info[s.id]?.existing;
  const visible = shown.map((g) => ({ ...g, list: g.list.filter(passes) }));
  const [noteOpen, setNoteOpen] = useState<Record<string, boolean>>({}); // 📝 حقل الملاحظة المفتوح لكل طالبة

  /** المقطع الفعلي لقسم: المعدَّل الآن إن وُجد، وإلا المحفوظ في سجلّ هذا اللقاء،
      وإلا المطلوب — حتى لا يعود المقطع المعدَّل إلى «المطلوب» بعد الاعتماد */
  const rangeOf = (s: Student, key: PartKey, st: RowState): PosRange | null => {
    const i = info[s.id];
    if (st.edit?.[key]) return st.edit[key]!;
    const saved = partRange(i?.existing?.[key] ?? null);
    if (saved) return saved;
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
    // وجه كامل زيادة/نقصاً من البداية نفسها (بدقة الربع)
    const k = Math.max(0.25, Math.round((facesOf(s, key, cur) + delta) * 4) / 4);
    const next = rangeForFaces(anchorIsTo(s, key) ? cur.to : cur.from, k, modeOf(s, key));
    if (next) setRow(s.id, { edit: { ...st.edit, [key]: next } }, st);
  };
  /** تعديل أي طرف من المقطع بدقة الآية: «من» أو «إلى» (بترتيب المصحف) */
  const setEdge = (
    s: Student,
    key: PartKey,
    st: RowState,
    edge: "from" | "to",
    pos: { surah: number; ayah: number }
  ) => {
    const cur = rangeOf(s, key, st);
    if (!cur) return;
    setRow(s.id, { edit: { ...st.edit, [key]: { ...cur, [edge]: pos } } }, st);
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
      note: st.note ?? i.existing?.note ?? "",
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
    // يبقى الزر أخضر «تم الاعتماد» حتى يُعدَّل الصف من جديد
    setJustSaved((j) => ({ ...j, [s.id]: Date.now() }));
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
      .then(({ data, error }) => {
        const d = (data as { sent?: number; removed?: number; failed?: number } | null) ?? {};
        const sent = d.sent ?? 0;
        const dead = (d.removed ?? 0) + (d.failed ?? 0);
        let msg: string;
        if (error) msg = "⚠️ تعذّر الاتصال بخدمة الإشعارات — سُجّل اللقاء دون إشعار";
        else if (sent > 0)
          msg = `🔔 وصل الإشعار إلى ${ar(sent)} جهاز` + (dead ? ` · ⚠️ ${ar(dead)} اشتراك قديم أُلغي (يُجدَّد عند فتح التطبيق)` : "");
        else if (dead) msg = `⚠️ لم يصل الإشعار: ${ar(dead)} اشتراك قديم أُلغي — يُجدَّد تلقائياً عند فتح الطالبة التطبيق`;
        else msg = "🔕 لا أجهزة مفعّلة الإشعارات لهؤلاء";
        setNotified(msg);
        setTimeout(() => setNotified(null), 6000);
      })
      .catch(() => setNotified("تعذّر إرسال الإشعار"));
  };

  const saveAll = () => {
    const items: SessionItem[] = [];
    for (const g of visible) for (const s of g.list) items.push(saveOne(s, true));
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
        <span className="font-kufi text-base font-bold text-plum-800">
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
          <div className={`mb-3 grid gap-2 ${groups.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
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
            <label className={groups.length > 1 ? "block" : "hidden"}>
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
          {(() => {
            const all = shown.flatMap((g) => g.list);
            const done = all.filter((x) => !!info[x.id]?.existing).length;
            const opts: { k: typeof filter; l: string; n: number }[] = [
              { k: "all", l: "الكل", n: all.length },
              { k: "pending", l: "⏳ لم يُسجَّل", n: all.length - done },
              { k: "done", l: "✓ مسجّل", n: done },
            ];
            return (
              <div className="mb-2 flex items-center gap-1.5 text-xs">
                <span className="font-bold text-plum-700">عرض:</span>
                {opts.map((o) => (
                  <button
                    key={o.k}
                    type="button"
                    onClick={() => setFilter(o.k)}
                    className={`rounded-full px-3 py-1 font-bold transition ${
                      filter === o.k ? "bg-plum-600 text-white" : "bg-cream text-plum-700"
                    }`}
                  >
                    {o.l} ({ar(o.n)})
                  </button>
                ))}
              </div>
            );
          })()}

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

          {/* عدّاد التسجيل: كم طالبة لها سجلّ لهذا اللقاء من مجموع الطالبات */}
          {(() => {
            const all = shown.flatMap((g) => g.list);
            const recorded = all.filter((s) => !!info[s.id]?.existing).length;
            const done = recorded === all.length;
            return (
              <p
                className={`mb-2 rounded-xl px-3 py-2 text-center text-sm font-bold ${
                  done ? "bg-emerald-50 text-emerald-800" : "bg-plum-50 text-plum-800"
                }`}
              >
                {done ? "✅" : "🧮"} تم تسجيل {ar(recorded)} من {ar(all.length)} طالبة
                {!done && ` — بقي ${ar(all.length - recorded)}`}
              </p>
            );
          })()}

          <div className="grid gap-2">
            {visible.every((g) => g.list.length === 0) && (
              <p className="rounded-xl bg-cream/60 px-3 py-3 text-center text-xs font-bold text-silver-600">
                {filter === "pending" ? "الجميع مسجّلات لهذا اللقاء ✅" : filter === "done" ? "لم يُسجَّل أحد بعد لهذا اللقاء" : "لا طالبات"}
              </p>
            )}
            {visible.map((g) => (
              <div key={g.key}>
                {groupKey === "all" && g.list.length > 0 && (
                  <p className="mb-1 mt-2 text-sm font-bold text-plum-700">
                    👩‍🏫 {g.title}
                    <span className="ms-1.5 font-normal text-silver-600">
                      ({ar(g.list.filter((s) => !!info[s.id]?.existing).length)} من {ar(g.list.length)})
                    </span>
                  </p>
                )}
                {g.list.map((s) => {
                  const i = info[s.id];
                  const st = rowOf(s);
                  const labels: Record<PartKey, string> = {
                    tasmi: recitePartLabel(rangePart(rangeOf(s, "tasmi", st))),
                    tathbit: recitePartLabel(rangePart(rangeOf(s, "tathbit", st))),
                    muraja: recitePartLabel(rangePart(rangeOf(s, "muraja", st)), modeOf(s, "muraja") === "pageDesc"),
                  };
                  return (
                    <div
                      key={s.id}
                      className={`mb-1.5 rounded-xl border px-3 py-2 ${
                        st.attended ? "border-cream-dark bg-white" : "border-red-200 bg-red-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenStudent?.(s)}
                          disabled={!onOpenStudent}
                          title="فتح ملف الطالبة"
                          className="min-w-0 truncate text-start text-base font-bold text-plum-800 enabled:underline enabled:decoration-plum-300 enabled:decoration-dotted enabled:underline-offset-4"
                        >
                          {s.name}
                          {i.existing && (
                            <span className="ms-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-bold text-emerald-700">
                              مسجّل ✓
                            </span>
                          )}
                        </button>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setRow(s.id, { attended: !st.attended }, st)}
                            className={`rounded-full px-2.5 py-1 text-sm font-bold ${
                              st.attended
                                ? "bg-emerald-500 text-white"
                                : "bg-red-500 text-white"
                            }`}
                          >
                            {st.attended ? "حاضرة ✓" : "غائبة ✗"}
                          </button>
                          {i.existing && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`إرجاع «${s.name}» إلى «غير مسجّلة» لهذا اللقاء؟\nيُحذف سجلّها لهذا اللقاء فقط، وتسجّلينه لاحقاً بعد التأكد.`)) {
                                  actions.removeRecitation(i.existing!.id);
                                  setRows((r) => {
                                    const next = { ...r };
                                    delete next[s.id];
                                    return next;
                                  });
                                  // يعود الزر إلى «اعتماد» فوراً لا بعد تحديث الصفحة
                                  setJustSaved((j) => {
                                    const next = { ...j };
                                    delete next[s.id];
                                    return next;
                                  });
                                }
                              }}
                              className="rounded-full bg-cream px-2 py-1 text-sm font-bold text-red-700"
                              title="إلغاء التسجيل — تعود غير مسجّلة"
                              aria-label="إلغاء التسجيل"
                            >
                              ↩️
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setNoteOpen((o) => ({ ...o, [s.id]: !o[s.id] }))}
                            className={`rounded-full px-2 py-1 text-sm font-bold ${
                              (st.note ?? i.existing?.note) ? "bg-amber-100 text-amber-900" : "bg-cream text-plum-700"
                            }`}
                            title="ملاحظة على هذا اللقاء"
                            aria-label="ملاحظة"
                          >
                            📝
                          </button>
                          <button
                            type="button"
                            onClick={() => saveOne(s)}
                            className={`rounded-full px-2.5 py-1 text-sm font-bold transition ${
                              rows[s.id]
                                ? "bg-amber-500 text-white"
                                : justSaved[s.id] || i.existing
                                  ? "bg-emerald-600 text-white"
                                  : "bg-plum-600 text-white"
                            }`}
                            title={
                              rows[s.id]
                                ? "اعتماد سجلّ هذه الطالبة وحدها"
                                : justSaved[s.id] || i.existing
                                  ? "تم اعتماد سجلّ هذه الطالبة — عدّلي ثم اضغطي من جديد للتصحيح"
                                  : "اعتماد سجلّ هذه الطالبة وحدها"
                            }
                          >
                            {rows[s.id] ? "💾 اعتماد*" : justSaved[s.id] || i.existing ? "✓ تم الاعتماد" : "💾 اعتماد"}
                          </button>
                        </span>
                      </div>
                      {(noteOpen[s.id] ?? !!i.existing?.note) && (
                        <textarea
                          className={`${inputCls} mt-1.5 min-h-14 text-sm`}
                          placeholder="📝 ملاحظة على هذا اللقاء (مثال: سمّعت بداية المقطع من آية أخرى، تحتاج مراجعة، …)"
                          value={st.note ?? i.existing?.note ?? ""}
                          onChange={(e) => setRow(s.id, { note: e.target.value }, st)}
                        />
                      )}
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
                                    className={`min-w-0 flex-1 rounded-lg border px-2 py-1 text-start text-sm ${
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
                                          ({facesText(n)})
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
                                        className="w-9 rounded-lg bg-cream text-base font-bold text-plum-700"
                                        aria-label="وجه أقل"
                                      >
                                        −
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => bump(s, p.key, st, +1)}
                                        className="w-9 rounded-lg bg-cream text-base font-bold text-plum-700"
                                        aria-label="وجه أكثر"
                                      >
                                        +
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditing(isEditing ? null : ek)}
                                        className={`w-9 rounded-lg text-base ${isEditing ? "bg-plum-600 text-white" : "bg-cream text-plum-700"}`}
                                        aria-label="تعديل آية النهاية"
                                      >
                                        ✏️
                                      </button>
                                    </>
                                  )}
                                </div>
                                {has && on && isEditing && r && (() => {
                                  // البداية مقفلة (تتبع الخطة أو اللقاء السابق) — يُعدَّل طرف النهاية فقط
                                  const toAnchored = anchorIsTo(s, p.key);
                                  const fixed = toAnchored ? r.to : r.from;
                                  const mov = toAnchored ? r.from : r.to;
                                  const edge: "from" | "to" = toAnchored ? "from" : "to";
                                  return (
                                  <div className="mt-1 grid grid-cols-[1fr_auto_auto] items-center gap-1.5 rounded-lg bg-cream/60 px-2 py-1.5 text-sm">
                                    <span className="font-bold text-plum-700">
                                      {`من ${surahName(fixed.surah)} ${ar(fixed.ayah)} — إلى:`}
                                    </span>
                                    <select
                                      className={`${inputCls} py-1 text-sm`}
                                      value={surahName(mov.surah)}
                                      onChange={(e) =>
                                        setEdge(s, p.key, st, edge, {
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
                                      className={`${inputCls} py-1 text-sm`}
                                      value={mov.ayah}
                                      onChange={(e) =>
                                        setEdge(s, p.key, st, edge, { surah: mov.surah, ayah: Number(e.target.value) })
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
                : `حفظ ${filter === "all" ? "الجميع" : "المعروضات"} — لقاء ${sessionNo ? ar(sessionNo) : ""} لـ ${ar(visible.reduce((n, g) => n + g.list.length, 0))} طالبة`}
            </PrimaryBtn>
            <p className="mt-1.5 text-center text-[10px] text-silver-600">
              «اعتماد*» بعلامة النجمة = صفّ فيه تعديل لم يُحفظ بعد · الأخضر «تم الاعتماد» = محفوظ
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
