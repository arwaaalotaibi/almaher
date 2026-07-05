"use client";

import { useSyncExternalStore } from "react";

/* ================== الأنواع ================== */

export interface Goals {
  hifz: string; // هدف الحفظ الجديد
  tathbit: string; // هدف التثبيت
  murajaah: string; // هدف المراجعة
}

export interface GoalsDone {
  hifz: boolean;
  tathbit: boolean;
  murajaah: boolean;
}

export interface Student {
  id: string;
  name: string;
  halaqaId: string;
  teacherId: string; // "" = بدون معلّمة بعد
  goals: Goals;
  done: GoalsDone;
  note?: string;
  updatedAt?: string; // ISO
}

export interface Halaqa {
  id: string;
  mosque: string; // مسجد البحر
  day: string; // الاثنين — قد يكون فارغاً
}

export interface Teacher {
  id: string;
  name: string;
  halaqaIds: string[];
}

export interface AppState {
  halaqas: Halaqa[];
  teachers: Teacher[];
  students: Student[];
}

export const EMPTY_GOALS: Goals = { hifz: "", tathbit: "", murajaah: "" };
export const EMPTY_DONE: GoalsDone = { hifz: false, tathbit: false, murajaah: false };

export const GOAL_META = [
  { key: "hifz", label: "هدف الحفظ", icon: "📖" },
  { key: "tathbit", label: "هدف التثبيت", icon: "📌" },
  { key: "murajaah", label: "هدف المراجعة", icon: "🔁" },
] as const;

export const WEEK_DAYS = [
  "",
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

/* ================== البيانات الابتدائية ================== */

const SEED: AppState = {
  halaqas: [
    { id: "bahar-mon", mosque: "مسجد البحر", day: "الاثنين" },
    { id: "yaqout", mosque: "مسجد الياقوت", day: "" },
    { id: "bahar-wed", mosque: "مسجد البحر", day: "الأربعاء" },
    { id: "ibn-taymiyyah", mosque: "مسجد ابن تيمية", day: "" },
  ],
  teachers: [],
  students: [],
};

/* ================== المخزن (localStorage) ================== */

const KEY = "almaher-v1";
let cache: AppState | null = null;
const listeners = new Set<() => void>();

function load(): AppState {
  if (cache) return cache;
  if (typeof window === "undefined") return SEED;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>;
      cache = {
        halaqas: Array.isArray(parsed.halaqas) ? parsed.halaqas : SEED.halaqas,
        teachers: Array.isArray(parsed.teachers) ? parsed.teachers : [],
        students: Array.isArray(parsed.students) ? parsed.students : [],
      };
    } else {
      cache = SEED;
    }
  } catch {
    cache = SEED;
  }
  return cache;
}

function persist(next: AppState) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* مساحة ممتلئة — نتجاهل */
  }
  listeners.forEach((fn) => fn());
}

export function getState(): AppState {
  return load();
}

export function setState(updater: (s: AppState) => AppState) {
  persist(updater(load()));
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useApp(): AppState {
  return useSyncExternalStore(subscribe, load, () => SEED);
}

export function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

/* ================== إجراءات ================== */

export const actions = {
  addHalaqa(mosque: string, day: string) {
    setState((s) => ({
      ...s,
      halaqas: [...s.halaqas, { id: uid(), mosque: mosque.trim(), day }],
    }));
  },
  updateHalaqa(id: string, patch: Partial<Halaqa>) {
    setState((s) => ({
      ...s,
      halaqas: s.halaqas.map((h) => (h.id === id ? { ...h, ...patch } : h)),
    }));
  },
  removeHalaqa(id: string) {
    setState((s) => ({
      ...s,
      halaqas: s.halaqas.filter((h) => h.id !== id),
      students: s.students.filter((st) => st.halaqaId !== id),
      teachers: s.teachers.map((t) => ({
        ...t,
        halaqaIds: t.halaqaIds.filter((hid) => hid !== id),
      })),
    }));
  },

  addTeacher(name: string, halaqaIds: string[]) {
    const id = uid();
    setState((s) => ({
      ...s,
      teachers: [...s.teachers, { id, name: name.trim(), halaqaIds }],
    }));
    return id;
  },
  updateTeacher(id: string, patch: Partial<Teacher>) {
    setState((s) => ({
      ...s,
      teachers: s.teachers.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  },
  removeTeacher(id: string) {
    setState((s) => ({
      ...s,
      teachers: s.teachers.filter((t) => t.id !== id),
      students: s.students.map((st) =>
        st.teacherId === id ? { ...st, teacherId: "" } : st
      ),
    }));
  },

  addStudent(name: string, halaqaId: string, teacherId: string) {
    setState((s) => ({
      ...s,
      students: [
        ...s.students,
        {
          id: uid(),
          name: name.trim(),
          halaqaId,
          teacherId,
          goals: { ...EMPTY_GOALS },
          done: { ...EMPTY_DONE },
          updatedAt: new Date().toISOString(),
        },
      ],
    }));
  },
  updateStudent(id: string, patch: Partial<Student>) {
    setState((s) => ({
      ...s,
      students: s.students.map((st) =>
        st.id === id
          ? { ...st, ...patch, updatedAt: new Date().toISOString() }
          : st
      ),
    }));
  },
  removeStudent(id: string) {
    setState((s) => ({
      ...s,
      students: s.students.filter((st) => st.id !== id),
    }));
  },

  exportJSON(): string {
    return JSON.stringify(load(), null, 2);
  },
  importJSON(raw: string): boolean {
    try {
      const parsed = JSON.parse(raw) as Partial<AppState>;
      if (!Array.isArray(parsed.halaqas) || !Array.isArray(parsed.students)) {
        return false;
      }
      persist({
        halaqas: parsed.halaqas,
        teachers: Array.isArray(parsed.teachers) ? parsed.teachers : [],
        students: parsed.students,
      });
      return true;
    } catch {
      return false;
    }
  },
  resetAll() {
    persist(structuredClone(SEED));
  },
};

/* ================== أدوات عرض ================== */

export function halaqaTitle(h: Halaqa): string {
  return h.day ? `${h.mosque} — ${h.day}` : h.mosque;
}

export function arabicCount(n: number, single: string, dual: string, plural: string): string {
  if (n === 0) return `لا ${plural}`;
  if (n === 1) return single;
  if (n === 2) return dual;
  if (n <= 10) return `${n.toLocaleString("ar-EG")} ${plural}`;
  return `${n.toLocaleString("ar-EG")} ${single}`;
}

export function studentCountLabel(n: number): string {
  return arabicCount(n, "طالبة واحدة", "طالبتان", "طالبات");
}
