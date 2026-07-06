"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRole } from "./auth-gate";

const TABS = [
  { href: "/", icon: "🕌", label: "الحلقات" },
  { href: "/teachers", icon: "👩‍🏫", label: "المعلّمات" },
  { href: "/settings", icon: "⚙️", label: "الإعدادات" },
];

// يظهر الشريط في الشاشات الرئيسية فقط (لا في صفحات التفاصيل)
const NAV_PATHS = ["/", "/teachers", "/settings"];

/** شريط تنقّل سفلي للإدارة بين الشاشات الرئيسية الثلاث */
export function BottomNav() {
  const role = useRole();
  const pathname = usePathname();

  if (role !== "admin" || !NAV_PATHS.includes(pathname)) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-cream-dark bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 transition ${
                active ? "text-plum-700" : "text-silver-500"
              }`}
            >
              <span
                className={`flex h-8 w-14 items-center justify-center rounded-full text-xl ${
                  active ? "bg-plum-100" : ""
                }`}
              >
                {t.icon}
              </span>
              <span className="font-kufi text-xs font-bold">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
