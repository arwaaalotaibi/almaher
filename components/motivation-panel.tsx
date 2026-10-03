"use client";

import { badgesFor, computeProgress, juzLabel } from "@/lib/progress";
import { JourneyMap } from "./journey-map";
import {
  byFaces,
  byMeetings,
  facesAcc,
  facesLabel,
  facesPlain,
  meetingsLabel,
} from "@/lib/arabic";
import {
  buildSchedule,
  termMilestones,
  useApp,
  type Halaqa,
  type Student,
} from "@/lib/store";
import { TermTrack } from "./term-track";
import { Mascot } from "./surah-ladder";

const ar = (n: number) => n.toLocaleString("ar-EG");

/** ملخّص تقدّم مصغّر للإدارة/المعلّمة داخل بيانات الطالبة */
export function ProgressSummary({
  student,
  halaqa,
}: {
  student: Student;
  halaqa?: Halaqa;
}) {
  const { recitations } = useApp();
  const p = computeProgress(student, recitations, halaqa);

  if (!p.hasData) {
    return (
      <p className="rounded-xl bg-cream/60 px-3 py-3 text-center text-xs text-silver-600">
        لم يُسجَّل لها تسميع بعد
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      <div className="rounded-xl bg-plum-50 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-plum-800">
            📖 {juzLabel(p.juz)}
          </span>
          <span className="text-sm font-bold text-plum-700">
            {ar(p.juzPct)}٪
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white">
          <div
            className="h-full rounded-full bg-plum-600"
            style={{ width: `${p.juzPct}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] font-bold text-silver-600">
          {p.desc
            ? `⬇️ من الناس نزولاً · قطعت ${ar(p.pagesReached)} من ${ar(604)} صفحة`
            : `صفحة ${ar(p.currentPage)} من ${ar(604)}`}{" "}
          · المصحف {ar(p.mushafPct)}٪
        </p>
      </div>

      {p.expectedPage > 0 && (
        <div
          className={`rounded-xl px-3 py-2 text-xs font-bold ${
            p.aheadPages >= 0
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700"
          }`}
        >
          {p.aheadPages > 0
            ? `🌟 الحفظ متقدّم ${byFaces(p.aheadPages)} عن الخطة`
            : p.aheadPages === 0
              ? "✅ الحفظ على الخطة تماماً"
              : `⏳ الحفظ متأخّر ${byFaces(-p.aheadPages)}`}
        </div>
      )}

      {p.hasMurPlan && (
        <div
          className={`rounded-xl px-3 py-2 text-xs font-bold ${
            p.aheadMurPages >= 0
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700"
          }`}
        >
          {p.aheadMurPages > 0
            ? `🌟 المراجعة متقدّمة ${byFaces(p.aheadMurPages)} عن الخطة`
            : p.aheadMurPages === 0
              ? "✅ المراجعة على الخطة تماماً"
              : `⏳ المراجعة متأخّرة ${byFaces(-p.aheadMurPages)}`}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { l: "🔥 سلسلة", v: meetingsLabel(p.streak) },
          { l: "🏅 أفضل", v: facesLabel(p.personalBest) },
          { l: "🎖️ أجزاء", v: ar(p.completedJuz) },
        ].map((x) => (
          <div key={x.l} className="rounded-xl bg-cream px-1 py-2">
            <p className="text-[11px] font-bold text-plum-800">{x.v}</p>
            <p className="text-[10px] text-silver-600">{x.l}</p>
          </div>
        ))}
      </div>

      <p
        className={`rounded-xl px-3 py-2 text-[11px] font-bold ${
          p.nearJuzEnd ? "bg-plum-100 text-plum-800" : "bg-cream/60 text-plum-700"
        }`}
      >
        {p.pagesToJuzEnd === 0
          ? `🎉 أتمّت ${juzLabel(p.juz)}`
          : p.nearJuzEnd
            ? `🎯 على وشك ختم ${juzLabel(p.juz)} — باقي ${facesPlain(
                p.pagesToJuzEnd
              )} فقط!`
            : `📖 باقي ${facesPlain(p.pagesToJuzEnd)} لإتمام ${juzLabel(p.juz)}`}
        {p.termSessionsLeft > 0
          ? ` · 🏁 ${meetingsLabel(p.termSessionsLeft)} على نهاية الفصل`
          : ""}
        {p.termPlan
          ? ` · 🎯 أُنجز ${p.termPlan.pct.toLocaleString("ar-EG")}٪ من خطة الفصل`
          : ""}
      </p>
    </div>
  );
}

/** بطاقة «سباق خطة الفصل»: نسبة إنجاز الخطة كاملة + وصفة كل لقاء متبقٍّ */
function TermRaceCard({
  tp,
}: {
  tp: NonNullable<ReturnType<typeof computeProgress>["termPlan"]>;
}) {
  if (tp.status === "done") {
    return (
      <div
        className="mb-2.5 rounded-2xl p-5 text-center text-white shadow"
        style={{ background: "linear-gradient(135deg,#8a6d3b,#b7973f)" }}
      >
        <p className="text-3xl">🏆</p>
        <p className="mt-1 font-kufi text-lg font-bold">
          أتممتِ خطة الفصل كاملة!
        </p>
        <p className="mt-1 text-sm text-white/90">
          ما شاء الله تبارك الله — حفظاً ومراجعةً، أنجزتِها كلها 🌟
        </p>
      </div>
    );
  }

  const recipe: string[] = [];
  if (tp.remHifz > 0) recipe.push(`${facesPlain(tp.needHifz)} حفظاً`);
  if (tp.remMur > 0) recipe.push(`${facesPlain(tp.needMur)} مراجعةً`);

  return (
    <div className="card mb-3 overflow-hidden rounded-3xl">
      <div className="flex items-center justify-between px-4 pt-3.5">
        <span className="font-kufi text-sm font-bold text-plum-800">🏁 سباق خطة الفصل</span>
        <span className="rounded-full bg-gradient-to-l from-amber-400 to-pink-400 px-3 py-0.5 text-sm font-bold text-white shadow-sm">
          {tp.pct.toLocaleString("ar-EG")}٪
        </span>
      </div>
      <div className="px-4 pb-4 pt-2">
        {/* مسار السباق: النجمة تتقدّم نحو راية النهاية */}
        <div className="relative h-12">
          <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-cream-dark" />
          <div
            className="rj-grow absolute right-0 top-1/2 h-3 -translate-y-1/2 rounded-full"
            style={{ width: `${Math.max(4, tp.pct)}%`, background: "linear-gradient(270deg,#f3b13a,#d97ba6)" }}
          />
          <span className="absolute left-0 top-1/2 -translate-y-1/2 text-xl" aria-hidden>
            🏁
          </span>
          <span
            className="absolute top-1/2 -translate-y-1/2 translate-x-1/2"
            style={{ right: `${Math.min(92, Math.max(4, tp.pct))}%` }}
            aria-hidden
          >
            <span className="sl-bob inline-block">
              <Mascot size={34} />
            </span>
          </span>
        </div>

        {/* المتبقي */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-plum-50 px-3 py-1 text-xs font-bold text-plum-700">
            📖 حفظ: {tp.remHifz > 0 ? `باقي ${facesPlain(tp.remHifz)}` : "اكتمل ✓"}
          </span>
          <span className="rounded-full bg-plum-50 px-3 py-1 text-xs font-bold text-plum-700">
            🔁 مراجعة: {tp.remMur > 0 ? `باقي ${facesPlain(tp.remMur)}` : "اكتمل ✓"}
          </span>
        </div>

        {/* وصفة الإتمام */}
        {tp.status === "ended" ? (
          <p className="mt-3 rounded-xl bg-cream px-3 py-2.5 text-sm font-bold text-plum-700">
            🏁 انتهى الفصل — أنجزتِ {tp.pct.toLocaleString("ar-EG")}٪ من الخطة،
            وكل وجه حفظتِه باقٍ لكِ بإذن الله
          </p>
        ) : tp.status === "onTrack" ? (
          <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-700">
            ✅ أنتِ على المسار — واصلي بوتيرتكِ وستُتمّين الخطة كاملة بنهاية
            الفصل 🎉
          </p>
        ) : (
          <div className="mt-3 rounded-xl bg-plum-50 px-3 py-2.5">
            <p className="text-sm font-bold text-plum-800">
              🎯 لإتمام الخطة كاملة: {recipe.join(" و")}{" "}
              {tp.meetingsLeft === 1
                ? "في اللقاء الأخير"
                : tp.meetingsLeft === 2
                  ? "في كلٍّ من اللقاءين الباقيين"
                  : `في كل لقاء من اللقاءات الباقية (${tp.meetingsLeft.toLocaleString("ar-EG")})`}
            </p>
            {tp.extraHifz > 0 && tp.extraHifz <= 3 && (
              <p className="mt-1 text-xs font-bold text-plum-600">
                ✨ بزيادة {facesLabel(tp.extraHifz)} فقط عن وتيرتكِ في الحفظ —
                تُغلقين الخطة وتقفين على منصة التتويج 🏆
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** لوحة «رحلتي مع القرآن» — تقدّم الطالبة وتحفيزها بتنافس مع نفسها */
export function MotivationPanel({
  student,
  halaqa,
}: {
  student: Student;
  halaqa?: Halaqa;
}) {
  const { recitations, settings } = useApp();
  const p = computeProgress(student, recitations, halaqa);

  // مسار الفصل: نقاط اللقاءات + المحطتان الذهبيتان (السرد والاختبار)
  const schedule = halaqa ? buildSchedule(halaqa, student.plan) : null;
  const passed = schedule ? schedule.length - p.termSessionsLeft : 0;
  const track = (
    <TermTrack
      schedule={schedule}
      passed={passed}
      milestones={termMilestones(halaqa)}
    />
  );

  if (!p.hasData) {
    return (
      <div className="card mb-4 overflow-hidden rounded-2xl">
        <div className="p-5 text-center">
          <p className="text-2xl">🌱</p>
          <p className="mt-1 font-kufi text-sm font-bold text-plum-800">
            {settings.studentRecite
              ? "ابدئي بتسجيل تسميعكِ"
              : "لم يُسجَّل لكِ تسميع بعد"}
          </p>
          <p className="mt-1 text-xs text-silver-600">
            {settings.studentRecite
              ? "فور أول تسجيل تظهر لكِ رحلتكِ وتقدّمكِ 🧭"
              : "بعد أول لقاء تُسجّله معلّمتكِ تظهر لكِ رحلتكِ وتقدّمكِ 🧭"}
          </p>
        </div>
        {track}
      </div>
    );
  }

  const jl = juzLabel(p.juz);
  const firstName = student.name.split(" ")[0];
  const stars = recitations.filter((r) => r.studentId === student.id && r.star).length;

  // 🏅 أوسمتي: أوسمة قريبة المنال أولاً ثم الكبرى
  const medals = [
    { key: "start", icon: "🌱", label: "أول لقاء", on: true },
    { key: "s3", icon: "🔥", label: "٣ متتالية", on: p.streak >= 3 },
    { key: "star", icon: "⭐", label: "ماهرة", on: stars >= 1 },
    { key: "s5", icon: "⚡", label: "٥ متتالية", on: p.streak >= 5 },
    ...badgesFor(p).map((b) => ({ key: b.key, icon: b.icon, label: b.label, on: b.unlocked })),
  ];
  const earned = medals.filter((m) => m.on).length;

  // 💬 رسالة اليوم: أهم ما تحتاج سماعه الآن (رسالة واحدة واضحة)
  const msg: { icon: string; title: string; body: string; tone: "gold" | "green" | "plum" } =
    p.pagesToJuzEnd === 0
      ? { icon: "🎉", title: `أتممتِ ${jl}!`, body: "ما شاء الله تبارك الله — انطلقي للجزء التالي بإذن الله", tone: "gold" }
      : p.nearJuzEnd
        ? {
            icon: "🎯",
            title: `على وشك ختم ${jl}!`,
            body: `باقي ${facesPlain(p.pagesToJuzEnd)} فقط${p.sessionsToJuzEnd <= 1 ? " — أنجزيها في اللقاء القادم!" : ` — بينكِ وبين الختم ${meetingsLabel(p.sessionsToJuzEnd)}`}`,
            tone: "gold",
          }
        : p.expectedPage > 0 && p.aheadPages > 0
          ? { icon: "🌟", title: `متقدّمة ${byFaces(p.aheadPages)} عن خطتكِ!`, body: `أحسنتِ يا ${firstName} — باقي ${facesPlain(p.pagesToJuzEnd)} لإتمام ${jl}`, tone: "green" }
          : p.expectedPage > 0 && p.aheadPages < 0
            ? {
                icon: "💪",
                title: `أضيفي ${facesAcc(-p.aheadPages)} وتعودين للمقدّمة`,
                body: p.sessionsToJuzEndBoost < p.sessionsToJuzEnd ? `ولو زدتِ وجهين كل لقاء تختمين ${jl} في ${meetingsLabel(p.sessionsToJuzEndBoost)}` : `باقي ${facesPlain(p.pagesToJuzEnd)} لإتمام ${jl}`,
                tone: "plum",
              }
            : {
                icon: "✅",
                title: "أنتِ على الخطة تماماً — واصلي!",
                body: `باقي ${facesPlain(p.pagesToJuzEnd)} لإتمام ${jl} — يكفيكِ ${meetingsLabel(p.sessionsToJuzEnd)}`,
                tone: "green",
              };
  const toneCls = { gold: "rj-msg-gold", green: "rj-msg-green", plum: "rj-msg-plum" }[msg.tone];

  // حلقة التقدّم
  const R = 46;
  const C = 2 * Math.PI * R;

  return (
    <div className="mb-4">
      {/* ① البطل: حلقة الجزء + أين وصلتِ */}
      <div className="rj-hero relative mb-3 overflow-hidden rounded-3xl p-4">
        <span className="rj-twinkle absolute right-6 top-3 text-xs text-amber-300">✦</span>
        <span className="rj-twinkle absolute bottom-4 left-1/2 text-[10px] text-pink-300" style={{ animationDelay: "1s" }}>✦</span>
        <div className="relative flex items-center gap-4">
          <div className="relative h-[120px] w-[120px] shrink-0">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <defs>
                <linearGradient id="rj-g" x1="0" x2="1">
                  <stop offset="0" stopColor="#f3b13a" />
                  <stop offset="1" stopColor="#d97ba6" />
                </linearGradient>
              </defs>
              <circle cx="60" cy="60" r={R} fill="none" stroke="var(--rj-track, #ffffffb3)" strokeWidth="11" />
              <circle
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke="url(#rj-g)"
                strokeWidth="11"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - p.juzPct / 100)}
                className="rj-ring"
                style={{ ["--rj-c" as string]: `${C}` }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-kufi text-2xl font-bold leading-none text-plum-800">{ar(p.juzPct)}٪</span>
              <span className="mt-1 text-[11px] font-bold text-plum-600">{jl}</span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-kufi text-lg font-bold leading-snug text-plum-800">رحلتكِ مع القرآن يا {firstName} 🌸</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rj-chip rounded-full px-2.5 py-1 text-[11px] font-bold text-plum-700">
                📍 {p.desc ? `قطعتِ ${ar(p.pagesReached)} صفحة` : `صفحة ${ar(p.currentPage)}`} من ٦٠٤
              </span>
              <span className="rj-chip rounded-full px-2.5 py-1 text-[11px] font-bold text-plum-700">📖 المصحف {ar(p.mushafPct)}٪</span>
              {p.termPlan && (
                <span className="rj-chip rounded-full px-2.5 py-1 text-[11px] font-bold text-plum-700">🎯 خطة الفصل {ar(p.termPlan.pct)}٪</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ② رسالة اليوم — النجمة تحدّثها */}
      <div className="mb-3 flex items-end gap-2">
        <span className="sl-bob mb-1 inline-block shrink-0">
          <Mascot size={52} />
        </span>
        <div className={`relative flex-1 rounded-3xl rounded-bl-md border-2 px-4 py-3 ${toneCls}`}>
          <p className="font-kufi text-[15px] font-bold leading-snug text-plum-800">
            {msg.icon} {msg.title}
          </p>
          <p className="mt-1 text-xs font-bold leading-relaxed text-plum-700">{msg.body}</p>
          {(p.hasMurPlan || p.termSessionsLeft > 0) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {p.hasMurPlan && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    p.aheadMurPages >= 0 ? "rj-chip text-emerald-600" : "rj-chip text-plum-700"
                  }`}
                >
                  🔁 المراجعة:{" "}
                  {p.aheadMurPages > 0 ? `متقدّمة ${byFaces(p.aheadMurPages)}` : p.aheadMurPages === 0 ? "على الخطة ✓" : `متأخّرة ${byFaces(-p.aheadMurPages)}`}
                </span>
              )}
              {p.termSessionsLeft > 0 && (
                <span className="rj-chip rounded-full px-2.5 py-0.5 text-[11px] font-bold text-plum-700">
                  🏁 باقي {meetingsLabel(p.termSessionsLeft)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ③ سُلّم حفظي / الدرب / البستان */}
      <JourneyMap
        juz={p.juz}
        juzPct={p.juzPct}
        goalJuz={p.termGoalJuz}
        studentId={student.id}
        reverse={p.desc}
        hifzFrom={p.nextHifzFrom}
        goalSurah={p.termGoalSurah}
      >
        {track}
      </JourneyMap>

      {/* ④ سباق خطة الفصل */}
      {p.termPlan && <TermRaceCard tp={p.termPlan} />}

      {/* ⑤ أرقامي */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        {[
          { icon: "🔥", v: ar(p.streak), l: "لقاءات متتالية", bg: "rj-tile-1", c: "text-orange-600" },
          { icon: "🏅", v: ar(p.personalBest), l: "أفضل إنجاز (وجه)", bg: "rj-tile-2", c: "text-indigo-500" },
          { icon: "⭐", v: ar(stars), l: "نجوم ماهرة", bg: "rj-tile-3", c: "text-amber-600" },
        ].map((x, i) => (
          <div key={x.l} className={`rj-pop rounded-2xl ${x.bg} px-1 py-3 text-center`} style={{ animationDelay: `${0.1 + i * 0.1}s` }}>
            <p className="text-2xl leading-none">{x.icon}</p>
            <p className={`mt-1.5 font-kufi text-2xl font-bold leading-none ${x.c}`}>{x.v}</p>
            <p className="mt-1 text-[10px] font-bold text-silver-600">{x.l}</p>
          </div>
        ))}
      </div>

      {/* ⑥ أوسمتي */}
      <div className="card rounded-3xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-kufi text-sm font-bold text-plum-800">🏅 أوسمتي</p>
          <span className="rounded-full bg-plum-50 px-2.5 py-0.5 text-[11px] font-bold text-plum-700">
            {ar(earned)} من {ar(medals.length)}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {medals.map((m) => (
            <div key={m.key} className="text-center">
              <div
                className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl ${
                  m.on ? "rj-medal" : "bg-cream grayscale opacity-50"
                }`}
              >
                {m.on ? m.icon : "🔒"}
              </div>
              <p className={`mt-1 text-[10px] font-bold leading-tight ${m.on ? "text-plum-800" : "text-silver-500"}`}>{m.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
