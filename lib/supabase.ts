import { createClient } from "@supabase/supabase-js";

// حساب دخول الجمعية الموحّد — المعلّمات يدخلن بكلمة المرور فقط
export const LOGIN_EMAIL = "almaher@almahr.org";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
  { auth: { persistSession: true, autoRefreshToken: true } }
);
