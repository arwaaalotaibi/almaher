"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { computeRace, POINTS_RULES, sinceDays } from "@/lib/points";
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
    السباق على مستوى المسجد: fixedMosque يقفل النطاق على مسجد الطالبة */
export function RaceBoard({
  myId,
  fixedMosque,
}: {
  myId?: string | null;
  fixedMosque?: string;
}) {
  const { students, halaqas, recitations, readingProgress, tajweedResults } =
    useApp();
  const [mosqueState, setMosqueState] = useState(""); // "" = كل المساجد
  const mosque = fixedMosque ?? mosqueState;
  const [period, setPeriod] = useState<PeriodKey>("week");
  const [rulesOpen, setRulesOpen] = useState(false);

  const mosques = useMemo(
    () => [...new Set(halaqas.map((h) => h.mosque))],
    [halaqas]
  );

  const entries = useMemo(() => {
    const p = PERIODS.find((x) => x.key === period)!;
    return computeRace(
      students,
      halaqas,
      recitations,
      readingProgress,
      tajweedResults,
      {
        mosque: mosque || undefined,
        sinceISO: p.days ? sinceDays(p.days) : undefined,
      }
    );
  }, [students, halaqas, recitations, readingProgress, tajweedResults, mosque, period]);

  const active = entries.filter((e) => e.points > 0);
  const podium = active.slice(0, 3);
  const rest = active.slice(3, 10);
  const me = myId ? entries.find((e) => e.studentId === myId) : undefined;

  return (
    <div>
      {/* النطاق: السباق على مستوى المسجد — الطالبة مقفولة على مسجدها */}
      {fixedMosque ? (
        <p className="mb-2 rounded-xl bg-plum-50 px-3 py-2 text-center text-sm font-bold text-plum-800">
          🕌 سباق طالبات {fixedMosque}
        </p>
      ) : (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {["", ...mosques].map((m) => (
            <button
              key={m || "all"}
              type="button"
              onClick={() => setMosqueState(m)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                mosque === m
                  ? "bg-plum-600 text-white"
                  : "bg-cream text-silver-600"
              }`}
            >
              {m || "🕌 كل المساجد"}
            </button>
          ))}
        </div>
      )}

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

      {active.length === 0 ? (
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
                            ? "#e5e0d5"
                            : "#e8d5c4",
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
