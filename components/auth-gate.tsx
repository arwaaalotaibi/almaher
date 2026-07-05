"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LOGIN_EMAIL, supabase } from "@/lib/supabase";
import { getState, pullRemote, pushAll, subscribeRealtime } from "@/lib/store";
import { inputCls, PrimaryBtn } from "./ui";

type Status = "loading" | "login" | "ready";

/** بوابة الدخول: كلمة مرور واحدة للجمعية، ثم مزامنة البيانات */
export function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const init = async () => {
    const localBefore = getState();
    let pulled = false;
    try {
      await pullRemote();
      pulled = true;
    } catch {
      /* بدون إنترنت — نعرض النسخة المحفوظة على الجهاز */
    }
    if (pulled) {
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
            window.alert("تعذّر نقل البيانات — أعيدي المحاولة لاحقاً من الإعدادات (استيراد)");
          }
        }
      }
      subscribeRealtime();
    }
    setStatus("ready");
  };

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) {
        void init();
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
    if (!password || busy) return;
    setBusy(true);
    setError("");
    const { error: err } = await supabase.auth.signInWithPassword({
      email: LOGIN_EMAIL,
      password,
    });
    setBusy(false);
    if (err) {
      setError("كلمة المرور غير صحيحة");
      return;
    }
    setStatus("loading");
    void init();
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
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <div className="card w-full max-w-sm rounded-3xl p-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="الماهر" className="mx-auto mb-4 h-20 w-auto" />
          <h1 className="font-kufi text-2xl font-bold text-plum-800">
            دخول المعلّمات
          </h1>
          <p className="mb-5 mt-1 text-sm text-silver-600">
            أدخلي كلمة مرور الجمعية مرة واحدة على هذا الجهاز
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void login();
            }}
          >
            <input
              type="password"
              className={`${inputCls} mb-3 text-center`}
              placeholder="كلمة المرور"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {error && (
              <p className="mb-3 text-sm font-bold text-red-600">{error}</p>
            )}
            <PrimaryBtn type="submit">{busy ? "لحظة…" : "دخول"}</PrimaryBtn>
          </form>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
