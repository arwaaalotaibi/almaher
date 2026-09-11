"use client";

import { useCallback, useEffect, useState } from "react";
import { type Book } from "@/lib/store";
import {
  addQuote,
  deleteQuote,
  fetchQuotes,
  QUOTE_MAX,
  QUOTE_MIN,
  setLike,
  subscribeQuotes,
  type Quote,
} from "@/lib/quotes";
import { useRole } from "./auth-gate";
import { inputCls, PrimaryBtn, Sheet } from "./ui";

const ar = (n: number) => n.toLocaleString("ar-EG");

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ar-u-ca-gregory-nu-arab", {
    day: "numeric",
    month: "long",
  });

/** 💬 اقتباسات الكتب — خلاصة كالمنتدى: الطالبة تنشر اقتباساً من كتاب،
    والزميلات يُعجبن به. تظهر في تبويب القراءة (كل الكتب) وداخل صفحة الكتاب (كتاب واحد). */
export function BookQuotes({
  studentId,
  books,
  bookId,
  defaultPage,
}: {
  studentId: string | null; // الطالبة الحالية (null عند الإدارة/المعلّمة)
  books: Book[];
  bookId?: string; // حصر الخلاصة في كتاب واحد
  defaultPage?: number; // الصفحة المفتوحة في القارئ — تُقترح عند الكتابة
}) {
  const role = useRole();
  const staff = role === "admin" || role === "teacher";
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    try {
      setQuotes(await fetchQuotes(bookId));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [bookId]);

  useEffect(() => {
    void load();
    return subscribeQuotes(() => void load());
  }, [load]);

  const toggleLike = async (q: Quote) => {
    if (!studentId) return;
    const liked = !q.liked;
    // تفاؤلياً ثم الحفظ
    setQuotes((cur) =>
      cur?.map((x) =>
        x.id === q.id ? { ...x, liked, likes: x.likes + (liked ? 1 : -1) } : x
      ) ?? cur
    );
    try {
      await setLike(q.id, studentId, liked);
    } catch {
      void load();
    }
  };

  const remove = async (q: Quote) => {
    const mine = q.studentId === studentId;
    if (
      !window.confirm(
        mine
          ? "حذف اقتباسك؟"
          : `حذف اقتباس «${q.name}»؟ لن يظهر للطالبات بعد الآن.`
      )
    )
      return;
    setQuotes((cur) => cur?.filter((x) => x.id !== q.id) ?? cur);
    try {
      await deleteQuote(q.id);
    } catch {
      window.alert("تعذّر الحذف — تأكدي من الاتصال ثم أعيدي المحاولة");
      void load();
    }
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-kufi text-lg font-bold text-plum-800">
          💬 اقتباسات الطالبات
          {quotes && quotes.length > 0 && (
            <span className="ms-1.5 text-xs font-bold text-silver-600">
              ({ar(quotes.length)})
            </span>
          )}
        </h2>
        {studentId && (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="rounded-full bg-plum-600 px-3.5 py-1.5 text-xs font-bold text-white transition active:scale-95"
          >
            + اقتباس
          </button>
        )}
      </div>

      {quotes === null ? (
        <div className="card rounded-2xl p-6 text-center text-sm text-silver-600">
          {failed ? "تعذّر تحميل الاقتباسات — تحققي من الاتصال" : "جاري التحميل…"}
        </div>
      ) : quotes.length === 0 ? (
        <div className="card rounded-2xl p-6 text-center">
          <p className="text-3xl">💬</p>
          <p className="mt-2 font-kufi font-bold text-plum-800">لا اقتباسات بعد</p>
          <p className="mt-1 text-sm text-silver-600">
            {studentId
              ? "أعجبتكِ عبارة من كتاب؟ شاركيها مع زميلاتكِ"
              : "ستظهر هنا اقتباسات الطالبات من الكتب"}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {quotes.map((q) => {
            const mine = q.studentId === studentId;
            return (
              <article key={q.id} className="card rounded-2xl p-4">
                <p className="relative pe-6 font-body text-base leading-relaxed text-ink">
                  <span
                    aria-hidden
                    className="absolute -top-1 end-0 font-kufi text-3xl text-plum-200"
                  >
                    ”
                  </span>
                  {q.body}
                </p>

                {(!bookId || q.page) && (
                  <p className="mt-2 flex flex-wrap gap-1.5">
                    {!bookId && q.bookTitle && (
                      <span className="rounded-lg bg-plum-100 px-2 py-0.5 text-[11px] font-bold text-plum-700">
                        📖 {q.bookTitle}
                      </span>
                    )}
                    {q.page ? (
                      <span className="rounded-lg bg-cream px-2 py-0.5 text-[11px] font-bold text-silver-600">
                        ص {ar(q.page)}
                      </span>
                    ) : null}
                  </p>
                )}

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-cream-dark pt-2.5">
                  <div className="min-w-0 text-xs">
                    <p className="truncate font-bold text-plum-800">
                      🌸 {q.name}
                      {mine && (
                        <span className="ms-1 text-[10px] text-silver-600">(أنتِ)</span>
                      )}
                    </p>
                    <p className="truncate text-[11px] text-silver-600">
                      {q.halaqaLabel && <>{q.halaqaLabel} · </>}
                      {fmtDate(q.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {(mine || staff) && (
                      <button
                        type="button"
                        onClick={() => remove(q)}
                        aria-label="حذف الاقتباس"
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-cream text-sm text-silver-600"
                      >
                        🗑️
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleLike(q)}
                      disabled={!studentId}
                      aria-label={q.liked ? "إلغاء الإعجاب" : "إعجاب"}
                      aria-pressed={q.liked}
                      className={`flex h-8 items-center gap-1 rounded-full px-2.5 text-sm font-bold transition active:scale-95 disabled:opacity-70 ${
                        q.liked
                          ? "bg-rose-100 text-rose-700"
                          : "bg-cream text-plum-700"
                      }`}
                    >
                      {q.liked ? "❤️" : "🤍"}
                      {q.likes > 0 && <span>{ar(q.likes)}</span>}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {studentId && (
        <QuoteComposer
          open={composing}
          onClose={() => setComposing(false)}
          studentId={studentId}
          books={books}
          bookId={bookId}
          defaultPage={defaultPage}
          onAdded={() => void load()}
        />
      )}
    </section>
  );
}

/** نموذج كتابة اقتباس جديد */
function QuoteComposer({
  open,
  onClose,
  studentId,
  books,
  bookId,
  defaultPage,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  studentId: string;
  books: Book[];
  bookId?: string;
  defaultPage?: number;
  onAdded: () => void;
}) {
  const [book, setBook] = useState(bookId ?? books[0]?.id ?? "");
  const [page, setPage] = useState(defaultPage ? String(defaultPage) : "");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  // مزامنة الصفحة المقترحة مع الصفحة المفتوحة عند كل فتح
  useEffect(() => {
    if (open) setPage(defaultPage ? String(defaultPage) : "");
  }, [open, defaultPage]);

  const chosen = bookId ?? book;
  const len = body.trim().length;
  const ok = len >= QUOTE_MIN && len <= QUOTE_MAX && !!chosen;

  const send = async () => {
    if (!ok || busy) return;
    setBusy(true);
    try {
      const p = parseInt(page.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))), 10);
      await addQuote(studentId, chosen, body, Number.isFinite(p) && p > 0 ? p : null);
      setBody("");
      onAdded();
      onClose();
    } catch {
      window.alert("تعذّر نشر الاقتباس — تحققي من الاتصال ثم أعيدي المحاولة");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="💬 اقتباس جديد">
      <p className="mb-3 rounded-xl bg-plum-50 px-3 py-2.5 text-xs font-bold text-plum-700">
        انقلي العبارة كما هي في الكتاب، وسيظهر الاقتباس باسمكِ لكل الطالبات 🌸
      </p>

      {!bookId && (
        <label className="mb-3 block">
          <span className="mb-1 block text-sm font-bold text-plum-700">📖 الكتاب</span>
          <select
            className={inputCls}
            value={book}
            onChange={(e) => setBook(e.target.value)}
          >
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="mb-3 block">
        <span className="mb-1 block text-sm font-bold text-plum-700">
          📄 رقم الصفحة <span className="font-normal text-silver-600">(اختياري)</span>
        </span>
        <input
          inputMode="numeric"
          className={inputCls}
          value={page}
          onChange={(e) => setPage(e.target.value)}
          placeholder="مثال: ٤٢"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-bold text-plum-700">✍️ الاقتباس</span>
        <textarea
          className={`${inputCls} min-h-28`}
          value={body}
          maxLength={QUOTE_MAX}
          onChange={(e) => setBody(e.target.value)}
          placeholder="«…»"
        />
        <span className="mt-1 block text-end text-[11px] text-silver-600">
          {ar(len)} / {ar(QUOTE_MAX)}
        </span>
      </label>

      <div className="mt-3">
        <PrimaryBtn onClick={send} className={ok && !busy ? "" : "opacity-40"}>
          {busy ? "جاري النشر…" : "نشر الاقتباس"}
        </PrimaryBtn>
      </div>
    </Sheet>
  );
}
