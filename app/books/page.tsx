"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { actions, convertAndUploadBook, useApp, type Book } from "@/lib/store";
import {
  Field,
  inputCls,
  PageHeader,
  PrimaryBtn,
  useHydrated,
} from "@/components/ui";
import { RoleOnly } from "@/components/admin-only";

const ar = (n: number) => n.toLocaleString("ar-EG");

export default function BooksPage() {
  return (
    <RoleOnly roles={["admin"]}>
      <BooksInner />
    </RoleOnly>
  );
}

function BooksInner() {
  const { books } = useApp();
  const hydrated = useHydrated();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [prog, setProg] = useState<{ done: number; total: number; label: string } | null>(null);

  if (!hydrated) return <main className="mx-auto max-w-2xl px-4 pt-10" />;

  const busy = prog !== null;

  const onFile = async (file: File | undefined) => {
    if (!file || busy) return;
    if (file.type !== "application/pdf") {
      window.alert("الملف يجب أن يكون PDF");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      window.alert("حجم الملف كبير (الحد ٥٠ ميجابايت)");
      return;
    }
    const t = title.trim() || file.name.replace(/\.pdf$/i, "");
    setProg({ done: 0, total: 1, label: "جارٍ قراءة الملف…" });
    const buf = await file.arrayBuffer();
    const err = await convertAndUploadBook(buf, t, {
      onProgress: (done, total) =>
        setProg({ done, total, label: "تجهيز صفحات الكتاب بجودة عالية" }),
    });
    setProg(null);
    if (err) window.alert(`تعذّر رفع الكتاب: ${err}`);
    else {
      setTitle("");
      window.alert("تم رفع الكتاب وتجهيزه بنجاح ✅");
    }
  };

  const reprocess = async (book: Book) => {
    if (busy) return;
    if (
      !window.confirm(
        `تحسين عرض «${book.title}»؟\nسيُحوَّل لصور عالية الدقة ليظهر بخطه الأصلي على كل الأجهزة (يستغرق دقائق حسب حجم الكتاب).`
      )
    )
      return;
    setProg({ done: 0, total: 1, label: "جارٍ تنزيل الكتاب…" });
    try {
      const res = await fetch(book.url);
      const buf = await res.arrayBuffer();
      const err = await convertAndUploadBook(buf, book.title, {
        existingId: book.id,
        pdfAlreadyUploaded: true,
        onProgress: (done, total) =>
          setProg({ done, total, label: "تجهيز صفحات الكتاب بجودة عالية" }),
      });
      setProg(null);
      if (err) window.alert(`تعذّر التحسين: ${err}`);
      else window.alert("تم تحسين عرض الكتاب ✅");
    } catch {
      setProg(null);
      window.alert("تعذّر تنزيل الكتاب — تأكدي من الإنترنت");
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-8">
      <PageHeader title="كتب القراءة" back="/" />
      <p className="mb-5 -mt-2 text-sm text-silver-600">
        ارفعي كتاب PDF — يُجهَّز تلقائياً بجودة عالية ويظهر للطالبات بخطه الأصلي 📚
      </p>

      <div className="card mb-6 rounded-2xl p-4">
        <Field label="اسم الكتاب" icon="📖">
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثال: أخلاق أهل القرآن"
            disabled={busy}
          />
        </Field>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {prog ? (
          <div className="rounded-2xl bg-plum-50 p-4 text-center">
            <p className="mb-2 font-kufi text-sm font-bold text-plum-800">
              {prog.label}
            </p>
            <div className="h-2.5 overflow-hidden rounded-full bg-cream-dark">
              <div
                className="h-full rounded-full bg-plum-600 transition-all"
                style={{ width: `${(prog.done / prog.total) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-bold text-silver-600">
              {ar(prog.done)} / {ar(prog.total)} صفحة — لا تغلقي الصفحة
            </p>
          </div>
        ) : (
          <PrimaryBtn onClick={() => fileRef.current?.click()}>
            ⬆️ رفع كتاب PDF
          </PrimaryBtn>
        )}
      </div>

      {books.length === 0 ? (
        <div className="card rounded-2xl p-8 text-center">
          <p className="text-3xl">📚</p>
          <p className="mt-2 font-kufi font-bold text-plum-800">لا كتب بعد</p>
          <p className="mt-1 text-sm text-silver-600">ارفعي أول كتاب من الأعلى</p>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {books.map((b) => (
            <div key={b.id} className="card rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <Link
                  href={`/book/${b.id}`}
                  className="flex min-w-0 items-center gap-3 font-kufi text-base font-bold text-plum-800"
                >
                  <span className="text-2xl">📕</span>
                  <span className="truncate">{b.title}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`حذف كتاب «${b.title}»؟`)) {
                      actions.removeBook(b.id);
                    }
                  }}
                  className="shrink-0 text-sm font-bold text-red-600"
                  disabled={busy}
                >
                  حذف
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                {b.pages > 0 ? (
                  <span className="rounded-full bg-plum-100 px-2.5 py-0.5 text-[11px] font-bold text-plum-700">
                    ⚡ جودة عالية · {ar(b.pages)} صفحة
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => reprocess(b)}
                    disabled={busy}
                    className="rounded-full bg-plum-600 px-3 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                  >
                    ⚡ تحسين العرض (مطلوب)
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
