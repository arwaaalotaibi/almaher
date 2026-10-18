import type { ScheduleRow } from "./store";
import { amountLabel } from "./units";

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
    /** المقدار بوحدة الخطة للعرض («وجهين»، «٥ أسطر») */
    hifzAmount?: string;
    murAmount?: string;
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
      hifzAmount: s.hifzQty ? amountLabel(s.hifzQty, s.hifzUnit) : "",
      murAmount: s.murajaahQty ? amountLabel(s.murajaahQty, s.murUnit) : "",
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
