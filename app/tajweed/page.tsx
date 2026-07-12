"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  actions,
  useApp,
  videoEmbedUrl,
  type TajweedLesson,
  type TajweedQuestion,
} from "@/lib/store";
import { supabase } from "@/lib/supabase";
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

export default function TajweedAdminPage() {
  return (
    <RoleOnly roles={["admin"]}>
      <TajweedInner />
    </RoleOnly>
  );
}

function TajweedInner() {
  const { tajweed, tajweedResults, students } = useApp();
  const hydrated = useHydrated();
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TajweedLesson | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<TajweedLesson["kind"]>("video");
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [qs, setQs] = useState<QForm[]>([]);

  if (!hydrated) return <main className="mx-auto max-w-2xl px-4 pt-10" />;

  const openNew = () => {
    setEditing(null);
    setTitle("");
    setKind("video");
    setUrl("");
    setQs([]);
    setOpen(true);
  };

  const openEdit = (l: TajweedLesson) => {
    setEditing(l);
    setTitle(l.title);
    setKind(l.kind);
    setUrl(l.url);
    setQs(questionsToForm(l.questions));
    setOpen(true);
  };

  /** رفع ملف (PDF أو فيديو من ألبوم الجهاز) إلى التخزين */
  const uploadFile = async (file: File, expect: "pdf" | "video") => {
    if (expect === "pdf" && file.type !== "application/pdf") {
      window.alert("الملف يجب أن يكون PDF");
      return;
    }
    if (expect === "video" && !file.type.startsWith("video/")) {
      window.alert("اختاري ملف فيديو من ألبوم جهازك");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      window.alert(
        expect === "video"
          ? "حجم الفيديو كبير (الحد ٥٠ ميجابايت)\n\nللفيديوهات الطويلة: ارفعيه على يوتيوب بخصوصية «غير مدرج» والصقي رابطه — أو قصّي المقطع/اضغطيه من تطبيق الصور ثم أعيدي المحاولة."
          : "حجم الملف كبير (الحد ٥٠ ميجابايت)"
      );
      return;
    }
    setUploading(true);
    const ext =
      expect === "pdf"
        ? "pdf"
        : (file.name.split(".").pop() || "mp4").toLowerCase();
    const path = `tajweed/${Date.now()}.${ext}`;
    const up = await supabase.storage
      .from("almaher-books")
      .upload(path, file, { contentType: file.type, upsert: true });
    setUploading(false);
    if (up.error) {
      window.alert(`تعذّر رفع الملف: ${up.error.message}`);
      return;
    }
    setUrl(supabase.storage.from("almaher-books").getPublicUrl(path).data.publicUrl);
  };

  const save = () => {
    if (!title.trim()) {
      window.alert("اكتبي عنوان الدرس");
      return;
    }
    if (!url.trim()) {
      window.alert(kind === "video" ? "ألصقي رابط الفيديو" : "ارفعي ملف الدرس");
      return;
    }
    if (
      kind === "video" &&
      !videoEmbedUrl(url) &&
      !/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)
    ) {
      window.alert("رابط الفيديو غير مفهوم — يوتيوب أو ملف فيديو (mp4/mov)");
      return;
    }
    const built = formToQuestions(qs);
    if ("error" in built) {
      window.alert(built.error);
      return;
    }
    const data = {
      title: title.trim(),
      kind,
      url: url.trim(),
      questions: built.questions,
    };
    if (editing) actions.updateTajweed(editing.id, data);
    else actions.addTajweed(data);
    setOpen(false);
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-8">
      <PageHeader title="التجويد" back="/" />
      <p className="mb-5 -mt-2 text-sm text-silver-600">
        أضيفي دروس التجويد — فيديو أو PDF مع أسئلة، تظهر للطالبات في تبويب «📿
        التجويد»
      </p>

      <PrimaryBtn onClick={openNew}>+ إضافة درس تجويد</PrimaryBtn>

      {tajweed.length === 0 ? (
        <div className="card mt-5 rounded-2xl p-8 text-center">
          <p className="text-3xl">📿</p>
          <p className="mt-2 font-kufi font-bold text-plum-800">لا دروس بعد</p>
          <p className="mt-1 text-sm text-silver-600">
            أضيفي أول درس من الزر بالأعلى
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-2.5">
          {tajweed.map((l) => {
            const res = tajweedResults.filter((r) => r.lessonId === l.id);
            const avg =
              res.length > 0
                ? Math.round(
                    (res.reduce((n, r) => n + r.score, 0) / res.length) * 10
                  ) / 10
                : 0;
            return (
              <div key={l.id} className="card rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <Link
                    href={`/tajweed/${l.id}`}
                    className="flex min-w-0 items-center gap-3 font-kufi text-base font-bold text-plum-800"
                  >
                    <span className="text-2xl">{l.kind === "video" ? "🎬" : "📄"}</span>
                    <span className="truncate">{l.title}</span>
                  </Link>
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => openEdit(l)}
                      className="text-sm font-bold text-plum-700"
                    >
                      ✏️ تعديل
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`حذف درس «${l.title}»؟`))
                          actions.removeTajweed(l.id);
                      }}
                      className="text-sm font-bold text-red-600"
                    >
                      حذف
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold">
                  <span className="rounded-full bg-plum-100 px-2.5 py-0.5 text-plum-700">
                    {l.kind === "video" ? "🎬 فيديو" : "📄 ملف PDF"}
                  </span>
                  {l.questions.length > 0 && (
                    <span className="rounded-full bg-plum-100 px-2.5 py-0.5 text-plum-700">
                      📝 {ar(l.questions.length)} سؤال
                    </span>
                  )}
                  {l.questions.length > 0 && (
                    <span className="rounded-full bg-cream px-2.5 py-0.5 text-silver-600">
                      {res.length > 0
                        ? `حلّتها ${ar(res.length)} من ${ar(students.length)} · متوسط ${avg.toLocaleString("ar-EG")}/${ar(l.questions.length)}`
                        : "لم تُحلّ بعد"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* إضافة / تعديل درس */}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "✏️ تعديل الدرس" : "+ درس تجويد جديد"}
      >
        <Field label="عنوان الدرس" icon="📿">
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثال: أحكام النون الساكنة والتنوين"
          />
        </Field>

        {/* نوع المحتوى */}
        <div className="mb-3 grid grid-cols-2 gap-2">
          {(
            [
              { v: "video", label: "🎬 فيديو" },
              { v: "pdf", label: "📄 ملف PDF" },
            ] as const
          ).map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setKind(o.v)}
              className={`rounded-xl border-2 py-2.5 text-sm font-bold transition ${
                kind === o.v
                  ? "border-plum-600 bg-plum-50 text-plum-800"
                  : "border-cream-dark text-silver-600"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {kind === "video" ? (
          <>
            <Field label="رابط الفيديو (يوتيوب أو mp4)" icon="🔗">
              <input
                className={inputCls}
                dir="ltr"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtu.be/…"
              />
            </Field>
            <p className="mb-2 text-center text-xs font-bold text-silver-500">
              — أو —
            </p>
            <div className="mb-3">
              <input
                ref={videoRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadFile(f, "video");
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => videoRef.current?.click()}
                disabled={uploading}
                className="w-full rounded-xl border-2 border-dashed border-plum-300 bg-plum-50 py-3 text-sm font-bold text-plum-700 disabled:opacity-50"
              >
                {uploading
                  ? "جارٍ رفع الفيديو… لا تغلقي الصفحة"
                  : url && url.includes("/tajweed/")
                    ? "✅ الفيديو مرفوع — اضغطي لاستبداله"
                    : "📱 رفع فيديو من ألبوم جهازك"}
              </button>
              <p className="mt-1.5 text-[11px] text-silver-600">
                حتى ٥٠ ميجابايت (يناسب المقاطع القصيرة) — الأطول ارفعيه يوتيوب
                «غير مدرج» والصقي رابطه
              </p>
            </div>
          </>
        ) : (
          <div className="mb-3">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadFile(f, "pdf");
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full rounded-xl border-2 border-dashed border-plum-300 bg-plum-50 py-3 text-sm font-bold text-plum-700 disabled:opacity-50"
            >
              {uploading
                ? "جارٍ الرفع…"
                : url
                  ? "✅ الملف جاهز — اضغطي لاستبداله"
                  : "⬆️ رفع ملف PDF"}
            </button>
          </div>
        )}

        {/* بناء الأسئلة */}
        <div className="mb-3 rounded-2xl border border-cream-dark p-3">
          <p className="mb-2 font-kufi text-sm font-bold text-plum-800">
            📝 أسئلة الدرس (اختياري)
          </p>
          <QuestionsBuilder value={qs} onChange={setQs} />
        </div>

        <PrimaryBtn onClick={save}>
          {editing ? "حفظ التعديلات" : "إضافة الدرس"}
        </PrimaryBtn>
      </Sheet>
    </main>
  );
}
