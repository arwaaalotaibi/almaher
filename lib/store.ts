"use client";

import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import {
  hifzRangeLabel,
  MUSHAF_PAGES,
  pageOf,
  surahNumber,
} from "./mushaf";

/* ================== الأنواع ================== */

export type Goals = Record<string, string>;
export type GoalsDone = Record<string, boolean>;

/** خطة الفصل الخاصة بالطالبة */
export interface CoursePlan {
  meetings: number; // (قديم — غير مستخدم)
  hifz: number; // أوجه الحفظ
  tathbit: number; // أوجه التثبيت
  murajaah: number; // أوجه المراجعة لكل لقاء
  start?: string; // (قديم — نص حر)
  startSurah?: string; // بداية الحفظ: السورة
  startAyah?: number; // بداية الحفظ: رقم الآية
  murStartSurah?: string; // بداية المراجعة: السورة
  murStartAyah?: number; // بداية المراجعة: رقم الآية
}

export const EMPTY_PLAN: CoursePlan = {
  meetings: 0,
  hifz: 0,
  tathbit: 0,
  murajaah: 0,
  start: "",
  startSurah: "",
  startAyah: 1,
  murStartSurah: "",
  murStartAyah: 1,
};

/** نص بداية الحفظ للعرض */
export function hifzStartLabel(plan?: CoursePlan): string {
  if (!plan) return "";
  if (plan.startSurah)
    return `سورة ${plan.startSurah} — آية ${(plan.startAyah ?? 1).toLocaleString("ar-EG")}`;
  return plan.start?.trim() ?? "";
}

/** حصّة واحدة — أوجه الحفظ/التثبيت/المراجعة (+ تفصيل السورة اختياري) */
export interface SessionLog {
  id: string;
  date: string; // ISO
  hifz?: number; // أوجه الحفظ الجديد
  tathbit?: number; // أوجه التثبيت (= حفظ الحصة الفائتة)
  murajaah?: number; // أوجه المراجعة
  surah?: string; // اسم السورة (اختياري)
  fromAyah?: string;
  toAyah?: string;
  kind?: string; // (قديم — للتوافق)
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
  agreedAt?: string; // ISO — وقت إقرار الطالبة باللائحة
  agreedVersion?: string; // نسخة اللائحة التي أقرّت بها
  lastSeen?: string; // ISO — آخر مرة فتحت فيها الطالبة التطبيق
}

export interface Halaqa {
  id: string;
  mosque: string; // مسجد البحر
  day: string; // الاثنين — قد يكون فارغاً
  termStart: string; // تاريخ بداية الفصل (ISO yyyy-mm-dd) — قد يكون فارغاً
  termSessions: number; // عدد لقاءات الفصل
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
  pinned?: boolean; // مثبّت على واجهة الطالبة (واحد فقط)
  type?: string; // نوع الإشعار (NotifType)
  showAt?: string; // يظهر ابتداءً من (ISO) — للجدولة
  expiresAt?: string; // يختفي بعد (ISO) — لانتهاء الصلاحية
}

/** أنواع الإشعارات — لكل نوع أيقونة ولون */
export type NotifType =
  | "general"
  | "important"
  | "congrats"
  | "reminder"
  | "holiday";

export const NOTIF_TYPES: {
  key: NotifType;
  label: string;
  icon: string;
  cls: string; // لون الحدّ/الخلفية
}[] = [
  { key: "general", label: "عام", icon: "📢", cls: "border-plum-500 bg-plum-50" },
  { key: "important", label: "تنبيه مهم", icon: "⚠️", cls: "border-amber-500 bg-amber-50" },
  { key: "congrats", label: "تهنئة", icon: "🎉", cls: "border-emerald-500 bg-emerald-50" },
  { key: "reminder", label: "تذكير موعد", icon: "⏰", cls: "border-sky-500 bg-sky-50" },
  { key: "holiday", label: "إجازة", icon: "🌙", cls: "border-indigo-500 bg-indigo-50" },
];

export function notifTypeMeta(t?: string) {
  return NOTIF_TYPES.find((x) => x.key === t) ?? NOTIF_TYPES[0];
}

/** مقطع من خطة قراءة الكتاب: يوم قراءة أو اختبار */
export interface ReadingSegment {
  id: string;
  date: string; // ISO yyyy-mm-dd
  fromPage: number;
  toPage: number;
  isExam: boolean;
  note?: string;
}

export interface Book {
  id: string;
  title: string;
  url: string; // رابط ملف الـPDF العام
  pages: number; // عدد صفحات الصور المجهّزة (0 = عرض PDF مباشر)
  imgBase: string; // رابط مجلد صور الصفحات
  readingPlan: ReadingSegment[]; // خطة القراءة الموزّعة على الأيام
  createdAt: string;
}

/** سجل قراءة إشعار من طالبة (لإيصال القراءة للإدارة) */
export interface NotifRead {
  announcementId: string;
  studentId: string;
  readAt?: string; // ISO — وقت القراءة
}

/** حالة قسم من التسميع: سمّعت (بمقطع) أو لم تسمّع */
export type ReciteStatus = "done" | "none";

/** مقطع قسم واحد: من (سورة، آية) ← إلى (سورة، آية) */
export interface RecitePart {
  status: ReciteStatus;
  fromSurah?: string;
  fromAyah?: number;
  toSurah?: string;
  toAyah?: number;
}

export const EMPTY_PART: RecitePart = { status: "none" };

/** سجلّ تسميع لقاء: حضور + الأقسام الثلاثة (كل قسم من سورة/آية إلى سورة/آية) */
export interface RecitationLog {
  id: string;
  studentId: string;
  date: string; // yyyy-mm-dd
  attended: boolean; // false = غائبة
  tasmi: RecitePart;
  muraja: RecitePart;
  tathbit: RecitePart;
  note?: string;
  createdAt?: string;
}

/** أقسام سجلّ التسميع الثلاثة */
export const RECITE_PARTS = [
  { key: "tasmi", label: "التسميع (الحفظ الجديد)", icon: "📖" },
  { key: "muraja", label: "المراجعة", icon: "🔁" },
  { key: "tathbit", label: "التثبيت", icon: "📌" },
] as const;

function normPart(p: unknown): RecitePart {
  const o = (p ?? {}) as Record<string, unknown>;
  return {
    status: o.status === "done" ? "done" : "none",
    fromSurah: (o.fromSurah as string) || undefined,
    fromAyah: (o.fromAyah as number) ?? undefined,
    toSurah: (o.toSurah as string) || undefined,
    toAyah: (o.toAyah as number) ?? undefined,
  };
}

/** نص مقطع قسم: «الملك ١» أو «الملك ١ ← القلم ٥» */
export function recitePartLabel(part?: RecitePart): string {
  if (!part || part.status !== "done" || !part.fromSurah) return "";
  const a = `${part.fromSurah} ${(part.fromAyah ?? 1).toLocaleString("ar-EG")}`;
  const b = `${part.toSurah || part.fromSurah} ${(
    part.toAyah ??
    part.fromAyah ??
    1
  ).toLocaleString("ar-EG")}`;
  return a === b ? a : `${a} ← ${b}`;
}

export interface AppState {
  halaqas: Halaqa[];
  teachers: Teacher[];
  students: Student[];
  announcements: Announcement[];
  books: Book[];
  notifReads: NotifRead[];
  recitations: RecitationLog[];
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

/* أوجه كل لقاء — التثبيت يُحسب تلقائياً (= حفظ اللقاء السابق) */
export const PLAN_FIELDS = [
  { key: "hifz", label: "أوجه الحفظ", icon: "📖" },
  { key: "murajaah", label: "أوجه المراجعة", icon: "🔁" },
] as const;

/* ================== مولّد جدول الفصل (العقل الذكي) ==================
   من: تاريخ بداية الفصل + يوم الحلقة + عدد اللقاءات + أوجه الخطة
   يُنتج: تاريخ كل لقاء + المطلوب فيه (حفظ/تثبيت/مراجعة) موزّعاً بذكاء. */

export interface ScheduleRow {
  n: number; // رقم اللقاء
  date: Date; // تاريخ اللقاء
  hifz: number; // أوجه الحفظ في هذا اللقاء
  tathbit: number;
  murajaah: number;
  hifzLabel: string; // مقطع الحفظ الجديد (سورة/آية) — إن عُرفت بداية الحفظ
  tathbitLabel: string; // مقطع التثبيت (= حفظ اللقاء الفائت)
  murajaahLabel: string; // مقطع المراجعة — إن عُرفت بداية المراجعة
  cumHifz: number; // التراكمي حتى هذا اللقاء
  cumTathbit: number;
  cumMurajaah: number;
}

function dayNameToDow(day: string): number {
  // WEEK_DAYS: ["", "الأحد"(1)...] → getDay: الأحد=0 ⇒ index-1
  const i = WEEK_DAYS.indexOf(day);
  return i > 0 ? i - 1 : -1;
}

/** يوزّع مجموعاً على n خطوة توزيعاً متساوياً قدر الإمكان (تراكمي مدوّر) */
function spread(total: number, n: number): number[] {
  const out: number[] = [];
  let prev = 0;
  for (let i = 1; i <= n; i++) {
    const cum = Math.round((total * i) / n);
    out.push(cum - prev);
    prev = cum;
  }
  return out;
}

export function buildSchedule(
  halaqa: Pick<Halaqa, "day" | "termStart" | "termSessions">,
  plan: CoursePlan
): ScheduleRow[] | null {
  const n = halaqa.termSessions;
  const dow = dayNameToDow(halaqa.day);
  if (!halaqa.termStart || n < 1 || dow < 0) return null;

  const start = new Date(`${halaqa.termStart}T00:00:00`);
  if (isNaN(start.getTime())) return null;

  // أول لقاء: أول يوم موافق ليوم الحلقة في/بعد تاريخ البداية
  const first = new Date(start);
  while (first.getDay() !== dow) first.setDate(first.getDate() + 1);

  // «أوجه الحفظ» و«أوجه المراجعة» = كمية كل لقاء (تتراكم عبر المصحف)
  const perH = Math.max(0, Math.round(plan.hifz || 0));
  const perM = Math.max(0, Math.round(plan.murajaah || 0));

  const hPage0 = plan.startSurah
    ? pageOf(surahNumber(plan.startSurah), plan.startAyah || 1)
    : 0;
  const mPage0 = plan.murStartSurah
    ? pageOf(surahNumber(plan.murStartSurah), plan.murStartAyah || 1)
    : 0;

  type Rng = { from: number; to: number };
  const empty: Rng = { from: 0, to: 0 };

  const rows: ScheduleRow[] = [];
  let hCur = hPage0; // مؤشّر صفحة الحفظ التالية
  let mCur = mPage0; // مؤشّر صفحة المراجعة التالية
  let prevH: Rng = empty; // حفظ اللقاء السابق (= تثبيت اللقاء الحالي)
  let ch = 0,
    ct = 0,
    cm = 0;

  for (let i = 0; i < n; i++) {
    const date = new Date(first);
    date.setDate(first.getDate() + i * 7);

    // مقطع الحفظ الجديد لهذا اللقاء
    let hRange: Rng = empty;
    let hCount = perH;
    if (hPage0) {
      if (perH > 0 && hCur <= MUSHAF_PAGES) {
        hRange = { from: hCur, to: Math.min(MUSHAF_PAGES, hCur + perH - 1) };
        hCount = hRange.to - hRange.from + 1;
        hCur = hRange.to + 1;
      } else {
        hCount = 0; // انتهى المصحف
      }
    }

    // التثبيت = مقطع حفظ اللقاء السابق
    const tRange = prevH;
    const tCount = tRange.from ? tRange.to - tRange.from + 1 : 0;

    // مقطع المراجعة (إن حُدّدت بدايتها)
    let mRange: Rng = empty;
    let mCount = perM;
    if (mPage0) {
      if (perM > 0 && mCur <= MUSHAF_PAGES) {
        mRange = { from: mCur, to: Math.min(MUSHAF_PAGES, mCur + perM - 1) };
        mCount = mRange.to - mRange.from + 1;
        mCur = mRange.to + 1;
      } else {
        mCount = 0;
      }
    }

    ch += hCount;
    ct += tCount;
    cm += mCount;
    rows.push({
      n: i + 1,
      date,
      hifz: hCount,
      tathbit: tCount,
      murajaah: mCount,
      hifzLabel: hRange.from ? hifzRangeLabel(hRange.from, hRange.to) : "",
      tathbitLabel: tRange.from ? hifzRangeLabel(tRange.from, tRange.to) : "",
      murajaahLabel: mRange.from ? hifzRangeLabel(mRange.from, mRange.to) : "",
      cumHifz: ch,
      cumTathbit: ct,
      cumMurajaah: cm,
    });
    prevH = hRange;
  }
  return rows;
}

/** رقم اللقاء الحالي/القادم بالنسبة لليوم (1-based)، و0 إن انتهى الفصل */
export function currentSessionIndex(rows: ScheduleRow[]): number {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const upcoming = rows.find((r) => r.date.getTime() >= new Date().setHours(0, 0, 0, 0));
  return upcoming ? upcoming.n : 0;
}

/** مفتاح تاريخ yyyy-mm-dd (لمطابقة سجلّ التسميع باللقاء) */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function formatSchedDate(d: Date): string {
  return d.toLocaleDateString("ar-u-ca-gregory-nu-arab", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

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
    { id: "bahar-mon", mosque: "مسجد البحر", day: "الاثنين", termStart: "", termSessions: 0 },
    { id: "yaqout", mosque: "مسجد الياقوت", day: "", termStart: "", termSessions: 0 },
    { id: "bahar-wed", mosque: "مسجد البحر", day: "الأربعاء", termStart: "", termSessions: 0 },
    { id: "ibn-taymiyyah", mosque: "مسجد ابن تيمية", day: "", termStart: "", termSessions: 0 },
  ],
  teachers: [],
  students: [],
  announcements: [],
  books: [],
  notifReads: [],
  recitations: [],
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
        notifReads: Array.isArray(parsed.notifReads) ? parsed.notifReads : [],
        recitations: Array.isArray(parsed.recitations) ? parsed.recitations : [],
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
  agreed_at: string | null;
  agreed_version: string;
  last_seen?: string | null;
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
  const [h, t, s, a, b, r, sess] = await Promise.all([
    supabase
      .from("almaher_halaqas")
      .select("id,mosque,day,term_start,term_sessions")
      .order("created_at"),
    supabase.from("almaher_teachers").select("id,name,halaqa_ids").order("created_at"),
    supabase
      .from("almaher_students")
      .select("id,name,halaqa_id,teacher_id,code,track,plan,sessions,goals,done,note,updated_at,agreed_at,agreed_version,last_seen")
      .order("created_at"),
    supabase
      .from("almaher_announcements")
      .select("id,body,halaqa_id,created_at,pinned,type,show_at,expires_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("almaher_books")
      .select("id,title,url,pages,img_base,reading_plan,created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("almaher_notif_reads")
      .select("announcement_id,student_id,read_at"),
    supabase
      .from("almaher_sessions")
      .select("id,student_id,log_date,attended,parts,note,created_at")
      .order("log_date", { ascending: false }),
  ]);
  if (h.error || t.error || s.error || a.error || b.error) {
    throw h.error ?? t.error ?? s.error ?? a.error ?? b.error;
  }
  persist({
    halaqas: (h.data ?? []).map((row) => ({
      id: row.id as string,
      mosque: row.mosque as string,
      day: (row.day as string) ?? "",
      termStart: (row.term_start as string) ?? "",
      termSessions: (row.term_sessions as number) ?? 0,
    })),
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
      agreedAt: row.agreed_at ?? undefined,
      agreedVersion: row.agreed_version ?? "",
      lastSeen: row.last_seen ?? undefined,
    })),
    announcements: (a.data ?? []).map((row) => ({
      id: row.id as string,
      body: row.body as string,
      halaqaId: (row.halaqa_id as string) ?? "",
      createdAt: row.created_at as string,
      pinned: (row.pinned as boolean) ?? false,
      type: (row.type as string) ?? "general",
      showAt: (row.show_at as string) ?? undefined,
      expiresAt: (row.expires_at as string) ?? undefined,
    })),
    books: (b.data ?? []).map((row) => ({
      id: row.id as string,
      title: row.title as string,
      url: row.url as string,
      pages: (row.pages as number) ?? 0,
      imgBase: (row.img_base as string) ?? "",
      readingPlan: Array.isArray(row.reading_plan)
        ? (row.reading_plan as ReadingSegment[])
        : [],
      createdAt: row.created_at as string,
    })),
    notifReads: (r.data ?? []).map((row) => ({
      announcementId: row.announcement_id as string,
      studentId: row.student_id as string,
      readAt: (row.read_at as string) ?? undefined,
    })),
    recitations: (sess.data ?? []).map((row) => {
      const parts = (row.parts ?? {}) as Record<string, unknown>;
      return {
        id: row.id as string,
        studentId: row.student_id as string,
        date: row.log_date as string,
        attended: (row.attended as boolean) ?? true,
        tasmi: normPart(parts.tasmi),
        muraja: normPart(parts.muraja),
        tathbit: normPart(parts.tathbit),
        note: (row.note as string) || undefined,
        createdAt: (row.created_at as string) ?? undefined,
      };
    }),
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
    agreed_at: st.agreedAt ?? null,
    agreed_version: st.agreedVersion ?? "",
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
      .insert(
        state.halaqas.map((h) => ({
          id: h.id,
          mosque: h.mosque,
          day: h.day,
          term_start: h.termStart ?? "",
          term_sessions: h.termSessions ?? 0,
        }))
      );
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
        type: n.type ?? "general",
        pinned: n.pinned ?? false,
        show_at: n.showAt ?? null,
        expires_at: n.expiresAt ?? null,
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
    "almaher_notif_reads",
    "almaher_sessions",
  ]) {
    channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
  }
  channel.subscribe();
}

/* ================== الإجراءات (محلي فوري + حفظ بعيد) ================== */

export const actions = {
  addHalaqa(mosque: string, day: string) {
    const halaqa: Halaqa = {
      id: uid(),
      mosque: mosque.trim(),
      day,
      termStart: "",
      termSessions: 0,
    };
    setState((s) => ({ ...s, halaqas: [...s.halaqas, halaqa] }));
    run(() =>
      supabase.from("almaher_halaqas").insert({
        id: halaqa.id,
        mosque: halaqa.mosque,
        day: halaqa.day,
      })
    );
  },
  updateHalaqa(id: string, patch: Partial<Halaqa>) {
    setState((s) => ({
      ...s,
      halaqas: s.halaqas.map((h) => (h.id === id ? { ...h, ...patch } : h)),
    }));
    run(() =>
      supabase
        .from("almaher_halaqas")
        .update({
          ...(patch.mosque !== undefined && { mosque: patch.mosque }),
          ...(patch.day !== undefined && { day: patch.day }),
          ...(patch.termStart !== undefined && { term_start: patch.termStart }),
          ...(patch.termSessions !== undefined && {
            term_sessions: patch.termSessions,
          }),
        })
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

  addAnnouncement(
    body: string,
    halaqaId: string,
    opts?: { type?: NotifType; pinned?: boolean }
  ) {
    const note: Announcement = {
      id: uid(),
      body: body.trim(),
      halaqaId,
      createdAt: new Date().toISOString(),
      type: opts?.type ?? "general",
      pinned: opts?.pinned ?? false,
    };
    setState((s) => ({
      ...s,
      // تثبيت واحد فقط: أي إشعار جديد مثبّت يُلغي تثبيت الباقي
      announcements: [
        note,
        ...(note.pinned
          ? s.announcements.map((n) => ({ ...n, pinned: false }))
          : s.announcements),
      ],
    }));
    if (note.pinned) {
      run(() =>
        supabase
          .from("almaher_announcements")
          .update({ pinned: false })
          .eq("pinned", true)
      );
    }
    Promise.resolve(
      supabase.from("almaher_announcements").insert({
        id: note.id,
        body: note.body,
        halaqa_id: note.halaqaId,
        created_at: note.createdAt,
        type: note.type,
        pinned: note.pinned,
      })
    )
      .then(({ error }) => {
        if (error) {
          console.error(error);
          syncAlert();
          return;
        }
        // إرسال Web Push للأجهزة المشتركة (لا يعطّل الحفظ إن فشل)
        supabase.functions
          .invoke("send-push", { body: { announcementId: note.id } })
          .catch((e) => console.error("push", e));
      })
      .catch((e) => {
        console.error(e);
        syncAlert();
      });
  },
  /** تثبيت إشعار واحد على الواجهة (يُلغي تثبيت الباقي)، أو فكّ التثبيت */
  setAnnouncementPinned(id: string, pinned: boolean) {
    setState((s) => ({
      ...s,
      announcements: s.announcements.map((n) =>
        n.id === id ? { ...n, pinned } : pinned ? { ...n, pinned: false } : n
      ),
    }));
    if (pinned) {
      run(() =>
        supabase
          .from("almaher_announcements")
          .update({ pinned: false })
          .eq("pinned", true)
      );
    }
    run(() =>
      supabase.from("almaher_announcements").update({ pinned }).eq("id", id)
    );
  },
  removeAnnouncement(id: string) {
    setState((s) => ({
      ...s,
      announcements: s.announcements.filter((n) => n.id !== id),
    }));
    run(() => supabase.from("almaher_announcements").delete().eq("id", id));
  },
  /** تسجّل الطالبة قراءتها لإشعارات (لإيصال القراءة للإدارة) — عبر دالة آمنة،
     تتبّع غير حرج فلا ننبّه المستخدم عند الفشل. */
  recordNotifRead(studentId: string, announcementIds: string[]) {
    if (!studentId || announcementIds.length === 0) return;
    for (const announcement_id of announcementIds) {
      Promise.resolve(
        supabase.rpc("almaher_record_read", {
          p_aid: announcement_id,
          p_sid: studentId,
        })
      )
        .then(({ error }) => {
          if (error) console.error("notif read", error);
        })
        .catch((e) => console.error("notif read", e));
    }
  },
  /** الطالبة تسجّل ما سمّعته في اللقاء (تسميع/مراجعة/تثبيت) */
  addRecitation(log: Omit<RecitationLog, "id" | "createdAt">) {
    const rec: RecitationLog = {
      ...log,
      id: uid(),
      createdAt: new Date().toISOString(),
    };
    setState((s) => ({ ...s, recitations: [rec, ...s.recitations] }));
    run(() =>
      supabase.from("almaher_sessions").insert({
        id: rec.id,
        student_id: rec.studentId,
        log_date: rec.date,
        attended: rec.attended,
        parts: { tasmi: rec.tasmi, muraja: rec.muraja, tathbit: rec.tathbit },
        note: rec.note ?? "",
      })
    );
  },
  removeRecitation(id: string) {
    setState((s) => ({
      ...s,
      recitations: s.recitations.filter((x) => x.id !== id),
    }));
    run(() => supabase.from("almaher_sessions").delete().eq("id", id));
  },
  /** تحديث «آخر ظهور» للطالبة عند فتح التطبيق (صامت) */
  touchSeen(studentId: string) {
    if (!studentId) return;
    Promise.resolve(
      supabase.rpc("almaher_touch_seen", { p_sid: studentId })
    ).catch((e) => console.error("seen", e));
  },

  setBookPlan(id: string, plan: ReadingSegment[]) {
    setState((s) => ({
      ...s,
      books: s.books.map((bk) =>
        bk.id === id ? { ...bk, readingPlan: plan } : bk
      ),
    }));
    run(() =>
      supabase.from("almaher_books").update({ reading_plan: plan }).eq("id", id)
    );
  },
  renameBook(id: string, title: string) {
    const t = title.trim();
    if (!t) return;
    setState((s) => ({
      ...s,
      books: s.books.map((bk) => (bk.id === id ? { ...bk, title: t } : bk)),
    }));
    run(() => supabase.from("almaher_books").update({ title: t }).eq("id", id));
  },
  removeBook(id: string) {
    const book = getState().books.find((bk) => bk.id === id);
    setState((s) => ({ ...s, books: s.books.filter((bk) => bk.id !== id) }));
    run(() => supabase.from("almaher_books").delete().eq("id", id));
    const paths = [`${id}.pdf`];
    for (let p = 1; p <= (book?.pages ?? 0); p++) paths.push(`pages/${id}/p${p}`);
    for (let i = 0; i < paths.length; i += 100) {
      void supabase.storage.from("almaher-books").remove(paths.slice(i, i + 100));
    }
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
        notifReads: Array.isArray(parsed.notifReads)
          ? parsed.notifReads
          : getState().notifReads,
        recitations: Array.isArray(parsed.recitations)
          ? parsed.recitations
          : getState().recitations,
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

/* ================== خطة قراءة الكتاب ================== */

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** توليد خطة قراءة تلقائياً: توزيع الصفحات على الأيام ثم اختبار */
export function buildReadingPlan(
  totalPages: number,
  startISO: string,
  pagesPerDay: number,
  dows: number[], // أيام الأسبوع المسموحة (0=الأحد)، فارغ = كل يوم
  addExam: boolean
): ReadingSegment[] {
  if (!startISO || totalPages < 1 || pagesPerDay < 1) return [];
  const active = dows.length ? dows : [0, 1, 2, 3, 4, 5, 6];
  const d = new Date(`${startISO}T00:00:00`);
  if (isNaN(d.getTime())) return [];
  const segs: ReadingSegment[] = [];
  let page = 1;
  let guard = 0;
  while (page <= totalPages && guard < 2000) {
    if (active.includes(d.getDay())) {
      const to = Math.min(totalPages, page + pagesPerDay - 1);
      segs.push({
        id: uid(),
        date: ymd(d),
        fromPage: page,
        toPage: to,
        isExam: false,
      });
      page = to + 1;
    }
    d.setDate(d.getDate() + 1);
    guard++;
  }
  if (addExam) {
    while (!active.includes(d.getDay()) && guard < 2100) {
      d.setDate(d.getDate() + 1);
      guard++;
    }
    segs.push({
      id: uid(),
      date: ymd(d),
      fromPage: 1,
      toPage: totalPages,
      isExam: true,
      note: "اختبار على الكتاب كاملاً",
    });
  }
  return segs;
}

/** مقطع «اليوم» من خطة القراءة (أو الأقرب القادم) */
export function todaySegment(plan: ReadingSegment[]): {
  seg: ReadingSegment;
  when: "today" | "upcoming" | "past";
} | null {
  if (!plan.length) return null;
  const today = ymd(new Date());
  const sorted = [...plan].sort((a, b) => a.date.localeCompare(b.date));
  const exact = sorted.find((s) => s.date === today);
  if (exact) return { seg: exact, when: "today" };
  const next = sorted.find((s) => s.date > today);
  if (next) return { seg: next, when: "upcoming" };
  return { seg: sorted[sorted.length - 1], when: "past" };
}

export function segDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("ar-u-ca-gregory-nu-arab", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/* ================== تحويل الكتاب إلى صور صفحات ==================
   يُحوَّل الـPDF مرة واحدة عند الرفع إلى صور عالية الدقة، فتشاهد كل
   الطالبات نفس الصفحة المطابقة للأصل على أي جهاز وبفتح أسرع. */

const PAGE_W = 1600; // عرض صورة الصفحة بالبكسل

function canvasToBlob(
  c: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((res) => c.toBlob(res, type, quality));
}

export async function convertAndUploadBook(
  source: ArrayBuffer,
  title: string,
  opts: {
    existingId?: string; // إعادة معالجة كتاب موجود
    pdfAlreadyUploaded?: boolean;
    onProgress: (done: number, total: number) => void;
  }
): Promise<string | null> {
  const id = opts.existingId ?? uid();
  try {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const doc = await pdfjs.getDocument({
      data: source,
      cMapUrl: "/pdf-cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "/pdf-fonts/",
    }).promise;
    const total = doc.numPages;

    // أفضل صيغة يدعمها المتصفح
    const probe = document.createElement("canvas");
    probe.width = probe.height = 2;
    const useWebp = probe.toDataURL("image/webp").startsWith("data:image/webp");
    const mime = useWebp ? "image/webp" : "image/jpeg";

    for (let p = 1; p <= total; p++) {
      const page = await doc.getPage(p);
      const scale = PAGE_W / page.getViewport({ scale: 1 }).width;
      const viewport = page.getViewport({ scale });
      const c = document.createElement("canvas");
      c.width = viewport.width;
      c.height = viewport.height;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await canvasToBlob(c, mime, 0.82);
      if (!blob) return "تعذّر تجهيز صورة الصفحة";
      // الاستبدال (upsert) معطّل في تخزين هذا المشروع — نحذف ثم ندرج
      await supabase.storage.from("almaher-books").remove([`pages/${id}/p${p}`]);
      const up = await supabase.storage
        .from("almaher-books")
        .upload(`pages/${id}/p${p}`, blob, { contentType: mime });
      if (up.error) return up.error.message;
      page.cleanup();
      opts.onProgress(p, total);
    }

    if (!opts.pdfAlreadyUploaded) {
      await supabase.storage.from("almaher-books").remove([`${id}.pdf`]);
      const up = await supabase.storage
        .from("almaher-books")
        .upload(`${id}.pdf`, new Blob([source], { type: "application/pdf" }), {
          contentType: "application/pdf",
        });
      if (up.error) return up.error.message;
    }

    const pub = (p: string) =>
      supabase.storage.from("almaher-books").getPublicUrl(p).data.publicUrl;
    const book: Book = {
      id,
      title: title.trim() || "كتاب",
      url: pub(`${id}.pdf`),
      pages: total,
      imgBase: pub(`pages/${id}`),
      readingPlan: [],
      createdAt: new Date().toISOString(),
    };

    if (opts.existingId) {
      const upd = await supabase
        .from("almaher_books")
        .update({ pages: book.pages, img_base: book.imgBase })
        .eq("id", id);
      if (upd.error) return upd.error.message;
      setState((s) => ({
        ...s,
        books: s.books.map((bk) =>
          bk.id === id ? { ...bk, pages: book.pages, imgBase: book.imgBase } : bk
        ),
      }));
    } else {
      const ins = await supabase.from("almaher_books").insert({
        id: book.id,
        title: book.title,
        url: book.url,
        pages: book.pages,
        img_base: book.imgBase,
      });
      if (ins.error) return ins.error.message;
      setState((s) => ({ ...s, books: [book, ...s.books] }));
    }
    return null;
  } catch (e) {
    console.error(e);
    return "تعذّر فتح ملف الـPDF";
  }
}

/* ================== تحديدات/رسومات الكتاب ================== */

export interface Stroke {
  color: string;
  width: number;
  points: [number, number][]; // نقاط منسوبة 0..1
  alpha?: number; // شفافية الخط (قلم ~0.9، تظليل ~0.35)
}

export type BookAnnotations = Record<string, Stroke[]>; // مفتاح = رقم الصفحة

/* الإشارات المرجعية تُخزَّن مع الكتابات في نفس السجل تحت مفتاح محجوز */
const BM_KEY = "__bm";

export async function loadAnnotations(
  studentId: string,
  bookId: string
): Promise<{ ann: BookAnnotations; bookmarks: number[] }> {
  const { data, error } = await supabase
    .from("almaher_annotations")
    .select("data")
    .eq("id", `${studentId}:${bookId}`)
    .maybeSingle();
  if (error || !data) return { ann: {}, bookmarks: [] };
  const raw = (data.data ?? {}) as Record<string, unknown>;
  const bookmarks = Array.isArray(raw[BM_KEY]) ? (raw[BM_KEY] as number[]) : [];
  const ann: BookAnnotations = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k !== BM_KEY && Array.isArray(v)) ann[k] = v as Stroke[];
  }
  return { ann, bookmarks };
}

export async function saveAnnotations(
  studentId: string,
  bookId: string,
  ann: BookAnnotations,
  bookmarks: number[]
): Promise<void> {
  await supabase.from("almaher_annotations").upsert({
    id: `${studentId}:${bookId}`,
    student_id: studentId,
    book_id: bookId,
    data: { ...ann, [BM_KEY]: bookmarks },
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

/** الإشعارات الظاهرة الآن: تخصّ الحلقة + بدأ ظهورها + لم تنتهِ صلاحيتها */
export function visibleAnnouncements(
  all: Announcement[],
  halaqaIds: string[]
): Announcement[] {
  const now = Date.now();
  return announcementsFor(all, halaqaIds).filter((n) => {
    if (n.showAt && new Date(n.showAt).getTime() > now) return false;
    if (n.expiresAt && new Date(n.expiresAt).getTime() <= now) return false;
    return true;
  });
}

/** عدد الطالبات اللواتي قرأن إشعاراً معيّناً */
export function readCountFor(reads: NotifRead[], announcementId: string): number {
  return reads.filter((x) => x.announcementId === announcementId).length;
}

/** خريطة: معرّف الطالبة → وقت قراءتها لإشعار معيّن */
export function notifReadMap(
  reads: NotifRead[],
  announcementId: string
): Record<string, string | undefined> {
  const m: Record<string, string | undefined> = {};
  for (const x of reads)
    if (x.announcementId === announcementId) m[x.studentId] = x.readAt ?? "";
  return m;
}

/** وقت نسبي بالعربية: الآن / قبل ٥ دقائق / أمس / التاريخ */
export function timeAgo(iso?: string): string {
  if (!iso) return "لم تظهر بعد";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "الآن";
  if (min < 60) return `قبل ${min.toLocaleString("ar-EG")} دقيقة`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `قبل ${hr.toLocaleString("ar-EG")} ساعة`;
  const d = Math.floor(hr / 24);
  if (d === 1) return "أمس";
  if (d < 7) return `قبل ${d.toLocaleString("ar-EG")} أيام`;
  return new Date(iso).toLocaleDateString("ar-u-ca-gregory-nu-arab", {
    day: "numeric",
    month: "long",
  });
}

/** الإشعار المثبّت على الواجهة (إن وُجد ضمن الظاهرة) */
export function pinnedAnnouncement(
  all: Announcement[],
  halaqaIds: string[]
): Announcement | null {
  return visibleAnnouncements(all, halaqaIds).find((n) => n.pinned) ?? null;
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

/* ===== إشعارات ذكية تلقائية (تُولَّد من بيانات الطالبة، بلا إدخال) ===== */

export interface SmartNotif {
  id: string; // ثابت ليعمل تتبّع القراءة
  type: NotifType;
  icon: string;
  title: string;
  body: string;
}

function daysUntil(d: Date): number {
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - startToday.getTime()) / 86400000);
}

function whenLabel(days: number): string {
  if (days <= 0) return "اليوم";
  if (days === 1) return "غداً";
  if (days === 2) return "بعد يومين";
  return `بعد ${days.toLocaleString("ar-EG")} أيام`;
}

/** تذكيرات الطالبة المولّدة تلقائياً من جدولها وخطط قراءتها */
export function autoNotifsFor(
  student: Student,
  halaqa: Halaqa | undefined,
  books: Book[]
): SmartNotif[] {
  const out: SmartNotif[] = [];

  // اللقاء القادم (خلال ٣ أيام) أو اكتمال الفصل
  if (halaqa) {
    const sched = buildSchedule(halaqa, student.plan);
    if (sched && sched.length > 0) {
      const idx = currentSessionIndex(sched);
      if (idx > 0) {
        const row = sched[idx - 1];
        const days = daysUntil(row.date);
        if (days >= 0 && days <= 3) {
          const hifz = row.hifzLabel || (row.hifz ? `${row.hifz} أوجه` : "—");
          const mur =
            row.murajaahLabel || (row.murajaah ? `${row.murajaah} أوجه` : "—");
          out.push({
            id: `auto:meeting:${row.n}:${ymd(row.date)}`,
            type: "reminder",
            icon: "📅",
            title: `لقاؤك ${whenLabel(days)}`,
            body: `المطلوب — 📖 حفظ: ${hifz}\n🔁 مراجعة: ${mur}`,
          });
        }
      } else {
        out.push({
          id: `auto:term-done:${sched.length}`,
          type: "congrats",
          icon: "🎉",
          title: "اكتمل الفصل",
          body: "أتممتِ لقاءات الفصل كاملةً، أحسنتِ وبوركتِ! 🌟",
        });
      }
    }
  }

  // اختبارات القراءة القريبة (خلال ٥ أيام)
  for (const b of books) {
    const ts = todaySegment(b.readingPlan);
    if (ts && ts.seg.isExam && ts.when !== "past") {
      const days = daysUntil(new Date(`${ts.seg.date}T00:00:00`));
      if (days >= 0 && days <= 5) {
        out.push({
          id: `auto:exam:${b.id}:${ts.seg.id}`,
          type: "important",
          icon: "📝",
          title: `اختبار «${b.title}» ${whenLabel(days)}`,
          body: `استعدّي لاختبار كتاب «${b.title}» — ${segDateLabel(
            ts.seg.date
          )}`,
        });
      }
    }
  }

  return out;
}

/* ===== تتبّع القراءة لكل إشعار على حِدة (على الجهاز) ===== */
const READ_KEY = "almaher-notif-read";

export function getReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(READ_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(READ_KEY, JSON.stringify([...ids]));
  } catch {
    /* تجاهل */
  }
}

/** تعليم مجموعة إشعارات كمقروءة، وإرجاع المجموعة المحدّثة */
export function markNotifsRead(idsToAdd: string[]): Set<string> {
  const cur = getReadIds();
  let changed = false;
  for (const id of idsToAdd)
    if (!cur.has(id)) {
      cur.add(id);
      changed = true;
    }
  if (changed) saveReadIds(cur);
  return cur;
}

/** عدد غير المقروء ضمن قائمة إشعارات */
export function countUnread(list: Announcement[], read: Set<string>): number {
  return list.filter((n) => !read.has(n.id)).length;
}

/** تجميع الإشعارات بحسب التاريخ: اليوم / أمس / هذا الأسبوع / أقدم */
export function groupByDate(list: Announcement[]): {
  label: string;
  items: Announcement[];
}[] {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const dayMs = 86400000;
  const buckets: Record<string, Announcement[]> = {
    today: [],
    yesterday: [],
    week: [],
    older: [],
  };
  for (const n of list) {
    const t = new Date(n.createdAt).getTime();
    if (t >= startOfToday) buckets.today.push(n);
    else if (t >= startOfToday - dayMs) buckets.yesterday.push(n);
    else if (t >= startOfToday - 7 * dayMs) buckets.week.push(n);
    else buckets.older.push(n);
  }
  const labels: [string, string][] = [
    ["today", "اليوم"],
    ["yesterday", "أمس"],
    ["week", "هذا الأسبوع"],
    ["older", "أقدم"],
  ];
  return labels
    .map(([k, label]) => ({ label, items: buckets[k] }))
    .filter((g) => g.items.length > 0);
}
