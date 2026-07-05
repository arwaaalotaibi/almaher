"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

/** لتفادي اختلاف SSR عن localStorage — نعرض المحتوى بعد التركيب */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

/* شارة فضّية مثل «حلقات مسجد الياقوت» في البوستر */
export function Ribbon({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`ribbon mx-auto w-fit rounded-xl px-8 py-2.5 ${className}`}>
      <span className="font-kufi text-lg font-semibold text-white drop-shadow-sm">
        {children}
      </span>
    </div>
  );
}

/* صندوق اسم بنفسجي مثل البوستر */
export function NameBox({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`name-box w-full rounded-lg px-4 py-3 text-center font-kufi text-base font-medium text-white transition active:scale-[0.98] ${className}`}
    >
      {children}
    </button>
  );
}

/* رأس الصفحات الداخلية مع زر رجوع اختياري */
export function PageHeader({ title, back }: { title: string; back?: string }) {
  return (
    <header className="mb-5 flex items-center gap-3">
      {back && (
        <Link
          href={back}
          className="card flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg text-plum-700"
          aria-label="رجوع"
        >
          →
        </Link>
      )}
      <h1 className="font-kufi text-2xl font-bold text-plum-800">{title}</h1>
    </header>
  );
}

/* نافذة سفلية (Sheet) */
export function Sheet({
  open,
  onClose,
  children,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-plum-900/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="sheet-anim relative z-10 max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          {title ? (
            <h2 className="font-kufi text-xl font-bold text-plum-800">{title}</h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-cream text-plum-700"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: string;
  children: ReactNode;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm font-bold text-plum-700">
        {icon ? `${icon} ` : ""}
        {label}
      </span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-cream-dark bg-cream/50 px-3 py-2.5 text-ink outline-none focus:border-plum-500 focus:bg-white";

export function PrimaryBtn({
  children,
  onClick,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`w-full rounded-xl bg-plum-600 py-3 font-kufi text-base font-bold text-white transition active:scale-[0.98] ${className}`}
    >
      {children}
    </button>
  );
}

export function DangerBtn({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-bold text-red-700 transition active:scale-[0.98]"
    >
      {children}
    </button>
  );
}
