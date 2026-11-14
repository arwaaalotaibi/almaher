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
      <div className="flex items-center justify-between text-sm font-bold">
        <span className="text-plum-800">🎯 إنجاز خطة الفصل</span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs ${done ? "bg-emerald-50 text-emerald-700" : "bg-cream text-plum-700"}`}>الإجمالي {ar(tp.pct)}٪</span>
      </div>
      <div className="mt-3 grid gap-2">
        {parts.map((x) => {
          const pct = Math.max(0, Math.min(100, Math.round(((x.total - x.rem) / x.total) * 100)));
          const full = x.rem <= 0;
          return (
            <div key={x.l} className="rounded-xl bg-plum-50 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-kufi text-sm font-bold text-plum-800">
                  {x.i} {x.l}
                </span>
                <span className={`font-kufi text-xl font-bold ${full ? "text-emerald-700" : "text-plum-800"}`}>
                  {ar(pct)}٪ <span className="text-[11px] font-bold text-silver-600">من ١٠٠</span>
                </span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white">
                <div className={`h-full rounded-full ${full ? "bg-emerald-600" : "bg-plum-600"}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] font-bold">
                <span className="text-plum-700">
                  {me ? "أنجزتِ" : "أنجزت"} {ar(q(x.total - x.rem))} من {ar(q(x.total))} وجهاً
                </span>
                <span className={full ? "text-emerald-700" : "text-plum-700"}>{full ? "اكتمل ✓" : `باقي ${facesPlain(q(x.rem))}`}</span>
              </div>
            </div>
          );
        })}
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
