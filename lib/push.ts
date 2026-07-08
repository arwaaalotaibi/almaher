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
  const { error } = await supabase.from("almaher_push_subs").upsert(
    {
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
      student_id: studentId,
      halaqa_id: halaqaId,
    },
    { onConflict: "endpoint" }
  );
  if (error) throw error;
  return "subscribed";
}

/** إلغاء إشعارات الجهاز */
export async function disablePush(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from("almaher_push_subs").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
  return "default";
}
