import { facesPlain } from "@/lib/arabic";
import type { Progress } from "@/lib/progress";

const ar = (n: number) => n.toLocaleString("ar-EG", { maximumFractionDigits: 2 });
const q = (n: number) => Math.round(n * 4) / 4;

/** 🎯 إنجاز خطة الفصل: كم أُنجز من الخطة كاملة (حفظاً ومراجعة)، ونسبته، وكم بقي لإتمامها.
    voice: "student" تخاطب الطالبة («أنجزتِ»)، و"staff" للمعلّمة والإدارة («أنجزت»). */
export function TermPlanCard({ tp, voice = "student", className = "card" }: { tp: NonNullable<Progress["termPlan"]>; voice?: "student" | "staff"; className?: string }) {
  const me = voice === "student";
  const parts = [
    { i: "📖", l: "الحفظ", as: "حفظاً", total: tp.totalHifz, rem: tp.remHifz },
    { i: "🔁", l: "المراجعة", as: "مراجعةً", total: tp.totalMur, rem: tp.remMur },
  ].filter((x) => x.total > 0);
  const done = tp.status === "done";
  const left = parts
    .filter((x) => x.rem > 0)
    .map((x) => `${facesPlain(q(x.rem))} ${x.as}`)
    .join(" و");
  return (
    <div className={`${className} mb-3 rounded-2xl p-4`}>
      <div className="mb-1 flex items-center justify-between text-sm font-bold">
        <span className="text-plum-800">🎯 إنجاز خطة الفصل</span>
        <span className={done ? "text-emerald-700" : "text-plum-700"}>{ar(tp.pct)}٪</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-cream-dark">
        <div className={`h-full rounded-full ${done ? "bg-emerald-600" : "bg-plum-600"}`} style={{ width: `${Math.min(100, tp.pct)}%` }} />
      </div>
      <div className="mt-3 grid gap-2">
        {parts.map((x) => (
          <div key={x.l} className="flex items-center justify-between gap-2 rounded-xl bg-plum-50 px-3 py-2">
            <span className="text-xs font-bold text-plum-800">
              {x.i} {x.l}: {me ? "أنجزتِ" : "أنجزت"} {ar(q(x.total - x.rem))} من {ar(q(x.total))} وجهاً
            </span>
            <span className={`shrink-0 text-xs font-bold ${x.rem > 0 ? "text-plum-700" : "text-emerald-700"}`}>
              {x.rem > 0 ? `باقي ${facesPlain(q(x.rem))}` : "اكتمل ✓"}
            </span>
          </div>
        ))}
      </div>
      <p className={`mt-3 rounded-xl px-3 py-2 text-center text-xs font-bold ${done ? "bg-emerald-50 text-emerald-700" : "bg-cream text-plum-700"}`}>
        {done
          ? me
            ? "🎉 أتممتِ خطة الفصل كاملة — ما شاء الله تبارك الله"
            : "🎉 أتمّت خطة الفصل كاملة"
          : me
            ? `باقي لكِ ${left} وتُتمّين خطة الفصل 🌟`
            : `باقي لها ${left} لإتمام خطة الفصل`}
      </p>
    </div>
  );
}
