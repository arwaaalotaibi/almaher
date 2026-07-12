"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import {
  actions,
  buildReadingPlan,
  normalizeDigits,
  segDateLabel,
  uid,
  useApp,
  WEEK_DAYS,
  type ReadingSegment,
} from "@/lib/store";
import {
  Field,
  inputCls,
  PageHeader,
  PrimaryBtn,
  Sheet,
  useHydrated,
} from "@/components/ui";
import { RoleOnly } from "@/components/admin-only";
import {
  formToQuestions,
  QuestionsBuilder,
  questionsToForm,
  type QForm,
} from "@/components/questions-builder";

const ar = (n: number) => n.toLocaleString("ar-EG");
const DAYS = [1, 2, 3, 4, 5, 6, 7].map((i) => ({ dow: i - 1, label: WEEK_DAYS[i] }));

export default function BookPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <RoleOnly roles={["admin"]}>
      <Inner params={params} />
    </RoleOnly>
  );
}

function Inner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const hydrated = useHydrated();
  const { books } = useApp();
  const book = books.find((b) => b.id === id);

  const [plan, setPlan] = useState<ReadingSegment[]>(book?.readingPlan ?? []);
  const [start, setStart] = useState("");
  const [perDay, setPerDay] = useState("2");
  const [dows, setDows] = useState<number[]>([]);
  const [withExam, setWithExam] = useState(true);
  // القسم الذي تُحرَّر أسئلته
  const [qSeg, setQSeg] = useState<ReadingSegment | null>(null);
  const [qForms, setQForms] = useState<QForm[]>([]);

  if (!hydrated) return <main className="mx-auto max-w-2xl px-4 pt-10" />;
  if (!book) {
    return (
      <main className="mx-auto max-w-2xl px-4 pt-10">
        <PageHeader title="الكتاب غير موجود" back="/books" />
      </main>
    );
  }

  const sorted = [...plan].sort((a, b) => a.date.localeCompare(b.date));

  const generate = () => {
    if (!start) {
      window.alert("حدّدي تاريخ البداية");
      return;
    }
    const p = Math.max(1, Number(normalizeDigits(perDay)) || 1);
    const gen = buildReadingPlan(book.pages || 1, start, p, dows, withExam);
    if (!gen.length) {
      window.alert("تعذّر التوليد — تأكدي من المدخلات");
      return;
    }
    setPlan(gen);
  };

  const save = () => {
    actions.setBookPlan(id, plan);
    window.alert("تم حفظ خطة القراءة ✅");
    router.push("/books");
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-8">
      <PageHeader title="خطة القراءة" back="/books" />
      <p className="mb-5 -mt-2 text-sm font-bold text-plum-700">
        📕 {book.title}{" "}
        <span className="text-silver-600">
          ({ar(book.pages)} صفحة)
        </span>
      </p>

      {/* توليد تلقائي */}
      <div className="card mb-5 rounded-2xl p-4">
        <p className="mb-3 font-kufi text-base font-bold text-plum-800">
          🪄 توزيع تلقائي على الأيام
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="تاريخ البداية" icon="🗓️">
            <input
              type="date"
              className={inputCls}
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>
          <Field label="صفحات كل يوم" icon="📄">
            <input
              inputMode="numeric"
              className={inputCls}
              value={perDay}
              onChange={(e) => setPerDay(e.target.value)}
            />
          </Field>
        </div>
        <p className="mb-1 text-sm font-bold text-plum-700">أيام القراءة</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {DAYS.map((d) => (
            <button
              key={d.dow}
              type="button"
              onClick={() =>
                setDows((prev) =>
                  prev.includes(d.dow)
                    ? prev.filter((x) => x !== d.dow)
                    : [...prev, d.dow]
                )
              }
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                dows.includes(d.dow)
                  ? "bg-plum-600 text-white"
                  : "bg-cream text-silver-600"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <p className="mb-3 text-[11px] text-silver-600">
          اتركي الأيام فارغة = كل يوم
        </p>
        <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm font-bold text-plum-700">
          <input
            type="checkbox"
            checked={withExam}
            onChange={(e) => setWithExam(e.target.checked)}
            className="h-4 w-4 accent-plum-600"
          />
          📝 إضافة اختبار في نهاية الخطة
        </label>
        <PrimaryBtn onClick={generate}>🪄 توليد الخطة</PrimaryBtn>
      </div>

      {/* الخطة */}
      {sorted.length === 0 ? (
        <div className="card rounded-2xl p-8 text-center">
          <p className="text-3xl">📅</p>
          <p className="mt-2 font-kufi font-bold text-plum-800">
            لا توجد خطة بعد
          </p>
          <p className="mt-1 text-sm text-silver-600">
            ولّديها تلقائياً من الأعلى أو أضيفي أياماً يدوياً
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <p className="font-kufi text-base font-bold text-plum-800">
              📅 الخطة ({ar(sorted.length)})
            </p>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("مسح كل الخطة؟")) setPlan([]);
              }}
              className="text-xs font-bold text-red-600"
            >
              مسح الكل
            </button>
          </div>
          {sorted.map((s, i) => (
            <div
              key={s.id}
              className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                s.isExam ? "bg-gold/15 ring-1 ring-gold/40" : "bg-cream"
              }`}
            >
              <span className="min-w-0">
                <span className="font-kufi text-sm font-bold text-plum-800">
                  {s.isExam ? "📝 اختبار" : `يوم ${ar(i + 1)}`}
                  {!s.isExam && (
                    <span className="text-plum-600">
                      {" "}
                      · صفحات {ar(s.fromPage)}–{ar(s.toPage)}
                    </span>
                  )}
                </span>
                <span className="block text-[11px] text-silver-600">
                  {segDateLabel(s.date)}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setQSeg(s);
                    setQForms(questionsToForm(s.questions ?? []));
                  }}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    (s.questions?.length ?? 0) > 0
                      ? "bg-plum-600 text-white"
                      : "bg-plum-100 text-plum-700"
                  }`}
                >
                  📝 أسئلة
                  {(s.questions?.length ?? 0) > 0 &&
                    ` (${ar(s.questions!.length)})`}
                </button>
                <button
                  type="button"
                  onClick={() => setPlan(plan.filter((x) => x.id !== s.id))}
                  className="text-xs font-bold text-red-600"
                  aria-label="حذف"
                >
                  ✕
                </button>
              </span>
            </div>
          ))}

          {/* إضافة يدوية */}
          <button
            type="button"
            onClick={() => {
              const last = sorted[sorted.length - 1];
              setPlan([
                ...plan,
                {
                  id: uid(),
                  date: last?.date ?? new Date().toISOString().slice(0, 10),
                  fromPage: 1,
                  toPage: book.pages || 1,
                  isExam: true,
                  note: "اختبار",
                },
              ]);
            }}
            className="mt-1 rounded-xl border border-dashed border-plum-300 py-2.5 text-sm font-bold text-plum-700"
          >
            + إضافة اختبار
          </button>
        </div>
      )}

      {/* أسئلة القسم — تظهر للطالبة مع ورد القراءة */}
      <Sheet
        open={qSeg !== null}
        onClose={() => setQSeg(null)}
        title={
          qSeg?.isExam
            ? "📝 أسئلة الاختبار"
            : `📝 أسئلة صفحات ${ar(qSeg?.fromPage ?? 0)}–${ar(qSeg?.toPage ?? 0)}`
        }
      >
        <p className="mb-3 rounded-xl bg-plum-50 px-3 py-2.5 text-xs font-bold text-plum-700">
          تحلّها الطالبة بعد قراءة القسم وتُحفظ نتيجتها — تظهر لك في الخطة
        </p>
        <QuestionsBuilder value={qForms} onChange={setQForms} />
        <div className="mt-3">
          <PrimaryBtn
            onClick={() => {
              if (!qSeg) return;
              const built = formToQuestions(qForms);
              if ("error" in built) {
                window.alert(built.error);
                return;
              }
              setPlan((p) =>
                p.map((x) =>
                  x.id === qSeg.id ? { ...x, questions: built.questions } : x
                )
              );
              setQSeg(null);
            }}
          >
            حفظ الأسئلة
          </PrimaryBtn>
          <p className="mt-2 text-center text-xs text-silver-600">
            لا تنسي «💾 حفظ الخطة» في الأسفل بعد الإغلاق
          </p>
        </div>
      </Sheet>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-cream-dark bg-white/90 p-3 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <PrimaryBtn onClick={save}>💾 حفظ الخطة</PrimaryBtn>
        </div>
      </div>
    </main>
  );
}
