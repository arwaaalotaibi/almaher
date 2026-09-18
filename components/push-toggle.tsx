"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  disablePush,
  enablePush,
  getPushState,
  syncPush,
  registerServiceWorker,
  type PushState,
} from "@/lib/push";

/** زر تفعيل إشعارات الجهاز (Web Push) للطالبة */
export function PushToggle({
  studentId,
  halaqaId,
}: {
  studentId: string;
  halaqaId: string;
}) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    registerServiceWorker();
    // تصحيح صامت للاشتراكات القديمة ثم قراءة الحالة
    syncPush(studentId, halaqaId).finally(() => getPushState().then(setState));
  }, [studentId, halaqaId]);

  if (state === null || state === "unsupported") return null;

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (state === "subscribed") {
        setState(await disablePush());
      } else {
        setState(await enablePush(studentId, halaqaId));
      }
    } catch (e) {
      window.alert(
        e instanceof Error && e.message
          ? e.message
          : "تعذّر ضبط إشعارات الجهاز — حاولي مرة أخرى"
      );
    } finally {
      setBusy(false);
    }
  };

  if (state === "denied") {
    return (
      <div className="mb-4 rounded-2xl border border-cream-dark bg-cream/50 px-4 py-3 text-center text-xs font-bold text-silver-600">
        🔕 إشعارات الجهاز محظورة — فعّليها من إعدادات المتصفح للتطبيق
      </div>
    );
  }

  const on = state === "subscribed";
  // إشعار تجريبي فوري — للتأكد أن الأذونات والاشتراك يعملان على هذا الجهاز
  const sendTest = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("almaher-push", {
        body: { kind: "test" },
      });
      if (error) throw error;
      const sent = (data as { sent?: number } | null)?.sent ?? 0;
      if (sent === 0) window.alert("لم يصل الإشعار لأي جهاز — أعيدي تفعيل الإشعارات ثم جرّبي");
    } catch {
      window.alert("تعذّر إرسال الإشعار التجريبي — تحققي من الاتصال");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
    {on && (
      <button
        type="button"
        onClick={sendTest}
        className="mb-2 w-full rounded-xl bg-cream py-2 text-xs font-bold text-plum-700"
      >
        {busy ? "⏳ …" : "📨 أرسلي لي إشعاراً تجريبياً"}
      </button>
    )}
    <button
      type="button"
      onClick={toggle}
      className={`mb-4 flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-start transition active:scale-[0.99] ${
        on ? "border-plum-500 bg-plum-50" : "border-cream-dark bg-white"
      }`}
    >
      <span className="font-kufi text-sm font-bold text-plum-800">
        {on ? "🔔 إشعارات الجهاز مُفعّلة" : "🔔 تفعيل إشعارات الجهاز"}
      </span>
      <span
        className={`relative h-6 w-11 rounded-full transition ${
          on ? "bg-plum-600" : "bg-silver-400"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
            on ? "start-0.5" : "end-0.5"
          }`}
        />
      </span>
    </button>
    </>
  );
}
