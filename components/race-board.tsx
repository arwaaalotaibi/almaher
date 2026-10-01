"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRole } from "./auth-gate";
import { halaqaTitle, starAllowed, useApp } from "@/lib/store";
import { computeRace, POINTS_RULES, sinceDays, type RaceEntry } from "@/lib/points";
import { facesLabel } from "@/lib/arabic";

const ar = (n: number) => n.toLocaleString("ar-EG");

const PERIODS = [
  { key: "week", label: "هذا الأسبوع", days: 7 },
  { key: "month", label: "هذا الشهر", days: 30 },
  { key: "all", label: "منذ البداية", days: 0 },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

const MEDALS = ["🥇", "🥈", "🥉"];

/** 🏆 لوحة سباق الحلقات — تُعرض في صفحة /race وتبويب «السباق» عند الطالبة.
    السباق على مستويين: حلقة الطالبة (المسجد + اليوم — الافتراضي عندها) أو كل الحلقات */
export function RaceBoard({
  myId,
  defaultHalaqa,
}: {
  myId?: string | null;
  defaultHalaqa?: string; // النطاق الابتدائي (حلقة الطالبة) — ويمكن التبديل لكل الحلقات
}) {
  const { students, halaqas, recitations, readingProgress, tajweedResults } =
    useApp();
  const [scope, setScope] = useState(defaultHalaqa ?? ""); // معرّف الحلقة، "" = كل الحلقات
  const [period, setPeriod] = useState<PeriodKey>("week");
  const [rulesOpen, setRulesOpen] = useState(false);

  const titleOf = (id: string) => {
    const h = halaqas.find((x) => x.id === id);
    return h ? halaqaTitle(h) : "";
  };

  // عند الطالبة: الترتيب من قاعدة البيانات (العشر الأوائل + ترتيبها فقط)
  const role = useRole();
  const remote = role === "student";
  const [remoteEntries, setRemoteEntries] = useState<RaceEntry[] | null>(null);
  useEffect(() => {
    if (!remote) return;
    let alive = true;
    const p = PERIODS.find((x) => x.key === period)!;
    setRemoteEntries(null);
    supabase
      .rpc("almaher_race", {
        p_mosque: null,
        p_halaqa: scope || null,
        p_since: p.days ? sinceDays(p.days) : null,
      })
      .then(({ data }) => {
        if (!alive) return;
        const rows = (data ?? []) as {
          student_id: string; name: string; halaqa_label: string; mosque: string;
          points: number; faces: number; attends: number; rank: number;
        }[];
        setRemoteEntries(
          rows.map((r) => ({
            studentId: r.student_id,
            name: r.name,
            halaqaLabel: r.halaqa_label,
            mosque: r.mosque,
            points: Number(r.points) || 0,
            faces: Number(r.faces) || 0,
            attends: Number(r.attends) || 0,
            rank: Number(r.rank) || 0,
          }))
        );
      });
    return () => {
      alive = false;
    };
  }, [remote, scope, period]);

  const localEntries = useMemo(() => {
    const p = PERIODS.find((x) => x.key === period)!;
    return computeRace(
      students,
      halaqas,
      recitations,
      readingProgress,
      tajweedResults,
      {
        halaqaId: scope || undefined,
        sinceISO: p.days ? sinceDays(p.days) : undefined,
      }
    );
  }, [students, halaqas, recitations, readingProgress, tajweedResults, scope, period]);
  const entries = remote ? (remoteEntries ?? []) : localEntries;
  const loading = remote && remoteEntries === null;

  const active = entries.filter((e) => e.points > 0);
  const podium = active.slice(0, 3);
  const rest = active.slice(3, 10);
  const me = myId ? entries.find((e) => e.studentId === myId) : undefined;

  return (
    <div>
      {/* النطاق: حلقة الطالبة أو كل الحلقات — عند الإدارة كل حلقة على حدة */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {(defaultHalaqa ? [defaultHalaqa, ""] : ["", ...halaqas.map((h) => h.id)]).map((id) => (
          <button
            key={id || "all"}
            type="button"
            onClick={() => setScope(id)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
              scope === id ? "bg-plum-600 text-white" : "bg-cream text-silver-600"
            }`}
          >
            {id ? `🕌 ${defaultHalaqa ? "حلقتي — " : ""}${titleOf(id)}` : "🌍 كل الحلقات"}
          </button>
        ))}
      </div>

      {/* الفترة */}
      <div className="mb-5 flex gap-1 rounded-2xl bg-cream p-1">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriod(p.key)}
            className={`flex-1 rounded-xl py-2 font-kufi text-sm font-bold transition ${
              period === p.key
                ? "bg-white text-plum-800 shadow-sm"
                : "text-silver-600"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm font-bold text-silver-600">جاري تحميل الترتيب…</p>
      ) : active.length === 0 ? (
        <div className="card rounded-2xl p-8 text-center">
          <p className="text-3xl">🏁</p>
          <p className="mt-2 font-kufi font-bold text-plum-800">
            السباق لم يبدأ بعد في هذه الفترة
          </p>
          <p className="mt-1 text-sm text-silver-600">
            كل تسميع أو قراءة أو اختبار يرفع النقاط — كوني الأولى!
          </p>
        </div>
      ) : (
        <>
          {/* منصة التتويج */}
          <div className="mb-4 flex items-end justify-center gap-2">
            {[1, 0, 2].map((pos) => {
              const e = podium[pos];
              if (!e) return <div key={pos} className="w-24" />;
              const h = pos === 0 ? "h-28" : pos === 1 ? "h-24" : "h-20";
              return (
                <div key={pos} className="flex w-24 flex-col items-center">
                  <span className="text-2xl">{MEDALS[pos]}</span>
                  <span className="mt-0.5 w-full truncate text-center font-kufi text-xs font-bold text-plum-800">
                    {e.name.split(" ")[0]}
                  </span>
                  <span className="text-[10px] font-bold text-silver-600">
                    {ar(e.points)} نقطة
                  </span>
                  <div
                    className={`mt-1 flex w-full items-start justify-center rounded-t-xl pt-1.5 ${h} ${
                      pos === 0 ? "text-white" : "text-plum-800"
                    }`}
                    style={{
                      background:
                        pos === 0
                          ? "linear-gradient(135deg,#b7973f,#8a6d3b)"
                          : pos === 1
                            ? "var(--podium-2, #e5e0d5)"
                            : "var(--podium-3, #e8d5c4)",
                    }}
                  >
                    <span className="font-kufi text-lg font-bold">
                      {ar(e.rank)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* بقية العشر الأوائل */}
          {rest.length > 0 && (
            <div className="grid gap-1.5">
              {rest.map((e) => (
                <div
                  key={e.studentId}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                    e.studentId === myId
                      ? "bg-plum-600 text-white"
                      : "card"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      e.studentId === myId
                        ? "bg-white/20 text-white"
                        : "bg-plum-100 text-plum-700"
                    }`}
                  >
                    {ar(e.rank)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate font-kufi text-sm font-bold ${
                        e.studentId === myId ? "text-white" : "text-plum-800"
                      }`}
                    >
                      {e.name}
                    </span>
                    <span
                      className={`block text-[10px] ${
                        e.studentId === myId ? "text-white/80" : "text-silver-600"
                      }`}
                    >
                      🕌 {e.halaqaLabel}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-sm font-bold ${
                      e.studentId === myId ? "text-white" : "text-plum-700"
                    }`}
                  >
                    {ar(e.points)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ترتيبي إن لم أكن ضمن الظاهرين */}
          {me && me.points > 0 && me.rank > 10 && (
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-plum-600 px-3 py-2.5 text-white">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
                {ar(me.rank)}
              </span>
              <span className="min-w-0 flex-1 font-kufi text-sm font-bold">
                {me.name} (أنتِ)
              </span>
              <span className="shrink-0 text-sm font-bold">{ar(me.points)}</span>
            </div>
          )}
          {me && me.points > 0 && me.rank <= 10 && (
            <p className="mt-3 rounded-xl bg-plum-50 px-3 py-2.5 text-center text-sm font-bold text-plum-800">
              ترتيبك: {ar(me.rank)}
              {me.rank === 1
                ? " — الصدارة! حافظي عليها 👑"
                : ` — ${facesLabel(me.faces)} حفظاً هذه الفترة، واصلي 💪`}
            </p>
          )}
        </>
      )}

      {/* كيف تُحسب النقاط */}
      <div className="card mt-5 rounded-2xl p-4">
        <button
          type="button"
          onClick={() => setRulesOpen((v) => !v)}
          className="flex w-full items-center justify-between text-start"
          aria-expanded={rulesOpen}
        >
          <span className="font-kufi text-sm font-bold text-plum-800">
            ❓ كيف تُحسب النقاط؟
          </span>
          <span
            className={`text-plum-600 transition-transform ${rulesOpen ? "rotate-180" : ""}`}
          >
            ▾
          </span>
        </button>
        {rulesOpen && (
          <div className="mt-3 grid gap-1.5">
            {POINTS_RULES.map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between rounded-xl bg-cream px-3 py-2 text-sm font-bold"
              >
                <span className="text-plum-800">
                  {r.icon} {r.label}
                </span>
                <span className="text-plum-700">+{ar(r.pts)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ================== 🌟 لوحة «الماهرات» ==================
   روح غير السباق: لا مراكز ولا ميداليات — كل من نالت نجمة «ماهرة» تظهر مجمّعة بعدد نجومها،
   ومن لم تنل بعد لا تظهر (لا إحراج). النجمة بتقدير المعلّمة ولا تدخل نقاط السباق. */
type StarEntry = { studentId: string; name: string; halaqaLabel: string; stars: number };

const STAR_PERIODS = [
  { key: "month", label: "هذا الشهر", days: 30 },
  { key: "all", label: "منذ البداية", days: 0 },
] as const;

export function StarsBoard({ myId, defaultHalaqa }: { myId?: string | null; defaultHalaqa?: string }) {
  const { students, halaqas, recitations } = useApp();
  const role = useRole();
  const remote = role === "student";
  const [scope, setScope] = useState(defaultHalaqa ?? "");
  const [period, setPeriod] = useState<(typeof STAR_PERIODS)[number]["key"]>("all");
  const [remoteList, setRemoteList] = useState<StarEntry[] | null>(null);
  const since = (() => {
    const p = STAR_PERIODS.find((x) => x.key === period)!;
    return p.days ? sinceDays(p.days) : null;
  })();

  useEffect(() => {
    if (!remote) return;
    let alive = true;
    setRemoteList(null);
    supabase
      .rpc("almaher_stars", { p_halaqa: scope || null, p_since: since })
      .then(({ data }) => {
        if (!alive) return;
        setRemoteList(
          ((data ?? []) as { student_id: string; name: string; halaqa_label: string; stars: number }[]).map((r) => ({
            studentId: r.student_id,
            name: r.name,
            halaqaLabel: r.halaqa_label,
            stars: Number(r.stars) || 0,
          }))
        );
      });
    return () => {
      alive = false;
    };
  }, [remote, scope, since]);

  const localList = useMemo<StarEntry[]>(() => {
    const byId = new Map(students.filter((s) => !s.plan?.withdrawnAt).map((s) => [s.id, s]));
    const count = new Map<string, number>();
    for (const r of recitations) {
      if (!r.star || !r.attended || (since && r.date < since)) continue;
      const s = byId.get(r.studentId);
      if (!s || (scope && s.halaqaId !== scope)) continue;
      if (!starAllowed(halaqas.find((h) => h.id === s.halaqaId), r.date)) continue; // من اللقاء الرابع فقط
      count.set(s.id, (count.get(s.id) ?? 0) + 1);
    }
    return [...count.entries()]
      .map(([id, n]) => {
        const s = byId.get(id)!;
        const h = halaqas.find((x) => x.id === s.halaqaId);
        return { studentId: id, name: s.name, halaqaLabel: h ? halaqaTitle(h) : "", stars: n };
      })
      .sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name, "ar"));
  }, [students, halaqas, recitations, scope, since]);

  const list = remote ? (remoteList ?? []) : localList;
  const loading = remote && remoteList === null;
  const mine = myId ? list.find((e) => e.studentId === myId) : undefined;
  // مجموعات حسب عدد النجوم (الأكثر أولاً) — بلا ترقيم مراكز
  const groups = [...new Set(list.map((e) => e.stars))].map((n) => ({ n, names: list.filter((e) => e.stars === n) }));
  const titleOf = (id: string) => {
    const h = halaqas.find((x) => x.id === id);
    return h ? halaqaTitle(h) : "";
  };

  return (
    <div>
      <div
        className="mb-4 rounded-3xl px-5 py-5 text-center text-white"
        style={{ background: "radial-gradient(ellipse at 50% 0%,#6c4566,#2b1a2c)" }}
      >
        <p className="text-4xl">🌟</p>
        <p className="mt-1 font-kufi text-2xl font-bold text-amber-200">الماهرات</p>
        <p className="mt-1 font-kufi text-sm text-white/85">«الماهر بالقرآن مع السفرة الكرام البررة»</p>
        {myId && !loading && (
          <p className="mt-3 rounded-2xl bg-white/10 px-3 py-2 text-sm font-bold">
            {mine
              ? `نجومكِ: ${"⭐".repeat(Math.min(mine.stars, 10))}${mine.stars > 10 ? ` (${ar(mine.stars)})` : ""} — أنتِ من الماهرات 🌟`
              : "لم تنالي نجمة بعد — أتقني حفظكِ وستلمع نجمتكِ قريباً بإذن الله 🌸"}
          </p>
        )}
      </div>

      <div className="mb-2 flex flex-wrap gap-1.5">
        {(defaultHalaqa ? [defaultHalaqa, ""] : ["", ...halaqas.map((h) => h.id)]).map((id) => (
          <button
            key={id || "all"}
            type="button"
            onClick={() => setScope(id)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
              scope === id ? "bg-plum-600 text-white" : "bg-cream text-silver-600"
            }`}
          >
            {id ? `🕌 ${defaultHalaqa ? "حلقتي — " : ""}${titleOf(id)}` : "🌍 كل الحلقات"}
          </button>
        ))}
      </div>
      <div className="mb-4 flex gap-1 rounded-2xl bg-cream p-1">
        {STAR_PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriod(p.key)}
            className={`flex-1 rounded-xl py-2 font-kufi text-sm font-bold transition ${
              period === p.key ? "bg-white text-plum-800 shadow-sm" : "text-silver-600"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm font-bold text-silver-600">جاري التحميل…</p>
      ) : list.length === 0 ? (
        <div className="card rounded-2xl p-8 text-center">
          <p className="text-3xl">✨</p>
          <p className="mt-2 font-kufi font-bold text-plum-800">لم تُمنح نجوم بعد</p>
          <p className="mt-1 text-sm text-silver-600">
            تمنح المعلّمة نجمة «ماهرة» لمن أتقنت في اللقاء — كوني أولى الماهرات 🌟
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {groups.map((g) => (
            <div key={g.n} className="card rounded-2xl p-3.5">
              <p className="mb-2 font-kufi text-base font-bold text-amber-700">
                {"⭐".repeat(Math.min(g.n, 10))}
                <span className="ms-1 text-sm text-silver-600">
                  {g.n === 1 ? "نجمة" : g.n === 2 ? "نجمتان" : `${ar(g.n)} نجوم`}
                </span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {g.names.map((e) => (
                  <span
                    key={e.studentId}
                    className={`rounded-full px-3 py-1 text-sm font-bold ${
                      e.studentId === myId ? "bg-amber-400 text-white" : "bg-amber-50 text-amber-900"
                    }`}
                    title={e.halaqaLabel}
                  >
                    {e.studentId === myId ? `${e.name} (أنتِ)` : e.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 🏆/🌟 تبويب السباق: السباق بالنقاط، أو لوحة الماهرات */
export function RaceAndStars(props: { myId?: string | null; defaultHalaqa?: string }) {
  const [view, setView] = useState<"race" | "stars">("race");
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-cream p-1">
        {(
          [
            ["race", "🏆 السباق"],
            ["stars", "🌟 الماهرات"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setView(k)}
            className={`rounded-xl py-2.5 font-kufi text-base font-bold transition ${
              view === k ? "bg-plum-600 text-white shadow-sm" : "text-plum-700"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      {view === "race" ? <RaceBoard {...props} /> : <StarsBoard {...props} />}
    </div>
  );
}
