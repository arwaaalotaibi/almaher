"use client";

import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";

/* ================== الأنواع ================== */

export type Goals = Record<string, string>;
export type GoalsDone = Record<string, boolean>;

/** خطة الكورس الخاصة بالطالبة */
export interface CoursePlan {
  meetings: number; // عدد اللقاءات
  hifz: number; // صفحات الحفظ
  tathbit: number; // صفحات التثبيت
  murajaah: number; // صفحات المراجعة
}

export const EMPTY_PLAN: CoursePlan = {
  meetings: 0,
  hifz: 0,
  tathbit: 0,
  murajaah: 0,
};

/** إنجاز لقاء واحد — السورة والآيات */
export interface SessionLog {
  id: string;
  date: string; // ISO
  kind: string; // نوع الإنجاز: hifz | tathbit | murajaah
  surah: string; // اسم السورة
  fromAyah: string; // من آية
  toAyah: string; // إلى آية
  note?: string;
}

export interface Student {
  id: string;
  name: string;
  halaqaId: string;
  teacherId: string; // "" = بدون معلّمة بعد
  code: string; // رمز الدخول الخاص بالطالبة (٦ أرقام)
  track: TrackKey; // مسار الطالبة: حفظ / قراءة / تجويد
  plan: CoursePlan; // خطة الكورس
  sessions: SessionLog[]; // سجل إنجاز اللقاءات
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

export interface Announcement {
  id: string;
  body: string;
  halaqaId: string; // "" = لكل الحلقات
  createdAt: string; // ISO
}

export interface Book {
  id: string;
  title: string;
  url: string; // رابط ملف الـPDF العام
  createdAt: string;
}

export interface AppState {
  halaqas: Halaqa[];
  teachers: Teacher[];
  students: Student[];
  announcements: Announcement[];
  books: Book[];
}

export const EMPTY_GOALS: Goals = {};
export const EMPTY_DONE: GoalsDone = {};

/* ================== المسارات وأهداف كل مسار ================== */

export type TrackKey = "hifz" | "qiraah" | "tajweed";

export const TRACKS: TrackKey[] = ["hifz", "qiraah", "tajweed"];

export const TRACK_META: Record<TrackKey, { label: string; icon: string }> = {
  hifz: { label: "الحفظ", icon: "📖" },
  qiraah: { label: "القراءة", icon: "📚" },
  tajweed: { label: "التجويد", icon: "📗" },
};

export interface GoalItem {
  key: string;
  label: string;
  icon: string;
}

/** أهداف كل مسار — مسار الحفظ يبقى: حفظ + تثبيت + مراجعة */
export const TRACK_GOALS: Record<TrackKey, GoalItem[]> = {
  hifz: [
    { key: "hifz", label: "هدف الحفظ", icon: "📖" },
    { key: "tathbit", label: "هدف التثبيت", icon: "📌" },
    { key: "murajaah", label: "هدف المراجعة", icon: "🔁" },
  ],
  qiraah: [
    { key: "qiraah", label: "هدف القراءة", icon: "📚" },
    { key: "murajaah", label: "هدف المراجعة", icon: "🔁" },
  ],
  tajweed: [
    { key: "tajweed", label: "درس التجويد", icon: "📗" },
    { key: "tajweed_apply", label: "التطبيق", icon: "✍️" },
  ],
};

export function trackMeta(track: string) {
  return TRACK_META[(track as TrackKey)] ?? TRACK_META.hifz;
}

export function goalItems(track: string): GoalItem[] {
  return TRACK_GOALS[(track as TrackKey)] ?? TRACK_GOALS.hifz;
}

/* أنواع إنجاز اللقاء */
export const SESSION_KINDS = [
  { key: "hifz", label: "حفظ", icon: "📖" },
  { key: "tathbit", label: "تثبيت", icon: "📌" },
  { key: "murajaah", label: "مراجعة", icon: "🔁" },
] as const;

export function sessionKindMeta(k: string) {
  return SESSION_KINDS.find((x) => x.key === k) ?? SESSION_KINDS[0];
}

export const PLAN_FIELDS = [
  { key: "meetings", label: "عدد اللقاءات", icon: "📅" },
  { key: "hifz", label: "صفحات الحفظ", icon: "📖" },
  { key: "tathbit", label: "صفحات التثبيت", icon: "📌" },
  { key: "murajaah", label: "صفحات المراجعة", icon: "🔁" },
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

const SEED: AppState = {
  halaqas: [
    { id: "bahar-mon", mosque: "مسجد البحر", day: "الاثنين" },
    { id: "yaqout", mosque: "مسجد الياقوت", day: "" },
    { id: "bahar-wed", mosque: "مسجد البحر", day: "الأربعاء" },
    { id: "ibn-taymiyyah", mosque: "مسجد ابن تيمية", day: "" },
  ],
  teachers: [],
  students: [],
  announcements: [],
  books: [],
};

/* ================== المخزن المحلي (نسخة سريعة للعرض) ================== */

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
        announcements: Array.isArray(parsed.announcements)
          ? parsed.announcements
          : [],
        books: Array.isArray(parsed.books) ? parsed.books : [],
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

/** مفتاح تخزين هوية الطالبة على الجهاز (تُضبط عند الدخول بالرمز) */
export const STUDENT_PICK_KEY = "almaher-my-student-id";

/** توحيد الأرقام العربية والفارسية إلى إنجليزية + إزالة الفراغات */
export function normalizeDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/\s+/g, "");
}

export function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

/* ================== المزامنة مع قاعدة البيانات ================== */

interface StudentRow {
  id: string;
  name: string;
  halaqa_id: string;
  teacher_id: string;
  code: string;
  track: string;
  plan: CoursePlan;
  sessions: SessionLog[];
  goals: Goals;
  done: GoalsDone;
  note: string;
  updated_at: string;
}

function syncAlert() {
  if (typeof window !== "undefined") {
    window.alert("تعذّر حفظ التغيير في قاعدة البيانات — تأكدي من الإنترنت وأعيدي المحاولة");
  }
}

/** ينفّذ عملية بعيدة، وينبّه عند الفشل (التعديل المحلي يبقى ظاهراً) */
function run(op: () => PromiseLike<{ error: unknown }>) {
  Promise.resolve(op())
    .then(({ error }) => {
      if (error) {
        console.error(error);
        syncAlert();
      }
    })
    .catch((e) => {
      console.error(e);
      syncAlert();
    });
}

/** جلب كل البيانات من قاعدة البيانات وتحديث العرض */
export async function pullRemote(): Promise<void> {
  const [h, t, s, a, b] = await Promise.all([
    supabase.from("almaher_halaqas").select("id,mosque,day").order("created_at"),
    supabase.from("almaher_teachers").select("id,name,halaqa_ids").order("created_at"),
    supabase
      .from("almaher_students")
      .select("id,name,halaqa_id,teacher_id,code,track,plan,sessions,goals,done,note,updated_at")
      .order("created_at"),
    supabase
      .from("almaher_announcements")
      .select("id,body,halaqa_id,created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("almaher_books")
      .select("id,title,url,created_at")
      .order("created_at", { ascending: false }),
  ]);
  if (h.error || t.error || s.error || a.error || b.error) {
    throw h.error ?? t.error ?? s.error ?? a.error ?? b.error;
  }
  persist({
    halaqas: (h.data ?? []) as Halaqa[],
    teachers: (t.data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      halaqaIds: Array.isArray(row.halaqa_ids) ? (row.halaqa_ids as string[]) : [],
    })),
    students: ((s.data ?? []) as StudentRow[]).map((row) => ({
      id: row.id,
      name: row.name,
      halaqaId: row.halaqa_id,
      teacherId: row.teacher_id,
      code: row.code ?? "",
      track: (row.track as TrackKey) ?? "hifz",
      plan: { ...EMPTY_PLAN, ...row.plan },
      sessions: Array.isArray(row.sessions) ? row.sessions : [],
      goals: { ...EMPTY_GOALS, ...row.goals },
      done: { ...EMPTY_DONE, ...row.done },
      note: row.note,
      updatedAt: row.updated_at,
    })),
    announcements: (a.data ?? []).map((row) => ({
      id: row.id as string,
      body: row.body as string,
      halaqaId: (row.halaqa_id as string) ?? "",
      createdAt: row.created_at as string,
    })),
    books: (b.data ?? []).map((row) => ({
      id: row.id as string,
      title: row.title as string,
      url: row.url as string,
      createdAt: row.created_at as string,
    })),
  });
}

function studentToRow(st: Student): StudentRow {
  return {
    id: st.id,
    name: st.name,
    halaqa_id: st.halaqaId,
    teacher_id: st.teacherId,
    code: st.code,
    track: st.track ?? "hifz",
    plan: st.plan ?? EMPTY_PLAN,
    sessions: st.sessions ?? [],
    goals: st.goals,
    done: st.done,
    note: st.note ?? "",
    updated_at: st.updatedAt ?? new Date().toISOString(),
  };
}

/** رمز دخول رقمي فريد من ٦ خانات للطالبة */
export function genStudentCode(existing: Student[]): string {
  const used = new Set(existing.map((s) => s.code).filter(Boolean));
  let c = "";
  do {
    c = String(Math.floor(100000 + Math.random() * 900000));
  } while (used.has(c));
  return c;
}

/** رفع كل البيانات المحلية إلى قاعدة البيانات (استبدال كامل) */
export async function pushAll(state: AppState): Promise<void> {
  const wipe = [
    await supabase.from("almaher_announcements").delete().neq("id", ""),
    await supabase.from("almaher_students").delete().neq("id", ""),
    await supabase.from("almaher_teachers").delete().neq("id", ""),
    await supabase.from("almaher_halaqas").delete().neq("id", ""),
  ];
  for (const { error } of wipe) if (error) throw error;

  if (state.halaqas.length) {
    const { error } = await supabase
      .from("almaher_halaqas")
      .insert(state.halaqas.map((h) => ({ id: h.id, mosque: h.mosque, day: h.day })));
    if (error) throw error;
  }
  if (state.teachers.length) {
    const { error } = await supabase.from("almaher_teachers").insert(
      state.teachers.map((t) => ({
        id: t.id,
        name: t.name,
        halaqa_ids: t.halaqaIds,
      }))
    );
    if (error) throw error;
  }
  if (state.students.length) {
    const { error } = await supabase
      .from("almaher_students")
      .insert(state.students.map(studentToRow));
    if (error) throw error;
  }
  if (state.announcements?.length) {
    const { error } = await supabase.from("almaher_announcements").insert(
      state.announcements.map((n) => ({
        id: n.id,
        body: n.body,
        halaqa_id: n.halaqaId,
        created_at: n.createdAt,
      }))
    );
    if (error) throw error;
  }
}

/* تحديث لحظي: أي تغيير من جهاز آخر يُعاد جلبه تلقائياً */
let realtimeStarted = false;
export function subscribeRealtime() {
  if (realtimeStarted) return;
  realtimeStarted = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const refresh = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      pullRemote().catch(() => {
        /* بدون إنترنت — نبقى على النسخة المحلية */
      });
    }, 400);
  };
  const channel = supabase.channel("almaher-sync");
  for (const table of [
    "almaher_halaqas",
    "almaher_teachers",
    "almaher_students",
    "almaher_announcements",
    "almaher_books",
  ]) {
    channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
  }
  channel.subscribe();
}

/* ================== الإجراءات (محلي فوري + حفظ بعيد) ================== */

export const actions = {
  addHalaqa(mosque: string, day: string) {
    const halaqa: Halaqa = { id: uid(), mosque: mosque.trim(), day };
    setState((s) => ({ ...s, halaqas: [...s.halaqas, halaqa] }));
    run(() => supabase.from("almaher_halaqas").insert(halaqa));
  },
  updateHalaqa(id: string, patch: Partial<Halaqa>) {
    setState((s) => ({
      ...s,
      halaqas: s.halaqas.map((h) => (h.id === id ? { ...h, ...patch } : h)),
    }));
    run(() =>
      supabase
        .from("almaher_halaqas")
        .update({ mosque: patch.mosque, day: patch.day })
        .eq("id", id)
    );
  },
  removeHalaqa(id: string) {
    const affected = getState().teachers.filter((t) => t.halaqaIds.includes(id));
    setState((s) => ({
      ...s,
      halaqas: s.halaqas.filter((h) => h.id !== id),
      students: s.students.filter((st) => st.halaqaId !== id),
      teachers: s.teachers.map((t) => ({
        ...t,
        halaqaIds: t.halaqaIds.filter((hid) => hid !== id),
      })),
    }));
    // حذف الحلقة يحذف طالباتها تلقائياً في قاعدة البيانات (cascade)
    run(() => supabase.from("almaher_halaqas").delete().eq("id", id));
    for (const t of affected) {
      run(() =>
        supabase
          .from("almaher_teachers")
          .update({ halaqa_ids: t.halaqaIds.filter((hid) => hid !== id) })
          .eq("id", t.id)
      );
    }
  },

  addTeacher(name: string, halaqaIds: string[]) {
    const teacher: Teacher = { id: uid(), name: name.trim(), halaqaIds };
    setState((s) => ({ ...s, teachers: [...s.teachers, teacher] }));
    run(() =>
      supabase.from("almaher_teachers").insert({
        id: teacher.id,
        name: teacher.name,
        halaqa_ids: teacher.halaqaIds,
      })
    );
    return teacher.id;
  },
  updateTeacher(id: string, patch: Partial<Teacher>) {
    setState((s) => ({
      ...s,
      teachers: s.teachers.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
    run(() =>
      supabase
        .from("almaher_teachers")
        .update({
          ...(patch.name !== undefined && { name: patch.name }),
          ...(patch.halaqaIds !== undefined && { halaqa_ids: patch.halaqaIds }),
        })
        .eq("id", id)
    );
  },
  removeTeacher(id: string) {
    setState((s) => ({
      ...s,
      teachers: s.teachers.filter((t) => t.id !== id),
      students: s.students.map((st) =>
        st.teacherId === id ? { ...st, teacherId: "" } : st
      ),
    }));
    run(() =>
      supabase.from("almaher_students").update({ teacher_id: "" }).eq("teacher_id", id)
    );
    run(() => supabase.from("almaher_teachers").delete().eq("id", id));
  },

  addStudent(name: string, halaqaId: string, teacherId: string) {
    const student: Student = {
      id: uid(),
      name: name.trim(),
      halaqaId,
      teacherId,
      code: genStudentCode(getState().students),
      track: "hifz",
      plan: { ...EMPTY_PLAN },
      sessions: [],
      goals: { ...EMPTY_GOALS },
      done: { ...EMPTY_DONE },
      updatedAt: new Date().toISOString(),
    };
    setState((s) => ({ ...s, students: [...s.students, student] }));
    run(() => supabase.from("almaher_students").insert(studentToRow(student)));
  },
  updateStudent(id: string, patch: Partial<Student>) {
    const updatedAt = new Date().toISOString();
    setState((s) => ({
      ...s,
      students: s.students.map((st) =>
        st.id === id ? { ...st, ...patch, updatedAt } : st
      ),
    }));
    const st = getState().students.find((x) => x.id === id);
    if (st) {
      run(() =>
        supabase.from("almaher_students").update(studentToRow(st)).eq("id", id)
      );
    }
  },
  removeStudent(id: string) {
    setState((s) => ({
      ...s,
      students: s.students.filter((st) => st.id !== id),
    }));
    run(() => supabase.from("almaher_students").delete().eq("id", id));
  },

  addAnnouncement(body: string, halaqaId: string) {
    const note: Announcement = {
      id: uid(),
      body: body.trim(),
      halaqaId,
      createdAt: new Date().toISOString(),
    };
    setState((s) => ({ ...s, announcements: [note, ...s.announcements] }));
    run(() =>
      supabase.from("almaher_announcements").insert({
        id: note.id,
        body: note.body,
        halaqa_id: note.halaqaId,
        created_at: note.createdAt,
      })
    );
  },
  removeAnnouncement(id: string) {
    setState((s) => ({
      ...s,
      announcements: s.announcements.filter((n) => n.id !== id),
    }));
    run(() => supabase.from("almaher_announcements").delete().eq("id", id));
  },

  /** رفع كتاب PDF إلى التخزين ثم تسجيله */
  async uploadBook(file: File, title: string): Promise<string | null> {
    const id = uid();
    const path = `${id}.pdf`;
    const up = await supabase.storage
      .from("almaher-books")
      .upload(path, file, { contentType: "application/pdf", upsert: false });
    if (up.error) return up.error.message;
    const { data } = supabase.storage.from("almaher-books").getPublicUrl(path);
    const book: Book = {
      id,
      title: title.trim() || "كتاب",
      url: data.publicUrl,
      createdAt: new Date().toISOString(),
    };
    setState((s) => ({ ...s, books: [book, ...s.books] }));
    const ins = await supabase
      .from("almaher_books")
      .insert({ id: book.id, title: book.title, url: book.url });
    return ins.error ? ins.error.message : null;
  },
  removeBook(id: string) {
    setState((s) => ({ ...s, books: s.books.filter((bk) => bk.id !== id) }));
    run(() => supabase.from("almaher_books").delete().eq("id", id));
    void supabase.storage.from("almaher-books").remove([`${id}.pdf`]);
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
      const state: AppState = {
        halaqas: parsed.halaqas,
        teachers: Array.isArray(parsed.teachers) ? parsed.teachers : [],
        students: parsed.students,
        announcements: Array.isArray(parsed.announcements)
          ? parsed.announcements
          : [],
        books: Array.isArray(parsed.books) ? parsed.books : getState().books,
      };
      persist(state);
      pushAll(state).catch(() => syncAlert());
      return true;
    } catch {
      return false;
    }
  },
  resetAll() {
    const seed = structuredClone(SEED);
    persist(seed);
    pushAll(seed).catch(() => syncAlert());
  },
};

/* ================== أدوات عرض ================== */

export function halaqaTitle(h: Halaqa): string {
  return h.day ? `${h.mosque} — ${h.day}` : h.mosque;
}

/* ================== تحديدات/رسومات الكتاب ================== */

export interface Stroke {
  color: string;
  width: number;
  points: [number, number][]; // نقاط منسوبة 0..1
}

export type BookAnnotations = Record<string, Stroke[]>; // مفتاح = رقم الصفحة

export async function loadAnnotations(
  studentId: string,
  bookId: string
): Promise<BookAnnotations> {
  const { data, error } = await supabase
    .from("almaher_annotations")
    .select("data")
    .eq("id", `${studentId}:${bookId}`)
    .maybeSingle();
  if (error || !data) return {};
  return (data.data as BookAnnotations) ?? {};
}

export async function saveAnnotations(
  studentId: string,
  bookId: string,
  data: BookAnnotations
): Promise<void> {
  await supabase.from("almaher_annotations").upsert({
    id: `${studentId}:${bookId}`,
    student_id: studentId,
    book_id: bookId,
    data,
    updated_at: new Date().toISOString(),
  });
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

/** الإشعارات التي تخصّ مجموعة حلقات معيّنة (بالإضافة إلى إشعارات «الكل») */
export function announcementsFor(
  all: Announcement[],
  halaqaIds: string[]
): Announcement[] {
  return all.filter((n) => n.halaqaId === "" || halaqaIds.includes(n.halaqaId));
}

const SEEN_KEY = "almaher-notif-seen";

/** آخر وقت شاهدت فيه الإشعارات على هذا الجهاز */
export function getNotifSeen(): number {
  if (typeof window === "undefined") return 0;
  return Number(window.localStorage.getItem(SEEN_KEY) ?? 0);
}

export function markNotifSeen() {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SEEN_KEY, String(Date.now()));
  }
}

export function countUnseen(list: Announcement[], seen: number): number {
  return list.filter((n) => new Date(n.createdAt).getTime() > seen).length;
}

export function formatNotifDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-u-ca-gregory-nu-arab", {
    day: "numeric",
    month: "long",
  });
}
