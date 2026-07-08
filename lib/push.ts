"use client";

import { supabase } from "./supabase";

/** مفتاح VAPID العام — آمن في كود العميل (السرّي في الـEdge Function) */
export const VAPID_PUBLIC_KEY =
  "BPNxeLfMIGH8j7mwimMSDppNi2yRp-Jt80T0l9MRcSEPDdGLie98uxUBhMz25I-_2TCGZpaPIhc2EXnIcVV0gak";

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

  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        VAPID_PUBLIC_KEY
      ) as BufferSource,
    }));

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
