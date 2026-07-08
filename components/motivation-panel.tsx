"use client";

import { badgesFor, computeProgress, juzLabel } from "@/lib/progress";
import { useApp, type Halaqa, type Student } from "@/lib/store";

const ar = (n: number) => n.toLocaleString("ar-EG");

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
              ? `🌟 متقدّمة بـ${ar(p.aheadPages)} صفحة عن خطتكِ — أحسنتِ!`
              : p.aheadPages === 0
                ? "✅ أنتِ تماماً على خطتكِ — واصلي!"
                : `💪 متأخّرة بـ${ar(-p.aheadPages)} صفحة — ${ar(-p.aheadPages)} أوجه إضافية تعيدكِ للمقدّمة`}
          </div>
        )}

        {p.pagesToJuzEnd > 0 ? (
          <div className="rounded-xl bg-plum-600 px-3 py-2.5 text-sm font-bold text-white">
            📖 باقي {ar(p.pagesToJuzEnd)} أوجه لإتمام {jl} — أنجزيها في{" "}
            {ar(p.sessionsToJuzEnd)} لقاء!
          </div>
        ) : (
          <div className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-700">
            🎉 أتممتِ {jl}! انطلقي للجزء التالي بإذن الله
          </div>
        )}

        {p.termSessionsLeft > 0 && (
          <div className="rounded-xl bg-cream px-3 py-2.5 text-sm font-bold text-plum-700">
            🏁 باقي {ar(p.termSessionsLeft)} حصص لإنهاء الفصل
          </div>
        )}
      </div>

      {/* محفّز «لو زدتِ» */}
      {p.pagesToJuzEnd > 0 && p.sessionsToJuzEndBoost < p.sessionsToJuzEnd && (
        <div className="card mb-2.5 rounded-2xl p-4">
          <p className="font-kufi text-sm font-bold text-plum-800">
            ✨ لو زدتِ وجهين كل لقاء
          </p>
          <p className="mt-1 text-xs text-silver-600">
            تصير {ar(p.boostFaces)} أوجه، فتُنهين {jl} في{" "}
            {ar(p.sessionsToJuzEndBoost)} لقاء بدل {ar(p.sessionsToJuzEnd)} —
            أسرع!
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
            🔥 سلسلة: {ar(p.streak)} لقاء
          </span>
          <span className="rounded-full bg-plum-50 px-3 py-1 text-xs font-bold text-plum-700">
            🏅 أفضل إنجاز: {ar(p.personalBest)} أوجه
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
