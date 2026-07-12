"use client";

import { use, useEffect, useState } from "react";
import {
  STUDENT_PICK_KEY,
  useApp,
  videoEmbedUrl,
} from "@/lib/store";
import { PageHeader, useHydrated } from "@/components/ui";
import { PdfReader } from "@/components/pdf-reader";
import { TajweedQuiz } from "@/components/tajweed-quiz";

/** صفحة درس التجويد: فيديو مضمَّن مع الأسئلة، أو قارئ PDF */
export default function TajweedLessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { tajweed } = useApp();
  const hydrated = useHydrated();
  const [studentId, setStudentId] = useState<string | null>(null);

  useEffect(() => {
    setStudentId(window.localStorage.getItem(STUDENT_PICK_KEY));
  }, []);

  if (!hydrated) return <main className="mx-auto max-w-2xl px-4 pt-10" />;

  const lesson = tajweed.find((l) => l.id === id);
  if (!lesson) {
    return (
      <main className="mx-auto max-w-2xl px-4 pt-10">
        <PageHeader title="الدرس غير موجود" back="/" />
      </main>
    );
  }

  // ملف PDF — القارئ الكامل (بالكتابة والإشارات المرجعية)
  if (lesson.kind === "pdf") {
    return (
      <PdfReader
        url={lesson.url}
        bookId={`tajweed-${lesson.id}`}
        studentId={studentId}
        title={lesson.title}
        backHref="/"
      />
    );
  }

  // فيديو — تضمين + الأسئلة تحته
  const embed = videoEmbedUrl(lesson.url);
  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-8">
      <PageHeader title={`📿 ${lesson.title}`} back="/" />

      <div className="card overflow-hidden rounded-2xl">
        {embed ? (
          <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
            <iframe
              src={embed}
              title={lesson.title}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          /* ملف فيديو مباشر */
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={lesson.url} controls className="w-full" playsInline />
        )}
      </div>

      {lesson.questions.length > 0 && (
        <div className="mt-4">
          <TajweedQuiz lesson={lesson} studentId={studentId} />
        </div>
      )}
    </main>
  );
}
