"use client";

import { supabase } from "./supabase";

/** مفتاح VAPID العام — آمن في كود العميل (السرّي في الـEdge Function) */
export const VAPID_PUBLIC_KEY =
  "BNue3VBfDgKXX5nr0ro1HMz3NpWsGp8EpaAkup1luLNDqff4qTyn_TfWnu9M1-7jTvvELrL_TcsohouDuU_A3nc";

export type PushState =
  | "unsupported" // المتصفح لا يدعم الإشعارات
  | "default" // لم تُطلب الأذونات بعد
  | "denied" // رفضت الطالبة الأذونات
  | "subscribed"; // مُفعّلة

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** هل التطبيق مثبّت ويعمل من الشاشة الرئيسية (standalone)؟ */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** تسجيل الـService Worker (مرة واحدة) */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

/** الحالة الحالية لإشعارات الجهاز */
export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub && Notification.permission === "granted") return "subscribed";
  return "default";
}

/** هل اشتراك الجهاز مبنيّ على مفتاح VAPID الحالي؟ (اشتراك بمفتاح قديم لا يمكن الإرسال إليه) */
function subMatchesKey(sub: PushSubscription): boolean {
  const k = sub.options?.applicationServerKey;
  if (!k) return true; // متصفح لا يكشفه — نفترض أنه سليم
  const cur = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  const got = new Uint8Array(k);
  if (got.length !== cur.length) return false;
  for (let i = 0; i < cur.length; i++) if (got[i] !== cur[i]) return false;
  return true;
}

/** اشتراك جديد بالمفتاح الحالي وحفظه في قاعدة البيانات */
async function subscribeAndSave(
  reg: ServiceWorkerRegistration,
  studentId: string,
  halaqaId: string
): Promise<void> {
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
  });
  const json = sub.toJSON();
  // عبر دالة آمنة (SECURITY DEFINER) لتجاوز قيود RLS على الكتابة
  const { error } = await supabase.rpc("almaher_save_push_sub", {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh ?? "",
    p_auth: json.keys?.auth ?? "",
    p_sid: studentId,
    p_halaqa: halaqaId,
  });
  if (error) throw error;
}

/** مزامنة صامتة عند فتح التطبيق: إن كان الاشتراك بمفتاح قديم (قبل ١٢ سبتمبر ٢٠٢٦)
    يُستبدل باشتراك جديد دون طلب إذن، وإن كان سليماً يُعاد حفظه ليبقى مرتبطاً بالطالبة الحالية */
export async function syncPush(studentId: string, halaqaId: string): Promise<void> {
  if (!pushSupported() || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!reg || !sub) return;
  try {
    if (!subMatchesKey(sub)) {
      await supabase.rpc("almaher_delete_push_sub", { p_endpoint: sub.endpoint });
      await sub.unsubscribe();
      await subscribeAndSave(reg, studentId, halaqaId);
      return;
    }
    const json = sub.toJSON();
    await supabase.rpc("almaher_save_push_sub", {
      p_endpoint: sub.endpoint,
      p_p256dh: json.keys?.p256dh ?? "",
      p_auth: json.keys?.auth ?? "",
      p_sid: studentId,
      p_halaqa: halaqaId,
    });
  } catch {
    /* بلا إنترنت أو رفض — نحاول في الفتح القادم */
  }
}

/** تفعيل إشعارات الجهاز: إذن + اشتراك + حفظه في قاعدة البيانات */
export async function enablePush(
  studentId: string,
  halaqaId: string
): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  // على آيفون لا تعمل الإشعارات إلا من التطبيق المثبّت على الشاشة الرئيسية
  if (isIOS() && !isStandalone()) {
    throw new Error(
      "على آيفون: أضيفي التطبيق إلى الشاشة الرئيسية (زر المشاركة ← إضافة إلى الشاشة الرئيسية)، ثم افتحيه من الأيقونة وفعّلي الإشعارات من هناك."
    );
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "default";

  const reg =
    (await navigator.serviceWorker.getRegistration()) ??
    (await registerServiceWorker());
  if (!reg) return "unsupported";
  await navigator.serviceWorker.ready;

  // اشتراك قائم بمفتاح قديم يُلغى أولاً — لا يمكن الإرسال إليه
  const existing = await reg.pushManager.getSubscription();
  if (existing && !subMatchesKey(existing)) {
    await supabase.rpc("almaher_delete_push_sub", { p_endpoint: existing.endpoint });
    await existing.unsubscribe();
  }
  await subscribeAndSave(reg, studentId, halaqaId);
  return "subscribed";
}

/** إلغاء إشعارات الجهاز */
export async function disablePush(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.rpc("almaher_delete_push_sub", { p_endpoint: sub.endpoint });
    await sub.unsubscribe();
  }
  return "default";
}
