"use client";

import { use } from "react";
import { STUDENT_PICK_KEY, useApp } from "@/lib/store";
import { PageHeader, useHydrated } from "@/components/ui";
import { PdfReader } from "@/components/pdf-reader";
import { useRole } from "@/components/auth-gate";

export default function BookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const hydrated = useHydrated();
  const role = useRole();
  const { books } = useApp();

  if (!hydrated) return <main className="mx-auto max-w-3xl px-4 pt-10" />;

  const book = books.find((b) => b.id === id);
  const backHref = role === "admin" ? "/books" : "/";

  if (!book) {
    return (
      <main className="mx-auto max-w-3xl px-4 pt-10">
        <PageHeader title="الكتاب غير موجود" back={backHref} />
      </main>
    );
  }

  const studentId =
    role === "student" ? window.localStorage.getItem(STUDENT_PICK_KEY) : null;

  return (
    <main className="mx-auto max-w-3xl">
      <PdfReader
        url={book.url}
        bookId={book.id}
        studentId={studentId}
        title={book.title}
        backHref={backHref}
      />
    </main>
  );
}
