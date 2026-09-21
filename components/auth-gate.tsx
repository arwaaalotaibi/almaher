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
  TEACHER_CLAIMED_KEY,
  TEACHER_PICK_KEY,
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

/** أقصى انتظار للإقلاع قبل اللجوء إلى النسخة المحفوظة أو شاشة الدخول */
const BOOT_TIMEOUT_MS = 15000;

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
      try {
        subscribeRealtime();
      } catch {
        /* المزامنة الحيّة كماليّة — لا توقف الدخول */
      }
    }
    setActiveRole(r);
    setStatus("ready");
  };

  useEffect(() => {
    let mounted = true;
    // دور الدخول من الرابط: ?admin → إدارة، ?teacher → معلّمة، غير ذلك → طالبات
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    if (params?.has("admin")) setRole("admin");
    if (params?.has("teacher")) setRole("teacher");
    // رابط دخول مباشر للمعلّمة: ?teacher=XXXXXX → يُربط الجهاز بها فوراً
    const teacherCode = params?.get("teacher") || null;
    if (teacherCode) {
      window.history.replaceState(null, "", window.location.pathname);
      claimTeacher(teacherCode)
        .catch(() => "تعذّر الاتصال، حاولي لاحقاً")
        .then((err) => {
          if (!mounted) return;
          if (err) {
            setRole("teacher");
            setError(err);
            setPassword(teacherCode);
            setStatus("login");
          }
        });
      return () => {
        mounted = false;
      };
    }
    // رابط دخول مباشر: ?code=XXXXXX (من رسالة الرمز) → يُربط الجهاز بالطالبة فوراً
    const linkCode =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("code")
        : null;
    if (linkCode) {
      // إزالة الرمز من شريط العنوان حتى لا يبقى في السجل
      window.history.replaceState(null, "", window.location.pathname);
      claimStudent(linkCode)
        .catch(() => "تعذّر الاتصال، حاولي لاحقاً")
        .then((err) => {
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
    // إقلاع محمي: أي خطأ أو تأخّر طويل لا يترك الطالبة على «جاري التحميل» إلى الأبد
    let settled = false;
    const fallback = () => {
      if (!mounted || settled) return;
      settled = true;
      // جهاز سبق ربطه بطالبة/معلّمة: نفتح النسخة المحفوظة على الجهاز
      const claimedTeacher = window.localStorage.getItem(TEACHER_CLAIMED_KEY) === "1";
      const pickedStudent = !!window.localStorage.getItem(STUDENT_PICK_KEY);
      if (claimedTeacher) void init("teacher");
      else if (pickedStudent) void init("student");
      else {
        setError("تعذّر الاتصال — تحققي من الإنترنت ثم أعيدي المحاولة");
        setStatus("login");
      }
    };
    const bootTimer = window.setTimeout(fallback, BOOT_TIMEOUT_MS);
    const boot = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted || settled) return;
      const user = data.session?.user;
      if (!user) {
        settled = true;
        setStatus("login");
        return;
      }
      // إدارة/معلّمة: حساب بريدي
      const r = roleFromEmail(user.email);
      if (r) {
        settled = true;
        void init(r);
        return;
      }
      // هوية مجهولة: جهاز طالبة أم معلّمة؟
      const [{ data: sid }, { data: tid }] = await Promise.all([
        supabase.rpc("almaher_me"),
        supabase.rpc("almaher_me_teacher"),
      ]);
      if (!mounted || settled) return;
      settled = true;
      if (typeof tid === "string" && tid) {
        window.localStorage.setItem(TEACHER_PICK_KEY, tid);
        window.localStorage.setItem(TEACHER_CLAIMED_KEY, "1");
        void init("teacher");
      } else if (typeof sid === "string" && sid) {
        window.localStorage.setItem(STUDENT_PICK_KEY, sid);
        void init("student");
      } else {
        setStatus("login");
      }
    };
    boot()
      .catch(() => {
        // خطأ غير متوقّع (شبكة/تخزين): نلجأ إلى المسار الاحتياطي فوراً
        fallback();
      })
      .finally(() => window.clearTimeout(bootTimer));
    return () => {
      mounted = false;
      window.clearTimeout(bootTimer);
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

  // المعلّمة: رمزها الخاص — هوية مجهولة تُربط بها عبر almaher_claim_teacher
  const claimTeacher = async (raw: string): Promise<string | null> => {
    const code = normalizeDigits(raw).replace(/\D/g, "");
    if (code.length < 4) return "الرمز غير صحيح";
    const { data: cur } = await supabase.auth.getSession();
    if (!cur.session || cur.session.user.email) {
      if (cur.session) await supabase.auth.signOut();
      const { error: anonErr } = await supabase.auth.signInAnonymously();
      if (anonErr) return "تعذّر الاتصال، حاولي لاحقاً";
    }
    const { data: tid, error: claimErr } = await supabase.rpc("almaher_claim_teacher", { p_code: code });
    if (claimErr) return "تعذّر الاتصال، حاولي لاحقاً";
    if (typeof tid !== "string" || !tid) return "الرمز غير صحيح";
    window.localStorage.setItem(TEACHER_PICK_KEY, tid);
    window.localStorage.setItem(TEACHER_CLAIMED_KEY, "1");
    window.localStorage.removeItem(STUDENT_PICK_KEY);
    setStatus("loading");
    void init("teacher");
    return null;
  };

  const login = async () => {
    if (!password.trim() || busy) return;
    setBusy(true);
    setError("");

    if (role === "student" || role === "teacher") {
      const err = await (role === "teacher" ? claimTeacher(password) : claimStudent(password)).catch(
        () => "تعذّر الاتصال، حاولي لاحقاً"
      );
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
    // id يقرؤه سكربت الطوارئ في layout: إن بقيت هذه الشاشة طويلاً (حتى لو لم يشتغل
    // كود التطبيق أصلاً على متصفح قديم) يعرض رسالة وزر إعادة التحميل
    return (
      <div id="almaher-boot" className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="الماهر" className="h-16 w-auto opacity-80" />
        <p className="text-sm font-bold text-silver-600">جاري التحميل…</p>
        <div id="almaher-boot-slow" hidden className="text-sm text-plum-800">
          <p className="mb-2">يطول التحميل… تأكدي من الإنترنت ثم أعيدي التحميل.</p>
          <p className="mb-3 text-xs text-silver-600">
            إن تكرّر: افتحي الرابط من Safari أو Chrome بدل واتساب، وحدّثي نظام الجوال إن كان قديماً.
          </p>
          <a href="/" className="inline-block rounded-full bg-plum-600 px-5 py-2 text-sm font-bold text-white">
            🔄 إعادة التحميل
          </a>
        </div>
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
            {isAdmin ? "🗝️ دخول الإدارة" : role === "teacher" ? "👩‍🏫 دخول المعلّمات" : "🌸 دخول الطالبات"}
          </h1>
          <p className="mb-4 mt-1 text-sm text-silver-600">
            {isAdmin
              ? "أدخلي كلمة مرور الإدارة"
              : role === "teacher"
                ? "أدخلي رمز المعلّمة من الإدارة"
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
              placeholder={isAdmin ? "كلمة مرور الإدارة" : role === "teacher" ? "رمز المعلّمة" : "رمز الطالبة"}
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
