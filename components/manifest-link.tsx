"use client";

import { useEffect } from "react";

export const LOGIN_LINK_KEY = "almaher-login-link";

/** يوجّه رابط البيان إلى نسخة تحمل رمز صاحبة الجهاز — فتفتح الأيقونة المضافة وهي داخلة */
export function applyManifestLink() {
  try {
    const start = window.localStorage.getItem(LOGIN_LINK_KEY);
    const el = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!el) return;
    el.href = start ? `/app-manifest?start=${encodeURIComponent(start)}` : "/manifest.webmanifest";
  } catch {
    /* تخزين معطّل */
  }
}

export function ManifestLink() {
  useEffect(() => {
    applyManifestLink();
  }, []);
  return null;
}
