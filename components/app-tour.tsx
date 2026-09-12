"use client";

import { useState } from "react";

/** جولة تعريفية بشاشات التطبيق للطالبة — تظهر تلقائياً أول مرة على الجهاز،
    ويمكن إعادة فتحها من الإعدادات ⚙️ في أي وقت. */

const TOUR_KEY = "almaher_tour_seen_v1";

export function hasSeenTour(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(TOUR_KEY) === "1";
  } catch {
    return true;
  }
}

export function markTourSeen() {
  try {
    window.localStorage.setItem(TOUR_KEY, "1");
  } catch {
    /* الخصوصية أو التخزين معطّل — لا بأس */
  }
}

interface Slide {
  icon: string;
  title: string;
  intro?: string;
  items: string[];
  tab?: "reading" | "tajweed"; // شريحة تبويب قد يخفيه الإعداد
}

const SLIDES: Slide[] = [
  {
    icon: "🌸",
    title: "أهلاً بكِ في الماهر",
    intro: "هذا التطبيق رفيقكِ في رحلة الحفظ: يعرض لكِ ما عليكِ في كل لقاء، ويتابع تقدّمكِ، ويذكّركِ بما يهمّ.",
    items: [
      "__TABS__",
      "الجرس 🔔 أعلى الشاشة للإشعارات، والترس ⚙️ للإعدادات",
    ],
  },
  {
    icon: "📖",
    title: "تبويب القرآن",
    intro: "أهم تبويب في التطبيق، وفيه ثلاثة أقسام:",
    items: [
      "📌 وِردي: ما عليكِ حفظه وتثبيته ومراجعته في اللقاء القادم",
      "🧭 رحلتي: خريطة تُظهر أين وصلتِ في القرآن ونسبة إنجازكِ",
      "📅 خطتي: جدول لقاءات الفصل كاملاً مع نتيجة كل لقاء، ويمكنكِ طباعته",
    ],
  },
  {
    icon: "📚",
    title: "تبويب القراءة",
    tab: "reading",
    items: [
      "كتب تختارها الإدارة لكِ، تقرئينها داخل التطبيق",
      "لكل كتاب خطة قراءة: تظهر لكِ مهمة اليوم والصفحات المطلوبة",
      "بعد كل قسم اضغطي «تمّ» وأجيبي عن أسئلته القصيرة",
    ],
  },
  {
    icon: "📿",
    title: "تبويب التجويد",
    tab: "tajweed",
    items: [
      "دروس مختصرة في أحكام التجويد",
      "بعد كل درس اختبار قصير تتأكدين به من فهمكِ",
      "نتائجكِ محفوظة وتظهر لمعلّمتكِ",
    ],
  },
  {
    icon: "🏆",
    title: "تبويب السباق",
    items: [
      "نقاطكِ تُحسب من تسميعكِ الفعلي في الحلقة",
      "تشاهدين العشر الأوائل في مسجدكِ أو في كل المساجد، وترتيبكِ بينهنّ",
      "أسماء الزميلات لا تظهر، فقط النقاط والترتيب",
    ],
  },
  {
    icon: "🔔",
    title: "الإشعارات والدعم",
    items: [
      "الجرس 🔔 يجمع إعلانات الإدارة وتنبيهات التطبيق، والرقم الأحمر عليه يعني جديداً لم تقرئيه",
      "من شاشة الإشعارات فعّلي «إشعارات الجهاز» ليصلكِ التنبيه حتى والتطبيق مغلق",
      "أسفل الشاشة صندوق الدعم: أرسلي منه أي استفسار أو مشكلة للإدارة",
    ],
  },
  {
    icon: "⚙️",
    title: "الإعدادات",
    intro: "من الترس ⚙️ أعلى الشاشة تجدين:",
    items: [
      "«شرح البرنامج» لإعادة هذه الجولة متى شئتِ",
      "تسجيل الخروج من هذا الجهاز",
      "تذكّري: المنصة الإلكترونية هي المرجع المعتمد، والتطبيق أداة مساعدة",
    ],
  },
];

const TAB_NAMES: Record<string, string> = {
  reading: "القراءة",
  quran: "القرآن",
  tajweed: "التجويد",
  race: "السباق",
};
const AR_COUNT = ["", "تبويب واحد", "تبويبان", "ثلاثة تبويبات", "أربعة تبويبات"];

export function AppTour({
  open,
  onClose,
  hidden,
}: {
  open: boolean;
  onClose: () => void;
  hidden?: { reading?: boolean; tajweed?: boolean }; // تبويبات أخفتها الإدارة
}) {
  const [i, setI] = useState(0);
  if (!open) return null;

  // الشرائح حسب التبويبات الظاهرة فعلاً
  const shown = ["reading", "quran", "tajweed", "race"].filter(
    (k) => !(k === "reading" && hidden?.reading) && !(k === "tajweed" && hidden?.tajweed)
  );
  const tabsLine = `الشاشة الرئيسية فيها ${AR_COUNT[shown.length] ?? "تبويبات"} أسفل الاسم: ${shown
    .map((k) => TAB_NAMES[k])
    .join("، ")}`;
  const slides = SLIDES.filter((sl) => !sl.tab || !hidden?.[sl.tab]).map((sl) => ({
    ...sl,
    items: sl.items.map((it) => (it === "__TABS__" ? tabsLine : it)),
  }));

  const slide = slides[Math.min(i, slides.length - 1)];
  const last = i >= slides.length - 1;
  const finish = () => {
    markTourSeen();
    setI(0);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="شرح البرنامج"
      className="fixed inset-0 z-[55] flex flex-col bg-cream px-5 pb-6 pt-8"
    >
      {/* رأس: تخطّي + مؤشر الشرائح */}
      <div className="mx-auto flex w-full max-w-md items-center justify-between">
        <button
          type="button"
          onClick={finish}
          className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-silver-600 ring-1 ring-cream-dark"
        >
          تخطّي
        </button>
        <div className="flex items-center gap-1.5" aria-hidden>
          {slides.map((_, k) => (
            <span
              key={k}
              className={`h-2 rounded-full transition-all ${
                k === i ? "w-5 bg-plum-600" : "w-2 bg-plum-200"
              }`}
            />
          ))}
        </div>
      </div>

      {/* محتوى الشريحة — يُعاد تحريكه عند كل تغيير */}
      <div
        key={i}
        className="welcome-in mx-auto flex w-full max-w-md flex-1 flex-col justify-center"
      >
        <div className="card rounded-3xl p-6 text-center">
          <p className="text-5xl">{slide.icon}</p>
          <h2 className="mt-3 font-kufi text-2xl font-bold text-plum-800">
            {slide.title}
          </h2>
          {slide.intro && (
            <p className="mt-2 text-sm leading-relaxed text-plum-700">
              {slide.intro}
            </p>
          )}
          <ul className="mt-4 grid gap-2.5 text-start">
            {slide.items.map((it, k) => (
              <li
                key={k}
                className="flex items-start gap-2 rounded-xl bg-plum-50 px-3 py-2.5 text-sm font-medium leading-relaxed text-ink"
              >
                <span className="mt-0.5 shrink-0 text-plum-500">✦</span>
                {it}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* أزرار التنقّل */}
      <div className="mx-auto flex w-full max-w-md items-center gap-2">
        {i > 0 && (
          <button
            type="button"
            onClick={() => setI(i - 1)}
            className="rounded-xl bg-white px-4 py-3 font-kufi text-sm font-bold text-plum-700 ring-1 ring-cream-dark"
          >
            السابق
          </button>
        )}
        <button
          type="button"
          onClick={() => (last ? finish() : setI(i + 1))}
          className="flex-1 rounded-xl bg-plum-600 py-3 font-kufi text-base font-bold text-white transition active:scale-[0.98]"
        >
          {last ? "ابدئي رحلتكِ 🌸" : "التالي"}
        </button>
      </div>
      <p className="mt-3 text-center text-[11px] text-silver-600">
        {(i + 1).toLocaleString("ar-EG")} / {slides.length.toLocaleString("ar-EG")}
      </p>
    </div>
  );
}
