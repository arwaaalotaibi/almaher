/** اقتباسات الكتب: تُقرأ عبر دالة آمنة (بالأسماء)، وتُكتب مباشرة في الجداول.
    ليست ضمن المخزن العام لأنها خلاصة مشتركة بين كل الطالبات. */

import { supabase } from "./supabase";
import { uid } from "./store";

export interface Quote {
  id: string;
  bookId: string;
  bookTitle: string;
  studentId: string;
  name: string;
  halaqaLabel: string;
  body: string;
  page: number | null;
  createdAt: string;
  likes: number;
  liked: boolean;
}

export const QUOTE_MIN = 3;
export const QUOTE_MAX = 600;

export async function fetchQuotes(bookId?: string | null): Promise<Quote[]> {
  const { data, error } = await supabase.rpc("almaher_quotes", {
    p_book: bookId || null,
  });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    bookId: String(r.book_id),
    bookTitle: String(r.book_title ?? ""),
    studentId: String(r.student_id),
    name: String(r.name ?? ""),
    halaqaLabel: String(r.halaqa_label ?? ""),
    body: String(r.body ?? ""),
    page: r.page == null ? null : Number(r.page),
    createdAt: String(r.created_at),
    likes: Number(r.likes) || 0,
    liked: Boolean(r.liked),
  }));
}

export async function addQuote(
  studentId: string,
  bookId: string,
  body: string,
  page: number | null
): Promise<void> {
  const { error } = await supabase.from("almaher_quotes").insert({
    id: uid(),
    book_id: bookId,
    student_id: studentId,
    body: body.trim(),
    page,
  });
  if (error) throw error;
}

export async function deleteQuote(id: string): Promise<void> {
  const { error } = await supabase.from("almaher_quotes").delete().eq("id", id);
  if (error) throw error;
}

export async function setLike(
  quoteId: string,
  studentId: string,
  liked: boolean
): Promise<void> {
  const q = liked
    ? supabase
        .from("almaher_quote_likes")
        .upsert({ quote_id: quoteId, student_id: studentId })
    : supabase
        .from("almaher_quote_likes")
        .delete()
        .eq("quote_id", quoteId)
        .eq("student_id", studentId);
  const { error } = await q;
  if (error) throw error;
}

/** إعادة التحميل عند أي تغيير في الاقتباسات أو الإعجابات (من أي جهاز) */
export function subscribeQuotes(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bump = () => {
    clearTimeout(timer);
    timer = setTimeout(onChange, 300);
  };
  const channel = supabase.channel(`almaher-quotes-${Math.random().toString(36).slice(2)}`);
  for (const table of ["almaher_quotes", "almaher_quote_likes"]) {
    channel.on("postgres_changes", { event: "*", schema: "public", table }, bump);
  }
  channel.subscribe();
  return () => {
    clearTimeout(timer);
    supabase.removeChannel(channel);
  };
}
