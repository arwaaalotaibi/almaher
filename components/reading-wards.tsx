"use client";

import { useState } from "react";
import {
  actions,
  segDateLabel,
  useApp,
  type Book,
  type ReadingSegment,
} from "@/lib/store";
import { Sheet } from "./ui";
import { QuizRunner } from "./quiz-runner";

const ar = (n: number) => n.toLocaleString("ar-EG");

/** أوراد قراءة الكتاب: «تم ✓» لكل قسم + اختبار القسم بنتيجة محفوظة */
export function ReadingWards({
  book,
  studentId,
}: {
  book: Book;
  studentId: string;
}) {
  const { readingProgress } = useApp();
  const [open, setOpen] = useState(false);
  const [quizSeg, setQuizSeg] = useState<ReadingSegment | null>(null);

  const segs = [...book.readingPlan].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  if (segs.length === 0) return null;

  const progFor = (segId: string) =>
    readingProgress.find(
      (p) =>
        p.bookId === book.id &&
        p.segmentId === segId &&
        p.studentId === studentId
    );

  const doneCount = segs.filter((s) => progFor(s.id)?.done).length;
  let dayNo = 0;

  return (
    <div className="mt-1.5 rounded-xl bg-white ring-1 ring-cream-dark">
      {/* رأس قابل للطي مع تقدّم الأوراد */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-start"
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1">
          <span className="font-kufi text-sm font-bold text-plum-800">
            📅 أورادي — تمّ {ar(doneCount)} من {ar(segs.length)}
          </span>
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-cream-dark">
            <span
              className="block h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${(doneCount / segs.length) * 100}%` }}
            />
          </span>
        </span>
        <span
          className={`text-plum-600 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="grid gap-1.5 px-3 pb-3">
          {segs.map((s) => {
            if (!s.isExam) dayNo++;
            const p = progFor(s.id);
            const done = !!p?.done;
            const hasQuiz = (s.questions?.length ?? 0) > 0;
            return (
              <div
                key={s.id}
                className={`rounded-xl px-3 py-2.5 ${
                  done
                    ? "bg-emerald-50 ring-1 ring-emerald-200"
                    : s.isExam
                      ? "bg-gold/15 ring-1 ring-gold/40"
                      : "bg-cream"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="font-kufi text-sm font-bold text-plum-800">
                      {s.isExam
                        ? "📝 اختبار"
                        : `يوم ${ar(dayNo)} · صفحات ${ar(s.fromPage)}–${ar(s.toPage)}`}
                    </span>
                    <span className="block text-[11px] text-silver-600">
                      {segDateLabel(s.date)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {p?.score !== undefined && p?.total !== undefined && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          p.score === p.total
                            ? "bg-emerald-500 text-white"
                            : "bg-plum-100 text-plum-700"
                        }`}
                      >
                        {p.score === p.total ? "🌟 " : ""}
                        {ar(p.score)}/{ar(p.total)}
                      </span>
                    )}
                    {hasQuiz && (
                      <button
                        type="button"
                        onClick={() => setQuizSeg(s)}
                        className="rounded-full bg-plum-600 px-2.5 py-1 text-[11px] font-bold text-white"
                      >
                        📝 الأسئلة
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        actions.saveReadingProgress(book.id, s.id, studentId, {
                          done: !done,
                        })
                      }
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                        done
                          ? "bg-emerald-500 text-white"
                          : "bg-white text-silver-600 ring-1 ring-cream-dark"
                      }`}
                    >
                      {done ? "تمّ ✓" : "تم؟"}
                    </button>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* اختبار القسم */}
      <Sheet
        open={quizSeg !== null}
        onClose={() => setQuizSeg(null)}
        title={
          quizSeg?.isExam
            ? `📝 اختبار «${book.title}»`
            : `📝 أسئلة صفحات ${ar(quizSeg?.fromPage ?? 0)}–${ar(quizSeg?.toPage ?? 0)}`
        }
      >
        {quizSeg && (
          <QuizRunner
            questions={quizSeg.questions ?? []}
            prev={(() => {
              const p = progFor(quizSeg.id);
              return p?.score !== undefined && p?.total !== undefined
                ? { score: p.score, total: p.total }
                : null;
            })()}
            onSubmit={(score, total) =>
              // حلّ الأسئلة يعني أنها قرأت القسم — تُعلَّم «تم» تلقائياً
              actions.saveReadingProgress(book.id, quizSeg.id, studentId, {
                score,
                total,
                done: true,
              })
            }
          />
        )}
      </Sheet>
    </div>
  );
}
