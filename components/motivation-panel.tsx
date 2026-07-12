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
import { useApp, type Halaqa, type Student } from "@/lib/store";

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
        لم تبدأ الطالبة تسجيل التسميع بعد
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
          صفحة {ar(p.currentPage)} من {ar(604)} · المصحف {ar(p.mushafPct)}٪
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
    <div className="card mb-2.5 overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between bg-gradient-to-l from-plum-500 to-plum-700 px-4 py-2.5">
        <span className="font-kufi text-sm font-bold text-white">
          🏁 سباق خطة الفصل
        </span>
        <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-sm font-bold text-white">
          {tp.pct.toLocaleString("ar-EG")}٪
        </span>
      </div>
      <div className="p-4">
        {/* مسار السباق */}
        <div className="relative h-3.5 overflow-hidden rounded-full bg-cream-dark">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${tp.pct}%`,
              background: "linear-gradient(90deg,#5d3f4e,#a8894f)",
            }}
          />
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
  const { recitations } = useApp();
  const p = computeProgress(student, recitations, halaqa);

  if (!p.hasData) {
    return (
      <div className="card mb-4 rounded-2xl p-5 text-center">
        <p className="text-2xl">🌱</p>
        <p className="mt-1 font-kufi text-sm font-bold text-plum-800">
          ابدئي بتسجيل تسميعكِ
        </p>
        <p className="mt-1 text-xs text-silver-600">
          فور أول تسجيل تظهر لكِ رحلتكِ وتقدّمكِ 🧭
        </p>
      </div>
    );
  }

  const badges = badgesFor(p);
  const jl = juzLabel(p.juz);

  return (
    <div className="mb-4">
      <div className="ribbon mx-auto mb-3 w-fit rounded-xl px-8 py-2">
        <span className="font-kufi text-base font-semibold text-white">
          🧭 رحلتي مع القرآن
        </span>
      </div>

      {/* تشجيع بارز: على وشك ختم الجزء */}
      {p.nearJuzEnd && (
        <div
          className="mb-2.5 rounded-2xl p-4 text-center text-white shadow"
          style={{ background: "linear-gradient(135deg,#5d3f4e,#a8894f)" }}
        >
          <p className="text-2xl">🎯</p>
          <p className="mt-1 font-kufi text-base font-bold">
            على وشك ختم {jl}!
          </p>
          <p className="mt-1 text-sm">
            باقي {facesPlain(p.pagesToJuzEnd)} فقط
            {p.sessionsToJuzEnd <= 1
              ? " — أنجزيها في اللقاء القادم واختمي الجزء! 🎉"
              : ` — بينكِ وبين الختم ${meetingsLabel(p.sessionsToJuzEnd)}`}
          </p>
        </div>
      )}

      {/* درب الحفظ — خريطة الرحلة المتحركة عبر الأجزاء */}
      <JourneyMap juz={p.juz} juzPct={p.juzPct} />

      {/* تقدّم الجزء */}
      <div className="card mb-2.5 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <span className="font-kufi text-sm font-bold text-plum-800">
            📖 {jl}
          </span>
          <span className="text-sm font-bold text-plum-700">
            {ar(p.juzPct)}٪
          </span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-cream-dark">
          <div
            className="h-full rounded-full bg-plum-600"
            style={{ width: `${p.juzPct}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] font-bold text-silver-600">
          وصلتِ صفحة {ar(p.currentPage)} من {ar(604)} · المصحف {ar(p.mushafPct)}٪
        </p>
      </div>

      {/* مقارنة بالخطة + عدّادات الإنهاء */}
      <div className="card mb-2.5 grid gap-2 rounded-2xl p-4">
        {p.expectedPage > 0 && (
          <div
            className={`rounded-xl px-3 py-2.5 text-sm font-bold ${
              p.aheadPages >= 0
                ? "bg-emerald-50 text-emerald-700"
                : "bg-plum-50 text-plum-700"
            }`}
          >
            {p.aheadPages > 0
              ? `🌟 حفظكِ متقدّم ${byFaces(p.aheadPages)} عن الخطة — أحسنتِ!`
              : p.aheadPages === 0
                ? "✅ حفظكِ على الخطة تماماً — واصلي!"
                : `💪 حفظكِ متأخّر ${byFaces(-p.aheadPages)} — أضيفي ${facesAcc(-p.aheadPages)} لتعودي للمقدّمة`}
          </div>
        )}

        {/* المراجعة مقابل خطتها — الزيادة التراكمية تبقى مرئية دائماً */}
        {p.hasMurPlan && (
          <div
            className={`rounded-xl px-3 py-2.5 text-sm font-bold ${
              p.aheadMurPages >= 0
                ? "bg-emerald-50 text-emerald-700"
                : "bg-plum-50 text-plum-700"
            }`}
          >
            {p.aheadMurPages > 0
              ? `🌟 مراجعتكِ متقدّمة ${byFaces(p.aheadMurPages)} عن الخطة — أحسنتِ!`
              : p.aheadMurPages === 0
                ? "✅ مراجعتكِ على الخطة تماماً — واصلي!"
                : `💪 مراجعتكِ متأخّرة ${byFaces(-p.aheadMurPages)} — عوّضيها في اللقاءات القادمة`}
          </div>
        )}

        {p.pagesToJuzEnd === 0 ? (
          <div className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-700">
            🎉 أتممتِ {jl}! انطلقي للجزء التالي بإذن الله
          </div>
        ) : !p.nearJuzEnd ? (
          <div className="rounded-xl bg-plum-600 px-3 py-2.5 text-sm font-bold text-white">
            📖 باقي {facesPlain(p.pagesToJuzEnd)} لإتمام {jl} — يكفيكِ{" "}
            {meetingsLabel(p.sessionsToJuzEnd)}!
          </div>
        ) : null}

        {p.termSessionsLeft > 0 && (
          <div className="rounded-xl bg-cream px-3 py-2.5 text-sm font-bold text-plum-700">
            🏁 باقي {meetingsLabel(p.termSessionsLeft)} على نهاية الفصل
          </div>
        )}
      </div>

      {/* سباق خطة الفصل — إتمام الخطة كاملة قبل نهاية الفصل */}
      {p.termPlan && <TermRaceCard tp={p.termPlan} />}

      {/* محفّز «لو زدتِ» */}
      {p.pagesToJuzEnd > 0 && p.sessionsToJuzEndBoost < p.sessionsToJuzEnd && (
        <div className="card mb-2.5 rounded-2xl p-4">
          <p className="font-kufi text-sm font-bold text-plum-800">
            ✨ لو زدتِ وجهين كل لقاء
          </p>
          <p className="mt-1 text-xs text-silver-600">
            تختمين {jl} في {meetingsLabel(p.sessionsToJuzEndBoost)} بدل{" "}
            {meetingsLabel(p.sessionsToJuzEnd)}
            {p.termSessionsLeft > 0 &&
            p.sessionsToJuzEndBoost <= p.termSessionsLeft &&
            p.sessionsToJuzEnd > p.termSessionsLeft
              ? " — أي تختمينه قبل نهاية الفصل بإذن الله! 🎉"
              : ` — أبكر ${byMeetings(
                  p.sessionsToJuzEnd - p.sessionsToJuzEndBoost
                )} بإذن الله! 🎉`}
          </p>
        </div>
      )}

      {/* تنافس مع النفس */}
      <div className="card rounded-2xl p-4">
        <p className="mb-2 font-kufi text-sm font-bold text-plum-800">
          🏆 تنافسي مع نفسكِ
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-plum-50 px-3 py-1 text-xs font-bold text-plum-700">
            🔥 سلسلتكِ: {meetingsLabel(p.streak)}
          </span>
          <span className="rounded-full bg-plum-50 px-3 py-1 text-xs font-bold text-plum-700">
            🏅 أفضل إنجازكِ: {facesLabel(p.personalBest)}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {badges.map((b) => (
            <div
              key={b.key}
              className={`rounded-xl py-2 text-center ${
                b.unlocked ? "bg-plum-50" : "bg-cream opacity-45"
              }`}
            >
              <p className="text-xl">{b.unlocked ? b.icon : "🔒"}</p>
              <p className="mt-0.5 text-[10px] font-bold text-plum-700">
                {b.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
