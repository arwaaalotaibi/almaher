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

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
  { auth: { persistSession: true, autoRefreshToken: true } }
);
