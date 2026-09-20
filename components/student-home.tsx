"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  actions,
  autoNotifsFor,
  buildSchedule,
  countUnread,
  currentSessionIndex,
  dateKey,
  formatSchedDate,
  getReadIds,
  isDesc,
  isMurDesc,
  recitePartLabel,
  halaqaTitle,
  hifzStartLabel,
  PLAN_FIELDS,
  segDateLabel,
  STUDENT_PICK_KEY,
  todaySegment,
  useApp,
  needsPlanConfirm,
  visibleAnnouncements,
  type Student,
} from "@/lib/store";
import {
  APP_NOTICE,
  TERMS,
  TERMS_SUBTITLE,
  TERMS_TITLE,
  TERMS_VERSION,
} from "@/lib/terms";
import { printHifzSchedule } from "@/lib/print-schedule";

const ar = (n: number) => n.toLocaleString("ar-EG");
import Link from "next/link";
import { PrimaryBtn, Ribbon, Sheet } from "./ui";
import { TajweedQuiz } from "./tajweed-quiz";
import { ReadingWards } from "./reading-wards";
import { RaceBoard } from "./race-board";
import { SupportBox } from "./support-box";
import { NotificationsCenter, PinnedNotice } from "./notifications-card";
import { PushToggle } from "./push-toggle";
import { AppTour, hasSeenTour } from "./app-tour";
import { BookQuotes } from "./book-quotes";
import { PlanConfirmGate } from "./plan-confirm";
import { ReciteLogger, SessionVerdictChip, VerdictChip } from "./recite-log";
import { MotivationPanel } from "./motivation-panel";
import { computeProgress, partVerdict, sessionVerdict } from "@/lib/progress";
import { facesLabel } from "@/lib/arabic";

/** شاشة الطالبة: تدخل برمزها فتُعرض أهدافها مباشرة (قراءة فقط) */
// تبويبات صفحة الطالبة
const STUDENT_TABS = [
  { key: "reading", icon: "📚", label: "القراءة" },
  { key: "quran", icon: "📖", label: "القرآن" },
  { key: "tajweed", icon: "📿", label: "التجويد" },
  { key: "race", icon: "🏆", label: "السباق" },
] as const;
// الإشعارات شاشة يفتحها جرس أعلى الصفحة (ليست في الشريط)
type StudentTab = (typeof STUDENT_TABS)[number]["key"] | "notifications";

// أقسام تبويب القرآن — كل شاشة خفيفة ومريحة
const QURAN_SECTIONS = [
  { key: "today", icon: "📌", label: "وِردي" },
  { key: "journey", icon: "🧭", label: "رحلتي" },
  { key: "plan", icon: "📅", label: "خطتي" },
] as const;
type QuranSec = (typeof QURAN_SECTIONS)[number]["key"];

export function StudentHome() {
  const {
    halaqas,
    teachers,
    students,
    books,
    announcements,
    recitations,
    terms,
    tajweed,
    tajweedResults,
    settings,
    support,
  } = useApp();
  const [myId, setMyId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<StudentTab>("quran");
  const [quranSec, setQuranSec] = useState<QuranSec>("today");
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [quizFor, setQuizFor] = useState<string | null>(null); // درس الأسئلة المفتوح
  const [settingsOpen, setSettingsOpen] = useState(false); // ورقة الإعدادات ⚙️
  const [tourOpen, setTourOpen] = useState(false); // شرح البرنامج

  useEffect(() => {
    setMyId(window.localStorage.getItem(STUDENT_PICK_KEY));
    setReadIds(getReadIds());
    setReady(true);
  }, []);

  // تحديث «آخر ظهور» عند فتح التطبيق
  useEffect(() => {
    if (myId) actions.touchSeen(myId);
  }, [myId]);

  // التبويبات الظاهرة (الإدارة قد تخفي القراءة/التجويد مؤقتاً)
  const visibleTabs = STUDENT_TABS.filter(
    (t) =>
      !(t.key === "reading" && settings.hideReading) &&
      !(t.key === "tajweed" && settings.hideTajweed)
  );
  const tabHidden =
    (tab === "reading" && settings.hideReading) ||
    (tab === "tajweed" && settings.hideTajweed);
  useEffect(() => {
    if (tabHidden) setTab("quran");
  }, [tabHidden]);

  // شرح البرنامج يظهر تلقائياً أول مرة على هذا الجهاز — بعد إقرار اللائحة
  const agreed =
    students.find((s) => s.id === myId)?.agreedVersion === TERMS_VERSION;
  useEffect(() => {
    if (ready && agreed && !hasSeenTour()) setTourOpen(true);
  }, [ready, agreed]);

  if (!ready) return <main className="mx-auto max-w-2xl px-4 pt-10" />;

  const me = students.find((s) => s.id === myId);

  const logout = async () => {
    window.localStorage.removeItem(STUDENT_PICK_KEY);
    // فكّ ربط هذا الجهاز بالطالبة قبل إنهاء الجلسة
    try {
      await supabase.rpc("almaher_unclaim");
    } catch {
      /* بدون إنترنت — الجلسة تنتهي محلياً على كل حال */
    }
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

  // 🚪 منسحبة: شاشة توضيح فقط
  if (me.plan?.withdrawnAt) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center px-4 py-10 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="الماهر" className="mb-4 h-16 w-auto" />
        <h1 className="font-kufi text-xl font-bold text-plum-800">{me.name} 🌸</h1>
        <p className="mt-3 rounded-2xl bg-cream px-5 py-4 text-sm font-bold text-plum-700">
          تم تسجيل انسحابكِ من الحلقة. نسأل الله أن يبارك فيكِ وييسّر لكِ العودة.
          <span className="mt-1 block text-xs font-medium text-silver-600">للعودة تواصلي مع الإدارة</span>
        </p>
        <button type="button" onClick={logout} className="mt-5 text-sm font-bold text-plum-700 underline">
          الدخول برمز آخر
        </button>
      </main>
    );
  }

  // إقرار اللائحة: لا تدخل الطالبة قبل أن تقرّ بجميع البنود
  if (me.agreedVersion !== TERMS_VERSION) {
    return <TermsGate student={me} onLogout={logout} />;
  }

  const halaqa = halaqas.find((h) => h.id === me.halaqaId);
  const teacher = teachers.find((t) => t.id === me.teacherId);

  // تأكيد خطة الفصل: مرة في بداية كل فصل (بعد اللائحة وقبل الدخول)
  if (halaqa && needsPlanConfirm(me, halaqa, support)) {
    return <PlanConfirmGate student={me} halaqa={halaqa} onLogout={logout} />;
  }
  const schedule = halaqa ? buildSchedule(halaqa, me.plan) : null;
  const prog = computeProgress(me, recitations, halaqa);
  const logFor = (d: Date) =>
    recitations.find((r) => r.studentId === me.id && r.date === dateKey(d));

  const myHalaqaIds = me.halaqaId ? [me.halaqaId] : [];
  const notifList = visibleAnnouncements(announcements, myHalaqaIds);
  const smartNotifs = autoNotifsFor(me, halaqa, books, recitations);
  const unreadNotifs =
    countUnread(notifList, readIds) +
    smartNotifs.filter((s) => !readIds.has(s.id)).length;
  const curIdx = schedule
    ? currentSessionIndex(
        schedule,
        recitations.filter((r) => r.studentId === me.id)
      )
    : 0;
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
    <main className="relative mx-auto max-w-2xl px-4 pb-16 pt-10">
      <WelcomeSplash name={me.name} />

      {/* 🎓 شرح البرنامج — أول مرة تلقائياً، ثم من الإعدادات */}
      <AppTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        hidden={{ reading: settings.hideReading, tajweed: settings.hideTajweed }}
      />

      {/* ⚙️ الإعدادات — في الطرف الآخر من الجرس */}
      <button
        type="button"
        onClick={() => setSettingsOpen(true)}
        aria-label="الإعدادات"
        className="absolute right-4 top-6 flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl shadow ring-1 ring-cream-dark transition active:scale-95"
      >
        ⚙️
      </button>
      <Sheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="⚙️ الإعدادات"
      >
        <div className="grid gap-2">
          <button
            type="button"
            onClick={() => {
              setSettingsOpen(false);
              setTourOpen(true);
            }}
            className="card flex items-center gap-3 rounded-2xl px-4 py-3.5 text-start transition active:scale-[0.99]"
          >
            <span className="text-2xl">🎓</span>
            <span>
              <span className="block font-kufi font-bold text-plum-800">
                شرح البرنامج
              </span>
              <span className="block text-xs text-silver-600">
                جولة سريعة في شاشات التطبيق وما يقدّمه لكِ
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSettingsOpen(false);
              setTab("notifications");
            }}
            className="card flex items-center gap-3 rounded-2xl px-4 py-3.5 text-start transition active:scale-[0.99]"
          >
            <span className="text-2xl">🔔</span>
            <span>
              <span className="block font-kufi font-bold text-plum-800">
                إشعارات الجهاز
              </span>
              <span className="block text-xs text-silver-600">
                تفعيلها أو إيقافها من شاشة الإشعارات
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={logout}
            className="mt-2 w-full rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-bold text-red-700 transition active:scale-[0.98]"
          >
            🚪 تسجيل الخروج من هذا الجهاز
          </button>
        </div>
      </Sheet>

      {/* 🔔 الإشعارات — جرس في الطرف العلوي */}
      <button
        type="button"
        onClick={() => setTab("notifications")}
        aria-label="الإشعارات"
        className={`absolute left-4 top-6 flex h-11 w-11 items-center justify-center rounded-full text-xl shadow ring-1 transition active:scale-95 ${
          tab === "notifications"
            ? "bg-plum-600 ring-plum-600"
            : "bg-white ring-cream-dark"
        }`}
      >
        🔔
        {unreadNotifs > 0 && (
          <span className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {ar(unreadNotifs)}
          </span>
        )}
      </button>

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
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-xl px-0.5 py-2 font-kufi text-[11px] font-bold transition ${
              tab === t.key
                ? "bg-plum-600 text-white shadow"
                : "text-silver-600"
            }`}
          >
            <span className="text-lg leading-none">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* شاشة القراءة */}
      {tab === "reading" && !settings.hideReading && (
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

                    {/* أوراد القراءة: «تم ✓» + اختبار كل قسم */}
                    <ReadingWards book={b} studentId={me.id} />
                  </div>
                );
              })}
            </div>
          )}

          {/* 💬 اقتباسات الطالبات من الكتب — خلاصة مشتركة مع إعجابات */}
          {books.length > 0 && (
            <div className="mt-8">
              <BookQuotes studentId={me.id} books={books} />
            </div>
          )}
        </section>
      )}

      {/* شاشة القرآن */}
      {tab === "quran" && (
        <section>
          {/* أقسام القرآن — تخفيف الازدحام: كل شاشة تعرض القليل المريح */}
          <div className="mb-4 flex gap-1 rounded-2xl bg-cream p-1">
            {QURAN_SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setQuranSec(s.key)}
                className={`flex flex-1 items-center justify-center gap-1 rounded-xl py-2 font-kufi text-sm font-bold transition ${
                  quranSec === s.key
                    ? "bg-white text-plum-800 shadow-sm"
                    : "text-silver-600"
                }`}
              >
                <span>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>

          {quranSec === "today" && (
            <>
          {/* ترحيب بالفصل الجديد — يظهر حتى أول تسجيل تسميع فيه */}
          {(() => {
            const wasArchived = terms.some((t) =>
              t.students.some((x) => x.id === me.id)
            );
            const loggedThisTerm =
              !!halaqa?.termStart &&
              recitations.some(
                (r) => r.studentId === me.id && r.date >= halaqa.termStart
              );
            const startLbl = hifzStartLabel(me.plan);
            if (!(wasArchived && schedule && curIdx >= 1 && !loggedThisTerm))
              return null;
            return (
              <div
                className="mb-4 rounded-2xl p-4 text-center text-white shadow"
                style={{ background: "linear-gradient(135deg,#5d3f4e,#8a5d75)" }}
              >
                <p className="text-2xl">🌱</p>
                <p className="mt-0.5 font-kufi text-base font-bold">
                  فصل جديد، همّة جديدة!
                </p>
                <p className="mt-1 text-sm text-white/90">
                  {startLbl
                    ? `تنطلقين هذا الفصل من ${startLbl} — تماماً من حيث وقفتِ 💪`
                    : "رحلة جديدة تبدأ — واصلي من حيث وقفتِ 💪"}
                </p>
              </div>
            );
          })()}

          {/* مطلوب اللقاء القادم — أهم ما تحتاجه الطالبة اليوم */}
          {schedule &&
            (curIdx > 0 ? (
              (() => {
                const s = schedule[curIdx - 1];
                return (
                  <div className="mb-4 rounded-2xl border-2 border-plum-500 bg-plum-50 p-4">
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
                          (s.hifz ? facesLabel(s.hifz) : "—")}
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
                          (s.murajaah ? facesLabel(s.murajaah) : "—")}
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
              <div className="mb-4 rounded-2xl bg-plum-50 p-4 text-center font-kufi text-sm font-bold text-plum-700">
                🎉 اكتمل الفصل — أحسنتِ!
              </div>
            ))}

          {/* مسمّعي — تحفيظ الورد بالاستماع والتكرار */}
          <Link
            href="/memorize"
            className="mb-4 flex items-center gap-3 rounded-2xl p-4 text-white shadow transition active:scale-[0.99]"
            style={{ background: "linear-gradient(135deg,#5d3f4e,#8a5d75)" }}
          >
            <span className="text-3xl">🎧</span>
            <span className="min-w-0 flex-1">
              <span className="block font-kufi text-base font-bold">
                مسمّعي — احفظي وردك بالتكرار
              </span>
              <span className="mt-0.5 block truncate text-xs text-white/85">
                {prog.nextHifzLabel
                  ? `وردك القادم: ${prog.nextHifzLabel}`
                  : "استمعي آيةً آية وردّدي حتى يثبت الحفظ"}
              </span>
            </span>
            <span className="text-xl text-white/70">‹</span>
          </Link>

          {/* سجلّ التسميع بعد كل لقاء — يظهر فقط إن كانت الطالبة هي من تسجّل */}
          {settings.studentRecite && <ReciteLogger student={me} halaqa={halaqa} />}
            </>
          )}

          {/* رحلتي — الخريطة والتحفيز كاملاً */}
          {quranSec === "journey" && (
            <MotivationPanel student={me} halaqa={halaqa} />
          )}


          {quranSec === "plan" && (
            <>
          {/* الطالبة تُدخل بداية الحفظ/المراجعة وأوجه اللقاء بنفسها */}
          {/* الخطة تُدخلها الإدارة — الطالبة تراها فقط (بلا تعديل) */}

          {/* خطة الفصل — جدول مولّد تلقائياً */}
          {schedule ? (
            <>
              <Ribbon className="mb-4 mt-2">خطة الفصل</Ribbon>

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

              {/* جدول اللقاءات كاملاً */}
              <div className="grid gap-1.5">
                {schedule.map((s) => {
                  const isCur = s.n === curIdx;
                  const log = logFor(s.date);
                  const att = !!log?.attended;
                  const tasmiLabel = log ? recitePartLabel(log.tasmi) : "";
                  const thLabel = log ? recitePartLabel(log.tathbit) : "";
                  const md = isMurDesc(me.plan);
                  const murLabel = log ? recitePartLabel(log.muraja) : "";
                  // اللقاءات القادمة: المقطع مُسقَط من الموضع الفعلي (كالبطاقة)
                  const pj = !log ? prog.projected[s.n] : undefined;
                  const hifzPlan = pj?.hifzLabel || s.hifzLabel;
                  const tathbitPlan = pj?.tathbitLabel || s.tathbitLabel;
                  const murPlan = pj?.murajaahLabel || s.murajaahLabel;
                  // حكم كل قسم: أنجزت المطلوب / زادت / ناقص
                  const d = isDesc(me.plan);
                  const vH = att && log ? partVerdict(log.tasmi, s.hifz, d) : null;
                  const vT = att && log ? partVerdict(log.tathbit, s.tathbit, d) : null;
                  const vM = att && log ? partVerdict(log.muraja, s.murajaah, md, "muraja") : null;
                  const overall = att && log ? sessionVerdict(log, s, d, md) : null;
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
                          🚫 كنتِ غائبة في هذا اللقاء
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
                              ? `سمّعتِ: ${tasmiLabel}`
                              : hifzPlan ||
                                (s.hifz ? facesLabel(s.hifz) : "—")}{" "}
                            <VerdictChip v={vH} />
                          </p>
                          {(s.tathbit > 0 || thLabel || tathbitPlan) && (
                            <p
                              className={`text-[11px] ${
                                isCur ? "text-white/85" : "text-silver-600"
                              }`}
                            >
                              📌 تثبيت{" "}
                              {att && thLabel
                                ? `سمّعتِ: ${thLabel}`
                                : tathbitPlan ||
                                  (s.tathbit ? facesLabel(s.tathbit) : "—")}{" "}
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
                              ? `سمّعتِ: ${murLabel}`
                              : murPlan ||
                                (s.murajaah ? facesLabel(s.murajaah) : "—")}{" "}
                            <VerdictChip v={vM} />
                          </p>
                        </>
                      )}
                      {log?.note && (
                        <p className={`mt-1 text-[11px] ${isCur ? "text-white/85" : "text-amber-800"}`}>📝 {log.note}</p>
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
            </>
          )}
        </section>
      )}

      {/* شاشة التجويد — دروس فيديو/PDF مع أسئلة */}
      {tab === "tajweed" && !settings.hideTajweed && (
        <section>
          {tajweed.length === 0 ? (
            <div className="card rounded-2xl p-8 text-center">
              <p className="text-3xl">📿</p>
              <p className="mt-2 font-kufi font-bold text-plum-800">
                لا توجد دروس تجويد حالياً
              </p>
              <p className="mt-1 text-sm text-silver-600">
                ستظهر هنا الدروس التي تضيفها الإدارة
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {tajweed.map((l) => {
                const res = tajweedResults.find(
                  (r) => r.lessonId === l.id && r.studentId === me.id
                );
                return (
                  <div key={l.id} className="overflow-hidden rounded-xl">
                    <Link
                      href={`/tajweed/${l.id}`}
                      className="name-box flex items-center gap-3 rounded-xl px-5 py-4 text-start transition active:scale-[0.99]"
                    >
                      <span className="text-2xl">
                        {l.kind === "video" ? "🎬" : "📄"}
                      </span>
                      <span className="min-w-0 flex-1 font-kufi text-lg font-semibold text-white">
                        {l.title}
                      </span>
                      {res && (
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            res.score === res.total
                              ? "bg-emerald-500 text-white"
                              : "bg-white/20 text-white"
                          }`}
                        >
                          {res.score === res.total ? "🌟 " : "📝 "}
                          {ar(res.score)}/{ar(res.total)}
                        </span>
                      )}
                    </Link>
                    {l.questions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setQuizFor(l.id)}
                        className={`mt-1.5 w-full rounded-xl px-4 py-2.5 text-start text-sm font-bold ${
                          res
                            ? "bg-plum-50 text-plum-800"
                            : "bg-plum-600 text-white"
                        }`}
                      >
                        📝 {res ? "أعيدي حلّ الأسئلة" : "حُلّي أسئلة الدرس"} (
                        {ar(l.questions.length)})
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* أسئلة الدرس في نافذة */}
          <Sheet
            open={quizFor !== null}
            onClose={() => setQuizFor(null)}
            title="📝 أسئلة الدرس"
          >
            {(() => {
              const l = tajweed.find((x) => x.id === quizFor);
              return l ? <TajweedQuiz lesson={l} studentId={me.id} /> : null;
            })()}
          </Sheet>
        </section>
      )}

      {/* شاشة السباق — منافسة على مستوى مسجد الطالبة */}
      {tab === "race" && (
        <section>
          <RaceBoard myId={me.id} defaultMosque={halaqa?.mosque} />
        </section>
      )}

      {/* شاشة الإشعارات — الأرشيف كاملاً */}
      {tab === "notifications" && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-kufi text-lg font-bold text-plum-800">
              🔔 الإشعارات
            </h2>
            <button
              type="button"
              onClick={() => setTab("quran")}
              className="rounded-full bg-cream px-3 py-1.5 text-xs font-bold text-plum-700"
            >
              → رجوع
            </button>
          </div>
          <PushToggle studentId={me.id} halaqaId={me.halaqaId} />
          <NotificationsCenter
            halaqaIds={myHalaqaIds}
            smart={smartNotifs}
            studentId={me.id}
            onRead={() => setReadIds(getReadIds())}
          />
        </section>
      )}

      {/* الدعم الفني والاقتراحات */}
      <SupportBox studentId={me.id} />

      <button
        type="button"
        onClick={logout}
        className="mx-auto mt-4 block text-sm font-bold text-silver-600 underline"
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
  // بعد الإقرار بكل البنود تظهر صفحة «تنبيه بخصوص التطبيق» ثم يُحفظ الإقرار
  const [step, setStep] = useState<"terms" | "notice">("terms");
  const doneCount = Object.values(checked).filter(Boolean).length;
  const allDone = doneCount >= TERMS.length;

  const agree = () => {
    if (!allDone) return;
    setStep("notice");
    window.scrollTo({ top: 0 });
  };

  const confirmNotice = () => {
    actions.updateStudent(student.id, {
      agreedAt: new Date().toISOString(),
      agreedVersion: TERMS_VERSION,
    });
  };

  if (step === "notice") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-4 py-10">
        <div className="mb-5 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="الماهر" className="mx-auto mb-3 h-16 w-auto" />
          <p className="text-sm font-bold text-plum-600">
            ✓ تم الإقرار بجميع بنود اللائحة
          </p>
        </div>

        <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-5">
          <p className="mb-3 text-center font-kufi text-lg font-bold text-amber-900">
            {APP_NOTICE.icon} {APP_NOTICE.title}
          </p>
          <ul className="grid list-disc gap-2 pe-5 ps-1">
            {APP_NOTICE.items.map((item, i) => (
              <li
                key={i}
                className="text-sm font-medium leading-relaxed text-amber-950 marker:text-amber-600"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6">
          <PrimaryBtn onClick={confirmNotice}>فهمت، الدخول إلى التطبيق</PrimaryBtn>
        </div>
        <button
          type="button"
          onClick={() => setStep("terms")}
          className="mx-auto mt-4 block text-sm font-bold text-silver-600 underline"
        >
          → الرجوع إلى اللائحة
        </button>
      </main>
    );
  }

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

