import type { ScheduleRow } from "./store";

/** حمولة صفحة الطباعة — تُمرَّر عبر sessionStorage إلى /print
    (بدل window.open الذي لا يعمل داخل التطبيق المثبّت على الجوال) */
export interface PrintPayload {
  studentName: string;
  halaqaLabel: string;
  startLabel: string;
  rows: {
    n: number;
    date: string; // ISO
    hifz: number;
    murajaah: number;
    hifzLabel: string;
    murajaahLabel: string;
  }[];
}

export const PRINT_KEY = "almaher-print";

/** يفتح صفحة طباعة جدول الحفظ داخل التطبيق نفسه */
export function printHifzSchedule(opts: {
  studentName: string;
  halaqaLabel: string;
  startLabel: string;
  schedule: ScheduleRow[];
}) {
  const payload: PrintPayload = {
    studentName: opts.studentName,
    halaqaLabel: opts.halaqaLabel,
    startLabel: opts.startLabel,
    rows: opts.schedule.map((s) => ({
      n: s.n,
      date: s.date.toISOString(),
      hifz: s.hifz,
      murajaah: s.murajaah,
      hifzLabel: s.hifzLabel,
      murajaahLabel: s.murajaahLabel,
    })),
  };
  try {
    window.sessionStorage.setItem(PRINT_KEY, JSON.stringify(payload));
  } catch {
    /* تخزين غير متاح — الصفحة ستعرض رسالة */
  }
  window.location.assign("/print");
}
