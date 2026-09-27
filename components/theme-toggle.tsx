"use client";

import { useEffect, useState } from "react";
import { applyTheme, getThemePref, setThemePref, THEME_OPTIONS, watchSystemTheme, type ThemePref } from "@/lib/theme";

/** 🌙 اختيار المظهر: فاتح · داكن · تلقائي (حسب الجوال) — يُحفظ على هذا الجهاز */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [pref, setPref] = useState<ThemePref | null>(null);
  useEffect(() => setPref(getThemePref()), []);

  return (
    <div className={`card rounded-2xl px-4 py-3.5 ${className}`}>
      <div className="mb-2 flex items-center gap-3">
        <span className="text-2xl">🌙</span>
        <span>
          <span className="block font-kufi font-bold text-plum-800">المظهر</span>
          <span className="block text-xs text-silver-600">
            «تلقائي» يتبع إعداد جوالكِ في الوضع الداكن
          </span>
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {THEME_OPTIONS.map((o) => {
          const on = pref === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => {
                setThemePref(o.key);
                setPref(o.key);
              }}
              aria-pressed={on}
              className={`rounded-xl border-2 py-2 text-sm font-bold transition active:scale-[0.97] ${
                on ? "border-plum-600 bg-plum-600 text-white" : "border-cream-dark bg-cream text-plum-800"
              }`}
            >
              {o.icon} {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** يُركَّب مرة واحدة في الجذر: يتبع تبديل الجوال عند اختيار «تلقائي» */
export function ThemeWatcher() {
  useEffect(() => watchSystemTheme(), []);
  return null;
}

/** صفحات الطباعة: فاتحة دائماً مهما كان اختيار الجهاز، وتعود السمة عند المغادرة */
export function useForceLight() {
  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute("data-force-light", "");
    applyTheme();
    return () => {
      el.removeAttribute("data-force-light");
      applyTheme();
    };
  }, []);
}
