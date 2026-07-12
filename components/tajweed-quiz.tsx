"use client";

import { useState } from "react";
import { actions, useApp, type TajweedLesson } from "@/lib/store";

const ar = (n: number) => n.toLocaleString("ar-EG");

/** أسئلة درس التجويد: تختار الطالبة ثم تتحقق، وتُحفظ نتيجتها */
export function TajweedQuiz({
  lesson,
  studentId,
}: {
  lesson: TajweedLesson;
  studentId: string | null;
}) {
  const { tajweedResults } = useApp();
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState(false);

  if (lesson.questions.length === 0) return null;

  const prev = studentId
    ? tajweedResults.find(
        (r) => r.lessonId === lesson.id && r.studentId === studentId
      )
    : undefined;

  const total = lesson.questions.length;
  const answeredAll = lesson.questions.every((_, i) => picked[i] !== undefined);
  const score = lesson.questions.reduce(
    (n, q, i) => n + (picked[i] === q.answer ? 1 : 0),
    0
  );

  const check = () => {
    if (!answeredAll) {
      window.alert("أجيبي على كل الأسئلة أولاً");
      return;
    }
    setChecked(true);
    if (studentId) actions.saveTajweedResult(lesson.id, studentId, score, total);
  };

  const retry = () => {
    setPicked({});
    setChecked(false);
  };

  return (
    <div className="card rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-kufi text-base font-bold text-plum-800">
          📝 أسئلة الدرس
        </p>
        {prev && !checked && (
          <span className="rounded-full bg-plum-100 px-2.5 py-0.5 text-[11px] font-bold text-plum-700">
            نتيجتك السابقة: {ar(prev.score)}/{ar(prev.total)}
          </span>
        )}
      </div>

      <div className="grid gap-3">
        {lesson.questions.map((q, i) => {
          const sel = picked[i];
          return (
            <div key={i} className="rounded-2xl border border-cream-dark p-3">
              <p className="mb-2 text-sm font-bold text-ink">
                {ar(i + 1)}. {q.q}
              </p>
              <div className="grid gap-1.5">
                {q.options.map((o, k) => {
                  const isSel = sel === k;
                  const isRight = checked && k === q.answer;
                  const isWrong = checked && isSel && k !== q.answer;
                  return (
                    <button
                      key={k}
                      type="button"
                      disabled={checked}
                      onClick={() => setPicked((p) => ({ ...p, [i]: k }))}
                      className={`rounded-xl border-2 px-3 py-2 text-start text-sm font-bold transition ${
                        isRight
                          ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                          : isWrong
                            ? "border-red-500 bg-red-50 text-red-700"
                            : isSel
                              ? "border-plum-600 bg-plum-50 text-plum-800"
                              : "border-cream-dark text-silver-600"
                      }`}
                    >
                      {o}
                      {isRight && " ✓"}
                      {isWrong && " ✗"}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {checked ? (
        <div className="mt-3 text-center">
          <p
            className={`rounded-2xl px-4 py-3 font-kufi text-base font-bold ${
              score === total
                ? "bg-emerald-50 text-emerald-700"
                : "bg-plum-50 text-plum-800"
            }`}
          >
            {score === total
              ? `🌟 ممتازة! ${ar(score)}/${ar(total)} — أتقنتِ الدرس`
              : `نتيجتك: ${ar(score)}/${ar(total)} — راجعي الإجابات بالأخضر`}
          </p>
          <button
            type="button"
            onClick={retry}
            className="mt-2 text-sm font-bold text-plum-700 underline"
          >
            🔄 إعادة المحاولة
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={check}
          className={`mt-3 w-full rounded-xl bg-plum-600 py-2.5 font-kufi text-sm font-bold text-white transition active:scale-[0.98] ${
            answeredAll ? "" : "opacity-40"
          }`}
        >
          تحقّقي من إجاباتي
        </button>
      )}
    </div>
  );
}
