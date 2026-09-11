"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  ROLE_EMAILS,
  roleFromEmail,
  supabase,
  type Role,
} from "@/lib/supabase";
import {
  getState,
  normalizeDigits,
  pullRemote,
  pushAll,
  STUDENT_PICK_KEY,
  subscribeRealtime,
} from "@/lib/store";
import { inputCls, PrimaryBtn } from "./ui";
import { BottomNav } from "./bottom-nav";

const RoleContext = createContext<Role>("student");

/** دور المستخدمة الحالية: admin | teacher | student */
export function useRole(): Role {
  return useContext(RoleContext);
}

type Status = "loading" | "login" | "ready";

/** بوابة الدخول: ثلاث شاشات — إدارة، معلّمات، طالبات */
export function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  // دور الدخول يُحدَّد من الرابط: الافتراضي طالبات، و?admin للإدارة
  const [role, setRole] = useState<Role>("student");
  const [activeRole, setActiveRole] = useState<Role>("student");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const init = async (r: Role) => {
    const localBefore = getState();
    let pulled = false;
    try {
      await pullRemote();
      pulled = true;
    } catch {
      /* بدون إنترنت — نعرض النسخة المحفوظة على الجهاز */
    }
    if (pulled) {
      if (r === "admin") {
        const now = getState();
        const remoteEmpty = now.teachers.length === 0 && now.students.length === 0;
        const localHasData =
          localBefore.teachers.length > 0 || localBefore.students.length > 0;
        if (remoteEmpty && localHasData) {
          if (
            window.confirm(
              "وجدتُ بيانات محفوظة على هذا الجهاز فقط.\nأنقلها إلى قاعدة البيانات المشتركة ليراها الجميع؟"
            )
          ) {
            try {
              await pushAll(localBefore);
              await pullRemote();
            } catch {
              window.alert(
                "تعذّر نقل البيانات — أعيدي المحاولة لاحقاً من الإعدادات (استيراد)"
              );
            }
          }
        }
      }
      subscribeRealtime();
    }
    setActiveRole(r);
    setStatus("ready");
  };

  useEffect(() => {
    let mounted = true;
    // دور الدخول من الرابط: ?admin → إدارة، غير ذلك → طالبات
    if (
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("admin")
    ) {
      setRole("admin");
    }
    // رابط دخول مباشر: ?code=XXXXXX (من رسالة الرمز) → يُربط الجهاز بالطالبة فوراً
    const linkCode =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("code")
        : null;
    if (linkCode) {
      // إزالة الرمز من شريط العنوان حتى لا يبقى في السجل
      window.history.replaceState(null, "", window.location.pathname);
      claimStudent(linkCode).then((err) => {
        if (!mounted) return;
        if (err) {
          setError(err);
          setPassword(linkCode);
          setStatus("login");
        }
      });
      return () => {
        mounted = false;
      };
    }
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const user = data.session?.user;
      if (!user) {
        setStatus("login");
        return;
      }
      // إدارة/معلّمة: حساب بريدي
      const r = roleFromEmail(user.email);
      if (r) {
        void init(r);
        return;
      }
      // هوية مجهولة لجهاز طالبة: هل رُبطت برمز من قبل؟
      const { data: sid } = await supabase.rpc("almaher_me");
      if (!mounted) return;
      if (typeof sid === "string" && sid) {
        window.localStorage.setItem(STUDENT_PICK_KEY, sid);
        void init("student");
      } else {
        setStatus("login");
      }
    });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // الطالبة: رمزها الخاص فقط — بلا حساب مشترك.
  // جهازها يحصل على هوية مجهولة من Supabase (مرة واحدة)، ثم تربطها
  // الدالة الآمنة almaher_claim بالطالبة صاحبة الرمز، وقاعدة البيانات
  // تحصر هذه الهوية في بياناتها هي. تعيد نص الخطأ أو null عند النجاح.
  const claimStudent = async (raw: string): Promise<string | null> => {
    const code = normalizeDigits(raw).replace(/\D/g, "");
    if (code.length < 4) return "الرمز غير صحيح";
    const { data: cur } = await supabase.auth.getSession();
    if (!cur.session || cur.session.user.email) {
      if (cur.session) await supabase.auth.signOut();
      const { error: anonErr } = await supabase.auth.signInAnonymously();
      if (anonErr) return "تعذّر الاتصال، حاولي لاحقاً";
    }
    const { data: sid, error: claimErr } = await supabase.rpc("almaher_claim", {
      p_code: code,
    });
    if (claimErr) return "تعذّر الاتصال، حاولي لاحقاً";
    if (typeof sid !== "string" || !sid) return "الرمز غير صحيح";
    window.localStorage.setItem(STUDENT_PICK_KEY, sid);
    setStatus("loading");
    void init("student");
    return null;
  };

  const login = async () => {
    if (!password.trim() || busy) return;
    setBusy(true);
    setError("");

    if (role === "student") {
      const err = await claimStudent(password);
      setBusy(false);
      if (err) setError(err);
      return;
    }

    const { error: err } = await supabase.auth.signInWithPassword({
      email: ROLE_EMAILS[role],
      password,
    });
    setBusy(false);
    if (err) {
      setError("كلمة المرور غير صحيحة");
      return;
    }
    setStatus("loading");
    void init(role);
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="الماهر" className="h-16 w-auto opacity-80" />
        <p className="text-sm font-bold text-silver-600">جاري التحميل…</p>
      </div>
    );
  }

  if (status === "login") {
    const isAdmin = role === "admin";
    return (
      <main className="flex min-h-dvh items-center justify-center px-4 py-8">
        <div className="card w-full max-w-sm rounded-3xl p-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="الماهر" className="mx-auto mb-4 h-20 w-auto" />

          <h1 className="font-kufi text-xl font-bold text-plum-800">
            {isAdmin ? "🗝️ دخول الإدارة" : "🌸 دخول الطالبات"}
          </h1>
          <p className="mb-4 mt-1 text-sm text-silver-600">
            {isAdmin
              ? "أدخلي كلمة مرور الإدارة"
              : "أدخلي رمزك الخاص من الإدارة"}
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void login();
            }}
          >
            <input
              type={isAdmin ? "password" : "text"}
              inputMode={isAdmin ? undefined : "numeric"}
              className={`${inputCls} mb-3 text-center ${
                isAdmin ? "" : "tracking-[0.3em] text-lg"
              }`}
              placeholder={isAdmin ? "كلمة مرور الإدارة" : "رمز الطالبة"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="mb-3 text-sm font-bold text-red-600">{error}</p>}
            <PrimaryBtn type="submit">{busy ? "لحظة…" : "دخول"}</PrimaryBtn>
          </form>
        </div>
      </main>
    );
  }

  return (
    <RoleContext.Provider value={activeRole}>
      {children}
      <BottomNav />
    </RoleContext.Provider>
  );
}
