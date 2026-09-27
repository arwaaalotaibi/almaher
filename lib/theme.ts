/* ================== 🌙 الوضع الداكن ==================
   اختيار كل جهاز على حدة (localStorage): فاتح (الافتراضي) · داكن · تلقائي حسب إعداد الجوال.
   السمة الفعلية تُكتب في <html data-theme="dark|light"> — سكربت THEME_BOOT في layout
   يضبطها قبل رسم الصفحة (بلا وميض)، والألوان الداكنة في globals.css. */

export type ThemePref = "light" | "dark" | "auto";

export const THEME_KEY = "almaher-theme";

export const THEME_OPTIONS: { key: ThemePref; label: string; icon: string }[] = [
  { key: "light", label: "فاتح", icon: "☀️" },
  { key: "dark", label: "داكن", icon: "🌙" },
  { key: "auto", label: "تلقائي", icon: "📱" },
];

/** سكربت متزامن بصيغة قديمة (يعمل على أي متصفح) — يُحقن في layout قبل المحتوى */
export const THEME_BOOT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}")||"light";var d=t==="dark"||(t==="auto"&&window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light");}catch(e){}})();`;

export function getThemePref(): ThemePref {
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return v === "dark" || v === "auto" ? v : "light";
  } catch {
    return "light";
  }
}

function systemDark(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

/** يطبّق السمة الفعلية على <html> */
export function applyTheme(pref: ThemePref = getThemePref()) {
  if (typeof document === "undefined") return;
  // صفحات الطباعة تبقى فاتحة دائماً (data-force-light)
  const forced = document.documentElement.hasAttribute("data-force-light");
  const dark = !forced && (pref === "dark" || (pref === "auto" && systemDark()));
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

export function setThemePref(pref: ThemePref) {
  try {
    window.localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* تخزين غير متاح — يُطبَّق لهذه الجلسة فقط */
  }
  applyTheme(pref);
}

/** «تلقائي»: يتبع تبديل الجوال بين الفاتح والداكن أثناء فتح التطبيق */
export function watchSystemTheme(): () => void {
  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  if (!mq) return () => {};
  const onChange = () => {
    if (getThemePref() === "auto") applyTheme("auto");
  };
  mq.addEventListener?.("change", onChange);
  return () => mq.removeEventListener?.("change", onChange);
}
