"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { actions, useApp } from "@/lib/store";
import {
  Field,
  inputCls,
  PageHeader,
  PrimaryBtn,
  useHydrated,
} from "@/components/ui";
import { RoleOnly } from "@/components/admin-only";

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
  const [busy, setBusy] = useState(false);

  if (!hydrated) return <main className="mx-auto max-w-2xl px-4 pt-10" />;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      window.alert("الملف يجب أن يكون PDF");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      window.alert("حجم الملف كبير (الحد ٥٠ ميجابايت)");
      return;
    }
    const t = title.trim() || file.name.replace(/\.pdf$/i, "");
    setBusy(true);
    const err = await actions.uploadBook(file, t);
    setBusy(false);
    if (err) window.alert("تعذّر رفع الكتاب — أعيدي المحاولة");
    else setTitle("");
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-8">
      <PageHeader title="كتب القراءة" back="/" />
      <p className="mb-5 -mt-2 text-sm text-silver-600">
        ارفعي كتاب PDF فيظهر للطالبات في قسم القراءة، ويقدرن يحدّدن عليه 📚
      </p>

      <div className="card mb-6 rounded-2xl p-4">
        <Field label="اسم الكتاب" icon="📖">
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثال: متن تحفة الأطفال"
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
        <PrimaryBtn onClick={() => fileRef.current?.click()}>
          {busy ? "جارٍ الرفع…" : "⬆️ رفع كتاب PDF"}
        </PrimaryBtn>
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
            <div
              key={b.id}
              className="card flex items-center justify-between rounded-2xl p-4"
            >
              <Link
                href={`/book/${b.id}`}
                className="flex items-center gap-3 font-kufi text-base font-bold text-plum-800"
              >
                <span className="text-2xl">📕</span>
                {b.title}
              </Link>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`حذف كتاب «${b.title}»؟`)) {
                    actions.removeBook(b.id);
                  }
                }}
                className="text-sm font-bold text-red-600"
              >
                حذف
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
