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
  STUDENT_PASSWORD,
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
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const r = roleFromEmail(data.session?.user.email);
      if (data.session && r) {
        void init(r);
      } else {
        setStatus("login");
      }
    });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async () => {
    if (!password.trim() || busy) return;
    setBusy(true);
    setError("");

    // الطالبة: تدخل برمزها الخاص بدل كلمة مرور مشتركة
    if (role === "student") {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: ROLE_EMAILS.student,
        password: STUDENT_PASSWORD,
      });
      if (err) {
        setBusy(false);
        setError("تعذّر الاتصال، حاولي لاحقاً");
        return;
      }
      try {
        await pullRemote();
      } catch {
        setBusy(false);
        setError("تعذّر الاتصال بالإنترنت");
        return;
      }
      const code = normalizeDigits(password);
      const me = getState().students.find(
        (s) => normalizeDigits(s.code) === code
      );
      if (!me) {
        await supabase.auth.signOut();
        setBusy(false);
        setError("الرمز غير صحيح");
        return;
      }
      window.localStorage.setItem(STUDENT_PICK_KEY, me.id);
      setBusy(false);
      setStatus("loading");
      void init("student");
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
