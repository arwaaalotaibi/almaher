"use client";

import type { TajweedQuestion } from "@/lib/store";
import { inputCls } from "./ui";

const ar = (n: number) => n.toLocaleString("ar-EG");

/** سؤال قيد التحرير: ٤ خانات خيارات (الفارغة تُهمل عند الحفظ) */
export type QForm = {
  q: string;
  options: [string, string, string, string];
  answer: number;
};
export const EMPTY_Q: QForm = { q: "", options: ["", "", "", ""], answer: 0 };

export function questionsToForm(qs: TajweedQuestion[]): QForm[] {
  return qs.map((x) => ({
    q: x.q,
    options: [
      x.options[0] ?? "",
      x.options[1] ?? "",
      x.options[2] ?? "",
      x.options[3] ?? "",
    ],
    answer: x.answer,
  }));
}

/** تحويل النماذج إلى أسئلة صالحة — أو رسالة خطأ واضحة */
export function formToQuestions(
  forms: QForm[]
): { questions: TajweedQuestion[] } | { error: string } {
  const questions: TajweedQuestion[] = [];
  for (const f of forms) {
    if (!f.q.trim()) continue;
    const options = f.options.map((o) => o.trim()).filter(Boolean);
    if (options.length < 2)
      return { error: `السؤال «${f.q.slice(0, 30)}…» يحتاج خيارين على الأقل` };
    const chosen = f.options[f.answer]?.trim();
    const answer = chosen ? options.indexOf(chosen) : -1;
    if (answer < 0)
      return { error: `حدّدي الإجابة الصحيحة للسؤال «${f.q.slice(0, 30)}…»` };
    questions.push({ q: f.q.trim(), options, answer });
  }
  return { questions };
}

/** باني أسئلة اختيار من متعدد — للتجويد وأقسام القراءة */
export function QuestionsBuilder({
  value,
  onChange,
}: {
  value: QForm[];
  onChange: (v: QForm[]) => void;
}) {
  const setQ = (i: number, patch: Partial<QForm>) =>
    onChange(value.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  return (
    <div>
      {value.map((f, i) => (
        <div key={i} className="mb-3 rounded-xl bg-cream/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-plum-700">
              سؤال {ar(i + 1)}
            </span>
            <button
              type="button"
              onClick={() => onChange(value.filter((_, k) => k !== i))}
              className="text-xs font-bold text-red-600"
            >
              ✕ حذف السؤال
            </button>
          </div>
          <input
            className={`${inputCls} mb-2`}
            value={f.q}
            onChange={(e) => setQ(i, { q: e.target.value })}
            placeholder="نص السؤال…"
          />
          <div className="grid gap-1.5">
            {f.options.map((o, k) => (
              <div key={k} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQ(i, { answer: k })}
                  aria-label="الإجابة الصحيحة"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                    f.answer === k
                      ? "border-emerald-600 bg-emerald-500 text-white"
                      : "border-silver-400 text-transparent"
                  }`}
                >
                  ✓
                </button>
                <input
                  className={`${inputCls} !mb-0`}
                  value={o}
                  onChange={(e) => {
                    const options = [...f.options] as QForm["options"];
                    options[k] = e.target.value;
                    setQ(i, { options });
                  }}
                  placeholder={`خيار ${ar(k + 1)}${k >= 2 ? " (اختياري)" : ""}`}
                />
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-silver-600">
            المسي الدائرة بجانب الخيار الصحيح ✓
          </p>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, { ...EMPTY_Q }])}
        className="w-full rounded-xl bg-plum-100 py-2 text-sm font-bold text-plum-700"
      >
        + إضافة سؤال
      </button>
    </div>
  );
}
