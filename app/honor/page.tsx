"use client";

import { useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { useApp } from "@/lib/store";
import { Field, inputCls, PageHeader, PrimaryBtn, useHydrated } from "@/components/ui";

const TITLES = ["لوحة الشرف", "متميزات الأسبوع", "لوحة الإتقان", "خاتمات القرآن"];

export default function HonorPage() {
  const { halaqas, students } = useApp();
  const hydrated = useHydrated();

  const [title, setTitle] = useState(TITLES[0]);
  const [subtitle, setSubtitle] = useState("دورة الفصل الثاني ١٤٤٧ هـ / ٢٠٢٦ م");
  const [halaqaId, setHalaqaId] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);

  const halaqa = halaqas.find((h) => h.id === halaqaId) ?? halaqas[0];
  const pool = useMemo(
    () => (halaqa ? students.filter((s) => s.halaqaId === halaqa.id) : []),
    [students, halaqa]
  );
  const names = pool.filter((s) => picked.includes(s.id)).map((s) => s.name);

  if (!hydrated) return <main className="mx-auto max-w-2xl px-4 pt-10" />;

  const togglePick = (id: string) =>
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const exportPng = async (share: boolean) => {
    if (!posterRef.current || busy) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(posterRef.current, {
        pixelRatio: 2,
        cacheBust: true,
      });
      const fileName = `${title}-${halaqa?.mosque ?? "الماهر"}.png`;
      if (share && typeof navigator.share === "function") {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], fileName, { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title });
          return;
        }
      }
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = fileName;
      a.click();
    } catch {
      window.alert("تعذّر إنشاء الصورة، جرّبي مرة أخرى");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-8">
      <PageHeader title="لوحة الشرف" />
      <p className="mb-5 -mt-2 text-sm text-silver-600">
        اختاري الحلقة والأسماء، ويطلع لك إعلان جاهز بهوية الجمعية 🎨
      </p>

      <div className="card mb-5 rounded-2xl p-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="عنوان اللوحة" icon="🏅">
            <select
              className={inputCls}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            >
              {TITLES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="الحلقة" icon="🕌">
            <select
              className={inputCls}
              value={halaqa?.id ?? ""}
              onChange={(e) => {
                setHalaqaId(e.target.value);
                setPicked([]);
              }}
            >
              {halaqas.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.mosque} {h.day && `— ${h.day}`}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="السطر الثاني (الدورة)" icon="🗓️">
          <input
            className={inputCls}
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
          />
        </Field>

        <p className="mb-1 text-sm font-bold text-plum-700">🌸 الأسماء</p>
        {pool.length === 0 ? (
          <p className="rounded-xl bg-cream-dark/40 px-4 py-3 text-center text-sm text-silver-600">
            لا طالبات في هذه الحلقة بعد
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setPicked(picked.length === pool.length ? [] : pool.map((s) => s.id))
              }
              className="rounded-full border border-plum-500 px-3 py-1 text-xs font-bold text-plum-700"
            >
              {picked.length === pool.length ? "إلغاء الكل" : "اختيار الكل"}
            </button>
            {pool.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => togglePick(s.id)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                  picked.includes(s.id)
                    ? "bg-plum-600 text-white"
                    : "bg-cream text-silver-600"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* المعاينة */}
      <div className="overflow-x-auto rounded-2xl border border-cream-dark bg-white p-3">
        <div className="mx-auto w-fit">
          <div
            ref={posterRef}
            className="pattern-bg relative w-[420px] px-8 py-10 text-center"
          >
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-plum-200 bg-white">
              <span className="font-kufi text-xl font-bold text-plum-700">
                الماهر
              </span>
            </div>
            <p className="mb-3 text-[11px] font-bold text-silver-600">
              جمعية الماهر بالقرآن وعلومه
            </p>
            <h2 className="font-kufi text-4xl font-bold text-plum-800">{title}</h2>
            {subtitle && (
              <p className="mt-2 font-kufi text-base font-semibold text-plum-700">
                {subtitle}
              </p>
            )}
            {halaqa && (
              <div className="ribbon mx-auto mt-5 w-fit rounded-xl px-7 py-2">
                <span className="font-kufi text-base font-semibold text-white">
                  حلقات {halaqa.mosque}
                </span>
              </div>
            )}
            {halaqa?.day && (
              <div className="mx-auto mt-2 w-fit rounded-lg bg-plum-800 px-5 py-1">
                <span className="font-kufi text-sm font-semibold text-white">
                  حلقات {halaqa.day}
                </span>
              </div>
            )}
            <div className="mt-7 grid grid-cols-2 gap-3">
              {names.length === 0 && (
                <p className="col-span-2 py-6 text-sm text-silver-500">
                  اختاري الأسماء من الأعلى ✨
                </p>
              )}
              {names.map((n, i) => (
                <div
                  key={i}
                  className={`name-box rounded-md px-3 py-2.5 font-kufi text-sm font-medium text-white ${
                    names.length % 2 === 1 && i === names.length - 1
                      ? "col-span-2 mx-auto w-1/2"
                      : ""
                  }`}
                >
                  {n}
                </div>
              ))}
            </div>
            <p className="mt-8 text-[11px] font-bold text-silver-600">
              📷 Maher.quran2
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <PrimaryBtn onClick={() => exportPng(false)}>
          {busy ? "لحظة…" : "⬇️ تحميل الصورة"}
        </PrimaryBtn>
        <button
          type="button"
          onClick={() => exportPng(true)}
          className="card w-full rounded-xl py-3 font-kufi text-base font-bold text-plum-700 transition active:scale-[0.98]"
        >
          📤 مشاركة
        </button>
      </div>
    </main>
  );
}
