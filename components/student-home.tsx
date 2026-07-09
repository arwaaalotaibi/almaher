"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  actions,
  autoNotifsFor,
  buildSchedule,
  CoursePlan,
  countUnread,
  currentSessionIndex,
  dateKey,
  EMPTY_PLAN,
  formatSchedDate,
  getReadIds,
  recitePartLabel,
  halaqaTitle,
  hifzStartLabel,
  normalizeDigits,
  PLAN_FIELDS,
  segDateLabel,
  STUDENT_PICK_KEY,
  todaySegment,
  useApp,
  visibleAnnouncements,
  type Student,
} from "@/lib/store";
import { ayahCount, SURAHS } from "@/lib/surahs";
import { TERMS, TERMS_SUBTITLE, TERMS_TITLE, TERMS_VERSION } from "@/lib/terms";
import { printHifzSchedule } from "@/lib/print-schedule";

const ar = (n: number) => n.toLocaleString("ar-EG");
import Link from "next/link";
import { Field, inputCls, PrimaryBtn, Ribbon } from "./ui";
import { NotificationsCenter, PinnedNotice } from "./notifications-card";
import { PushToggle } from "./push-toggle";
import { ReciteLogger, SessionVerdictChip, VerdictChip } from "./recite-log";
import { MotivationPanel } from "./motivation-panel";
import { computeProgress, partVerdict, sessionVerdict } from "@/lib/progress";

/** شاشة الطالبة: تدخل برمزها فتُعرض أهدافها مباشرة (قراءة فقط) */
// تبويبات صفحة الطالبة (التجويد لاحقاً)
const STUDENT_TABS = [
  { key: "reading", icon: "📖", label: "القراءة" },
  { key: "quran", icon: "🕋", label: "القرآن" },
  { key: "notifications", icon: "🔔", label: "الإشعارات" },
] as const;
type StudentTab = (typeof STUDENT_TABS)[number]["key"];

export function StudentHome() {
  const { halaqas, teachers, students, books, announcements, recitations } =
    useApp();
  const [myId, setMyId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<StudentTab>("reading");
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMyId(window.localStorage.getItem(STUDENT_PICK_KEY));
    setReadIds(getReadIds());
    setReady(true);
  }, []);

  // تحديث «آخر ظهور» عند فتح التطبيق
  useEffect(() => {
    if (myId) actions.touchSeen(myId);
  }, [myId]);

  if (!ready) return <main className="mx-auto max-w-2xl px-4 pt-10" />;

  const me = students.find((s) => s.id === myId);

  const logout = async () => {
    window.localStorage.removeItem(STUDENT_PICK_KEY);
    await supabase.auth.signOut();
    window.location.reload();
  };

  // رمز لم يعد له بيانات (حُذفت الطالبة مثلاً)
  if (!me) {
    return (
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-10">
        <div className="card mx-auto max-w-sm rounded-3xl p-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="الماهر" className="mx-auto mb-3 h-16 w-auto" />
          <p className="text-3xl">🔑</p>
          <p className="mt-2 font-kufi font-bold text-plum-800">
            لم نجد بياناتك
          </p>
          <p className="mt-1 text-sm text-silver-600">
            تواصلي مع الإدارة للحصول على رمزك، ثم أدخليه من جديد
          </p>
          <button
            type="button"
            onClick={logout}
            className="mt-5 text-sm font-bold text-plum-700 underline"
          >
            الدخول برمز آخر
          </button>
        </div>
      </main>
    );
  }

  // إقرار اللائحة: لا تدخل الطالبة قبل أن تقرّ بجميع البنود
  if (me.agreedVersion !== TERMS_VERSION) {
    return <TermsGate student={me} onLogout={logout} />;
  }

  const halaqa = halaqas.find((h) => h.id === me.halaqaId);
  const teacher = teachers.find((t) => t.id === me.teacherId);
  const schedule = halaqa ? buildSchedule(halaqa, me.plan) : null;
  const prog = computeProgress(me, recitations, halaqa);
  const logFor = (d: Date) =>
    recitations.find((r) => r.studentId === me.id && r.date === dateKey(d));

  const myHalaqaIds = me.halaqaId ? [me.halaqaId] : [];
  const notifList = visibleAnnouncements(announcements, myHalaqaIds);
  const smartNotifs = autoNotifsFor(me, halaqa, books);
  const unreadNotifs =
    countUnread(notifList, readIds) +
    smartNotifs.filter((s) => !readIds.has(s.id)).length;
  const curIdx = schedule ? currentSessionIndex(schedule) : 0;
  const passed = schedule ? (curIdx > 0 ? curIdx - 1 : schedule.length) : 0;
  const totalFaces =
    (me.plan?.hifz ?? 0) + (me.plan?.tathbit ?? 0) + (me.plan?.murajaah ?? 0);
  const updatedLabel = me.updatedAt
    ? new Date(me.updatedAt).toLocaleDateString("ar-u-ca-gregory-nu-arab", {
        day: "numeric",
        month: "long",
      })
    : null;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-10">
      <WelcomeSplash name={me.name} />
      <div className="mb-4 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="الماهر" className="mx-auto mb-3 h-16 w-auto" />
        <h1 className="font-kufi text-3xl font-bold text-plum-800">{me.name}</h1>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
          {halaqa && (
            <span className="rounded-lg bg-plum-100 px-2.5 py-0.5 text-xs font-bold text-plum-700">
              🕌 {halaqaTitle(halaqa)}
            </span>
          )}
          {teacher && (
            <span className="rounded-lg bg-plum-100 px-2.5 py-0.5 text-xs font-bold text-plum-700">
              👩‍🏫 المعلّمة {teacher.name}
            </span>
          )}
        </p>
      </div>

      <PinnedNotice
        halaqaIds={myHalaqaIds}
        onOpen={() => setTab("notifications")}
      />

      {/* شريط التبويبات */}
      <div className="mb-6 flex gap-1.5 rounded-2xl bg-cream p-1.5">
        {STUDENT_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 font-kufi text-base font-bold transition ${
              tab === t.key
                ? "bg-plum-600 text-white shadow"
                : "text-silver-600"
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
            {t.key === "notifications" && unreadNotifs > 0 && (
              <span className="absolute end-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {ar(unreadNotifs)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* شاشة القراءة */}
      {tab === "reading" && (
        <section>
          {books.length === 0 ? (
            <div className="card rounded-2xl p-8 text-center">
              <p className="text-3xl">📚</p>
              <p className="mt-2 font-kufi font-bold text-plum-800">
                لا توجد كتب قراءة بعد
              </p>
              <p className="mt-1 text-sm text-silver-600">
                ستظهر هنا الكتب التي تضيفها الإدارة
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {books.map((b) => {
                const ts = todaySegment(b.readingPlan);
                return (
                  <div key={b.id} className="overflow-hidden rounded-xl">
                    <Link
                      href={`/book/${b.id}`}
                      className="name-box flex items-center gap-3 rounded-xl px-5 py-4 text-start transition active:scale-[0.99]"
                    >
                      <span className="text-2xl">📖</span>
                      <span className="font-kufi text-lg font-semibold text-white">
                        {b.title}
                      </span>
                    </Link>
                    {ts && (
                      <div
                        className={`mt-1.5 rounded-xl px-4 py-2.5 text-sm ${
                          ts.when === "today"
                            ? "bg-plum-600 text-white"
                            : "bg-plum-50 text-plum-800"
                        }`}
                      >
                        {ts.seg.isExam ? (
                          <span className="font-bold">
                            📝 {ts.when === "today" ? "اليوم اختبار!" : "اختبار"}{" "}
                            <span className="font-normal opacity-90">
                              — {segDateLabel(ts.seg.date)}
                            </span>
                          </span>
                        ) : (
                          <span className="font-bold">
                            📅 {ts.when === "today" ? "مهمة اليوم" : "التالي"}:
                            صفحات {ar(ts.seg.fromPage)}–{ar(ts.seg.toPage)}{" "}
                            <span className="font-normal opacity-80">
                              ({segDateLabel(ts.seg.date)})
                            </span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* شاشة القرآن */}
      {tab === "quran" && (
        <section>
          {/* لوحة التحفيز — رحلتي مع القرآن */}
          <MotivationPanel student={me} halaqa={halaqa} />

          {/* الطالبة تُدخل بداية الحفظ/المراجعة وأوجه اللقاء بنفسها */}
          <MyPlanEditor student={me} />

          {/* سجلّ التسميع بعد كل لقاء */}
          <ReciteLogger student={me} halaqa={halaqa} />

          {/* خطة الفصل — جدول مولّد تلقائياً */}
          {schedule ? (
            <>
              <Ribbon className="mb-4 mt-8">خطة الفصل</Ribbon>

              <button
                type="button"
                onClick={() =>
                  printHifzSchedule({
                    studentName: me.name,
                    halaqaLabel: halaqa ? halaqaTitle(halaqa) : "",
                    startLabel: hifzStartLabel(me.plan),
                    schedule,
                  })
                }
                className="mb-3 w-full rounded-xl bg-plum-600 py-2.5 font-kufi text-sm font-bold text-white transition active:scale-[0.98]"
              >
                🖨️ طباعة جدولي
              </button>

              {/* التقدّم في الفصل */}
              <div className="card mb-3 rounded-2xl p-4">
                <div className="mb-1 flex items-center justify-between text-sm font-bold">
                  <span className="text-plum-800">📅 لقاءات الفصل</span>
                  <span className="text-plum-700">
                    {ar(passed)} / {ar(schedule.length)}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-cream-dark">
                  <div
                    className="h-full rounded-full bg-plum-600"
                    style={{ width: `${(passed / schedule.length) * 100}%` }}
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  {[
                    { l: "حفظ", v: me.plan.hifz, i: "📖" },
                    { l: "مراجعة", v: me.plan.murajaah, i: "🔁" },
                  ].map((x) => (
                    <div key={x.l} className="rounded-xl bg-plum-50 py-2">
                      <p className="text-lg font-bold text-plum-800">
                        {ar(x.v ?? 0)}
                      </p>
                      <p className="text-[11px] font-bold text-silver-600">
                        {x.i} {x.l} (وجه)
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* مطلوب اللقاء القادم */}
              {curIdx > 0 ? (
                (() => {
                  const s = schedule[curIdx - 1];
                  return (
                    <div className="mb-3 rounded-2xl border-2 border-plum-500 bg-plum-50 p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-kufi text-base font-bold text-plum-800">
                          📌 مطلوب اللقاء القادم
                        </span>
                        <span className="rounded-full bg-plum-600 px-2.5 py-0.5 text-xs font-bold text-white">
                          لقاء {ar(s.n)} · {formatSchedDate(s.date)}
                        </span>
                      </div>
                      <div className="mt-3 rounded-xl bg-white p-3 text-center shadow-sm">
                        <p className="text-[11px] font-bold text-silver-600">
                          📖 الحفظ الجديد (من حيث وصلتِ فعلاً)
                        </p>
                        <p className="mt-0.5 font-kufi text-lg font-bold text-plum-800">
                          {prog.nextHifzLabel ||
                            s.hifzLabel ||
                            (s.hifz ? `${ar(s.hifz)} أوجه` : "—")}
                        </p>
                        {prog.currentTasmiLabel && (
                          <p className="mt-1 text-[10px] font-bold text-silver-500">
                            📍 آخر ما حفظتِ: {prog.currentTasmiLabel}
                          </p>
                        )}
                      </div>
                      <div className="mt-2 rounded-xl bg-white p-3 text-center">
                        <p className="text-[11px] font-bold text-silver-600">
                          🔁 المراجعة (من حيث وصلتِ فعلاً)
                        </p>
                        <p className="mt-0.5 font-kufi text-lg font-bold text-plum-700">
                          {prog.nextMurLabel ||
                            s.murajaahLabel ||
                            (s.murajaah ? `${ar(s.murajaah)} أوجه` : "—")}
                        </p>
                        {prog.currentMurLabel && (
                          <p className="mt-1 text-[10px] font-bold text-silver-500">
                            📍 آخر ما راجعتِ: {prog.currentMurLabel}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="mb-3 rounded-2xl bg-plum-50 p-4 text-center font-kufi text-sm font-bold text-plum-700">
                  🎉 اكتمل الفصل — أحسنتِ!
                </div>
              )}

              {/* جدول اللقاءات كاملاً */}
              <div className="grid gap-1.5">
                {schedule.map((s) => {
                  const isCur = s.n === curIdx;
                  const log = logFor(s.date);
                  const att = !!log?.attended;
                  const tasmiLabel = log ? recitePartLabel(log.tasmi) : "";
                  const thLabel = log ? recitePartLabel(log.tathbit) : "";
                  const murLabel = log ? recitePartLabel(log.muraja) : "";
                  // حكم كل قسم: أنجزت المطلوب / زادت / ناقص
                  const vH = att && log ? partVerdict(log.tasmi, s.hifz) : null;
                  const vT = att && log ? partVerdict(log.tathbit, s.tathbit) : null;
                  const vM = att && log ? partVerdict(log.muraja, s.murajaah) : null;
                  const overall = att && log ? sessionVerdict(log, s) : null;
                  return (
                    <div
                      key={s.n}
                      className={`rounded-xl px-3 py-2.5 ${
                        isCur ? "bg-plum-600 text-white" : "card"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span
                          className={`flex items-center gap-1.5 font-bold ${isCur ? "text-white" : "text-plum-700"}`}
                        >
                          لقاء {ar(s.n)}
                          {log && !log.attended && (
                            <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] text-white">
                              غائبة
                            </span>
                          )}
                          <SessionVerdictChip status={overall} />
                        </span>
                        <span className={isCur ? "text-white/85" : "text-silver-600"}>
                          {formatSchedDate(s.date)}
                        </span>
                      </div>
                      {log && !log.attended ? (
                        <p
                          className={`mt-0.5 text-sm font-bold ${isCur ? "text-white/90" : "text-amber-700"}`}
                        >
                          🚫 غائبة في هذا اللقاء
                        </p>
                      ) : (
                        <>
                          <p
                            className={`mt-0.5 font-kufi text-sm font-bold ${
                              isCur ? "text-white" : "text-plum-800"
                            }`}
                          >
                            📖{" "}
                            {tasmiLabel
                              ? `سُمّع: ${tasmiLabel}`
                              : s.hifzLabel ||
                                (s.hifz ? `${ar(s.hifz)} أوجه` : "—")}{" "}
                            <VerdictChip v={vH} />
                          </p>
                          {(s.tathbit > 0 || thLabel) && (
                            <p
                              className={`text-[11px] ${
                                isCur ? "text-white/85" : "text-silver-600"
                              }`}
                            >
                              📌 تثبيت{" "}
                              {att && thLabel
                                ? `سُمّع: ${thLabel}`
                                : s.tathbitLabel ||
                                  (s.tathbit ? `${ar(s.tathbit)} أوجه` : "—")}{" "}
                              <VerdictChip v={vT} />
                            </p>
                          )}
                          <p
                            className={`text-[11px] ${
                              isCur ? "text-white/85" : "text-silver-600"
                            }`}
                          >
                            🔁 مراجعة{" "}
                            {att && murLabel
                              ? `سُمّع: ${murLabel}`
                              : s.murajaahLabel ||
                                (s.murajaah ? `${ar(s.murajaah)} أوجه` : "—")}{" "}
                            <VerdictChip v={vM} />
                          </p>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : totalFaces > 0 ? (
            <>
              <Ribbon className="mb-4 mt-8">خطة الفصل</Ribbon>
              <div className="card rounded-2xl p-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  {PLAN_FIELDS.map((f) => (
                    <div key={f.key} className="rounded-xl bg-plum-50 py-2">
                      <p className="text-lg font-bold text-plum-800">
                        {ar(me.plan[f.key] ?? 0)}
                      </p>
                      <p className="text-[11px] font-bold text-silver-600">
                        {f.icon} {f.label.replace("أوجه ", "")}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-center text-xs text-silver-600">
                  لم تُحدَّد مواعيد الفصل بعد — سيظهر الجدول فور تحديدها
                </p>
              </div>
            </>
          ) : null}

          {updatedLabel && (
            <p className="mt-6 text-center text-xs text-silver-600">
              آخر تحديث: {updatedLabel}
            </p>
          )}
        </section>
      )}

      {/* شاشة الإشعارات — الأرشيف كاملاً */}
      {tab === "notifications" && (
        <section>
          <PushToggle studentId={me.id} halaqaId={me.halaqaId} />
          <NotificationsCenter
            halaqaIds={myHalaqaIds}
            smart={smartNotifs}
            studentId={me.id}
            onRead={() => setReadIds(getReadIds())}
          />
        </section>
      )}

      <button
        type="button"
        onClick={logout}
        className="mx-auto mt-10 block text-sm font-bold text-silver-600 underline"
      >
        🚪 تسجيل الخروج
      </button>
    </main>
  );
}

/** عبارات ترحيب تتبدّل عند كل دخول */
const WELCOME_PHRASES = [
  "طوبى لكِ يا حاملة القرآن",
  "«خَيْرُكُم مَن تَعَلَّمَ القُرآنَ وعَلَّمَه»",
  "نوّرتِ الماهر ✨",
  "بوركتِ وبورك سعيكِ في حفظ كتاب الله",
];

/** شاشة ترحيب لطيفة تظهر لحظةً عند كل دخول للحافظة ثم تختفي */
function WelcomeSplash({ name }: { name: string }) {
  const [show, setShow] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [phrase] = useState(
    () => WELCOME_PHRASES[Math.floor(Math.random() * WELCOME_PHRASES.length)]
  );

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 2200);
    const t2 = setTimeout(() => setShow(false), 2750);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      onClick={() => setLeaving(true)}
      className={`fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-cream px-6 text-center transition-opacity duration-500 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="welcome-in flex flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="الماهر" className="h-20 w-auto" />
        <p className="font-kufi text-lg font-bold text-plum-600">حيّاكِ الله</p>
        <h1 className="font-kufi text-3xl font-bold text-plum-800">{name} 🌸</h1>
        <p className="mt-1 max-w-xs font-body text-base leading-relaxed text-plum-700">
          {phrase}
        </p>
      </div>
    </div>
  );
}

/** شاشة إقرار اللائحة: تقرّ الطالبة بكل بند قبل الدخول */
function TermsGate({
  student,
  onLogout,
}: {
  student: Student;
  onLogout: () => void;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const doneCount = Object.values(checked).filter(Boolean).length;
  const allDone = doneCount >= TERMS.length;

  const agree = () => {
    if (!allDone) return;
    actions.updateStudent(student.id, {
      agreedAt: new Date().toISOString(),
      agreedVersion: TERMS_VERSION,
    });
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pb-32 pt-10">
      <div className="mb-5 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="الماهر" className="mx-auto mb-3 h-16 w-auto" />
        <h1 className="font-kufi text-xl font-bold leading-snug text-plum-800">
          {TERMS_TITLE}
        </h1>
        <p className="mt-1 text-sm font-bold text-plum-600">{TERMS_SUBTITLE}</p>
        <p className="mt-3 rounded-xl bg-plum-50 px-4 py-2.5 text-sm font-bold text-plum-700">
          مرحباً {student.name} 🌸 — قبل الدخول، اطّلعي على اللائحة وأقرّي بكل بند
        </p>
      </div>

      <div className="grid gap-3">
        {TERMS.map((sec) => {
          const on = !!checked[sec.title];
          return (
            <div
              key={sec.title}
              className={`card rounded-2xl p-4 transition ${
                on ? "border-plum-500 bg-plum-50" : ""
              }`}
            >
              <p className="mb-2 font-kufi text-base font-bold text-plum-800">
                {sec.icon} {sec.title}
              </p>
              <ul className="mb-3 grid list-disc gap-1.5 pe-5 ps-1">
                {sec.items.map((item, i) => (
                  <li
                    key={i}
                    className="text-sm font-medium leading-relaxed text-ink marker:text-plum-500"
                  >
                    {item}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() =>
                  setChecked((c) => ({ ...c, [sec.title]: !c[sec.title] }))
                }
                className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start transition ${
                  on
                    ? "border-plum-600 bg-white"
                    : "border-cream-dark bg-white"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 text-xs font-bold ${
                    on
                      ? "border-plum-600 bg-plum-600 text-white"
                      : "border-silver-400 text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span className="text-sm font-bold text-plum-700">
                  أقرّ والتزم ببنود «{sec.title}»
                </span>
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onLogout}
        className="mx-auto mt-6 block text-sm font-bold text-silver-600 underline"
      >
        الدخول برمز آخر
      </button>

      {/* شريط الإقرار الثابت أسفل الشاشة */}
      <div className="glass-bar fixed inset-x-0 bottom-0 z-40 px-4 py-3">
        <div className="mx-auto max-w-2xl">
          <p className="mb-2 text-center text-xs font-bold text-plum-700">
            أقررتِ بـ {ar(doneCount)} من {ar(TERMS.length)} أقسام
          </p>
          <PrimaryBtn
            onClick={agree}
            className={allDone ? "" : "opacity-40"}
          >
            {allDone ? "أوافق وألتزم بجميع البنود" : "أقرّي بكل الأقسام للمتابعة"}
          </PrimaryBtn>
        </div>
      </div>
    </main>
  );
}

/** نموذج تُدخل فيه الطالبة بداية الحفظ/المراجعة وأوجه كل لقاء بنفسها */
function MyPlanEditor({ student }: { student: Student }) {
  const [plan, setPlan] = useState<CoursePlan>({ ...EMPTY_PLAN, ...student.plan });
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);

  // مزامنة إن عدّلت الإدارة البيانات من جهاز آخر
  useEffect(() => {
    setPlan({ ...EMPTY_PLAN, ...student.plan });
  }, [student.plan]);

  const planNum = (v: string) => Math.max(0, Number(normalizeDigits(v)) || 0);

  const save = () => {
    actions.updateStudent(student.id, { plan });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="card mb-4 rounded-2xl p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-start"
        aria-expanded={open}
      >
        <span className="font-kufi text-base font-bold text-plum-800">
          📝 بيانات حفظي
        </span>
        <span
          className={`text-plum-600 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {!open ? null : (
      <div className="mt-3">
      {/* بداية الحفظ */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="بداية الحفظ — السورة" icon="📖">
          <select
            className={inputCls}
            value={plan.startSurah ?? ""}
            onChange={(e) =>
              setPlan({ ...plan, startSurah: e.target.value, startAyah: 1 })
            }
          >
            <option value="">اختاري السورة…</option>
            {SURAHS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="رقم الآية" icon="🔢">
          <select
            className={inputCls}
            value={plan.startAyah ?? 1}
            onChange={(e) => setPlan({ ...plan, startAyah: Number(e.target.value) })}
            disabled={!plan.startSurah}
          >
            {Array.from(
              { length: Math.max(1, ayahCount(plan.startSurah ?? "")) },
              (_, i) => i + 1
            ).map((n) => (
              <option key={n} value={n}>
                {ar(n)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* بداية المراجعة */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="بداية المراجعة — السورة" icon="🔁">
          <select
            className={inputCls}
            value={plan.murStartSurah ?? ""}
            onChange={(e) =>
              setPlan({ ...plan, murStartSurah: e.target.value, murStartAyah: 1 })
            }
          >
            <option value="">اختاري السورة…</option>
            {SURAHS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="رقم الآية" icon="🔢">
          <select
            className={inputCls}
            value={plan.murStartAyah ?? 1}
            onChange={(e) =>
              setPlan({ ...plan, murStartAyah: Number(e.target.value) })
            }
            disabled={!plan.murStartSurah}
          >
            {Array.from(
              { length: Math.max(1, ayahCount(plan.murStartSurah ?? "")) },
              (_, i) => i + 1
            ).map((n) => (
              <option key={n} value={n}>
                {ar(n)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* أوجه كل لقاء */}
      <div className="mt-1 rounded-2xl border border-cream-dark p-3">
        <p className="mb-2 font-kufi text-sm font-bold text-plum-800">
          📋 أوجه كل لقاء
        </p>
        <div className="grid grid-cols-2 gap-2">
          {PLAN_FIELDS.map(({ key, label, icon }) => (
            <label key={key} className="block">
              <span className="mb-1 block text-xs font-bold text-plum-700">
                {icon} {label.replace("أوجه ", "")}
              </span>
              <input
                className={`${inputCls} text-center`}
                inputMode="numeric"
                placeholder="٠"
                value={plan[key] || ""}
                onChange={(e) =>
                  setPlan({ ...plan, [key]: planNum(e.target.value) })
                }
              />
            </label>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <PrimaryBtn onClick={save}>
          {saved ? "تم الحفظ ✓" : "حفظ بياناتي"}
        </PrimaryBtn>
      </div>
      </div>
      )}
    </div>
  );
}
