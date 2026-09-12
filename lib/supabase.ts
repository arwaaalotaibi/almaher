import { createClient } from "@supabase/supabase-js";

/* الأدوار الثلاثة:
   - الإدارة والمعلّمات: حساب بريد + كلمة مرور لكل دور.
   - الطالبات: لا حساب مشترك — جهاز الطالبة يحصل على هوية مجهولة من Supabase،
     ثم يُربط ببياناتها برمزها الخاص عبر دالة آمنة في قاعدة البيانات (almaher_claim).
     الرموز في جدول لا تقرؤه إلا الإدارة، وقاعدة البيانات نفسها تحصر
     كل طالبة في بياناتها (RLS). */
export type Role = "admin" | "teacher" | "student";

export const ROLE_EMAILS: Record<Exclude<Role, "student">, string> = {
  admin: "almaher@almahr.org",
  teacher: "muallima@almahr.org",
};

export const ROLE_META: Record<Role, { label: string; icon: string; hint: string }> = {
  admin: { label: "الإدارة", icon: "🗝️", hint: "إدارة الحلقات والمعلّمات والطالبات" },
  teacher: { label: "المعلّمات", icon: "👩‍🏫", hint: "إدخال بيانات طالباتك وأهدافهن" },
  student: { label: "الطالبات", icon: "🌸", hint: "أدخلي رمزك الخاص من الإدارة" },
};

/** دور حساب بريدي (إدارة/معلّمات) — الطالبات لا بريد لهن */
export function roleFromEmail(email: string | null | undefined): Role | null {
  if (!email) return null;
  const entry = (Object.entries(ROLE_EMAILS) as [Role, string][]).find(
    ([, e]) => e === email
  );
  return entry ? entry[0] : null;
}

/** هل الجلسة الحالية لموظّفة (إدارة/معلّمة)؟ */
export function isStaffRole(role: Role | null | undefined): boolean {
  return role === "admin" || role === "teacher";
}

// مفاتيح عامة قابلة للنشر (publishable) — آمنة في كود العميل، والحماية عبر RLS.
// تُقرأ من .env.local إن وُجدت، وإلا فالقيم المضمّنة (مشروع الماهر الحالي)
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rpsxmqtxoapfcbbkckgv.supabase.co";
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_WoWuQImdLUVO_R7Qhg7Beg_FAcNQCl1";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
