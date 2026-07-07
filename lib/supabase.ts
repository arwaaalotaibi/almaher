import { createClient } from "@supabase/supabase-js";

/* ثلاثة أدوار، لكل دور حساب دخول وكلمة مرور خاصة */
export type Role = "admin" | "teacher" | "student";

export const ROLE_EMAILS: Record<Role, string> = {
  admin: "almaher@almahr.org",
  teacher: "muallima@almahr.org",
  student: "taliba@almahr.org",
};

// حساب القراءة المشترك للطالبات — الدخول الفعلي يكون برمز كل طالبة
export const STUDENT_PASSWORD = "Taliba@1447";

export const ROLE_META: Record<Role, { label: string; icon: string; hint: string }> = {
  admin: { label: "الإدارة", icon: "🗝️", hint: "إدارة الحلقات والمعلّمات والطالبات" },
  teacher: { label: "المعلّمات", icon: "👩‍🏫", hint: "إدخال بيانات طالباتك وأهدافهن" },
  student: { label: "الطالبات", icon: "🌸", hint: "أدخلي رمزك الخاص من الإدارة" },
};

export function roleFromEmail(email: string | null | undefined): Role | null {
  if (!email) return null;
  const entry = (Object.entries(ROLE_EMAILS) as [Role, string][]).find(
    ([, e]) => e === email
  );
  return entry ? entry[0] : null;
}

// مفاتيح عامة قابلة للنشر (publishable) — آمنة في كود العميل، والحماية عبر RLS
const SUPABASE_URL = "https://vtrpryydwwvbumcxiakk.supabase.co";
const SUPABASE_KEY = "sb_publishable_AKL6Ce_gVR6k4gFSnBzDYQ_A2J33_PE";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
