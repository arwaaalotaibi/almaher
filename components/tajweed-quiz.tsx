"use client";

import { actions, useApp, type TajweedLesson } from "@/lib/store";
import { QuizRunner } from "./quiz-runner";

/** أسئلة درس التجويد: تغليف المنفّذ العام بحفظ نتيجة الدرس */
export function TajweedQuiz({
  lesson,
  studentId,
}: {
  lesson: TajweedLesson;
  studentId: string | null;
}) {
  const { tajweedResults } = useApp();

  if (lesson.questions.length === 0) return null;

  const prev = studentId
    ? tajweedResults.find(
        (r) => r.lessonId === lesson.id && r.studentId === studentId
      )
    : undefined;

  return (
    <div className="card rounded-2xl p-4">
      <p className="mb-3 font-kufi text-base font-bold text-plum-800">
        📝 أسئلة الدرس
      </p>
      <QuizRunner
        questions={lesson.questions}
        prev={prev ? { score: prev.score, total: prev.total } : null}
        onSubmit={(score, total) => {
          if (studentId)
            actions.saveTajweedResult(lesson.id, studentId, score, total);
        }}
      />
    </div>
  );
}
