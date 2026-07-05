"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { useApp } from "@/lib/store";
import { Field, inputCls, PageHeader, PrimaryBtn, useHydrated } from "@/components/ui";
import { AssocLogo } from "@/components/logo";

const TITLE_CHIPS = [
  "لوحة الشرف",
  "متميزات الأسبوع الأول",
  "متميزات الأسبوع الثاني",
  "متميزات الأسبوع الثالث",
  "لوحة الإتقان",
  "خاتمات القرآن",
];

const POSTER_W = 720;
const LOGOS_KEY = "almaher-logos-v1";

interface Logos {
  assoc?: string; // شعار الجمعية (dataURL)
  mosque?: string; // شعار المسجد (dataURL)
}

function loadLogos(): Logos {
  try {
    return JSON.parse(window.localStorage.getItem(LOGOS_KEY) ?? "{}") as Logos;
  } catch {
    return {};
  }
}

/** تصغير الصورة قبل الحفظ حتى لا تمتلئ مساحة التخزين */
async function fileToSmallDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = document.createElement("img");
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("bad image"));
      img.src = url;
    });
    const max = 360;
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * k));
    c.height = Math.max(1, Math.round(img.height * k));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function HonorPage() {
  const { halaqas, students } = useApp();
  const hydrated = useHydrated();

  const [title, setTitle] = useState("لوحة الشرف");
  const [subtitle, setSubtitle] = useState("الدورة الصيفية ١٤٤٨ هـ / ٢٠٢٦ م");
  const [halaqaId, setHalaqaId] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [outlined, setOutlined] = useState(false);
  const [logos, setLogos] = useState<Logos>({});
  const [busy, setBusy] = useState(false);

  const posterRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const assocRef = useRef<HTMLInputElement>(null);
  const mosqueRef = useRef<HTMLInputElement>(null);
  const [scale, setScale] = useState(1);
  const [posterH, setPosterH] = useState(0);

  useEffect(() => setLogos(loadLogos()), []);

  // مقياس المعاينة حسب عرض الشاشة
  useEffect(() => {
    const update = () =>
      setScale(Math.min(1, (wrapRef.current?.clientWidth ?? POSTER_W) / POSTER_W));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [hydrated]);

  // ارتفاع البوستر الفعلي (يتغيّر مع عدد الأسماء)
  useEffect(() => {
    const node = posterRef.current;
    if (!node) return;
    const ro = new ResizeObserver(() => setPosterH(node.offsetHeight));
    ro.observe(node);
    setPosterH(node.offsetHeight);
    return () => ro.disconnect();
  }, [hydrated]);

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

  const saveLogo = async (key: keyof Logos, file: File) => {
    try {
      const dataUrl = await fileToSmallDataUrl(file);
      const next = { ...logos, [key]: dataUrl };
      setLogos(next);
      try {
        window.localStorage.setItem(LOGOS_KEY, JSON.stringify(next));
      } catch {
        /* مساحة ممتلئة — يبقى الشعار لهذه الجلسة فقط */
      }
    } catch {
      window.alert("تعذّر قراءة الصورة");
    }
  };

  const clearLogo = (key: keyof Logos) => {
    const next = { ...logos };
    delete next[key];
    setLogos(next);
    try {
      window.localStorage.setItem(LOGOS_KEY, JSON.stringify(next));
    } catch {
      /* نتجاهل */
    }
  };

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
        <Field label="عنوان اللوحة" icon="🏅">
          <input
            className={inputCls}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <div className="-mt-1 mb-3 flex flex-wrap gap-1.5">
          {TITLE_CHIPS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTitle(t);
                setOutlined(t.includes("متميزات"));
              }}
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                title === t ? "bg-plum-600 text-white" : "bg-cream text-silver-600"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="السطر الثاني (الدورة)" icon="🗓️">
            <input
              className={inputCls}
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
            />
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

        {/* شكل الصناديق */}
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm font-bold text-plum-700">🎨 شكل الأسماء:</span>
          <button
            type="button"
            onClick={() => setOutlined(false)}
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              !outlined ? "bg-plum-600 text-white" : "bg-cream text-silver-600"
            }`}
          >
            🟪 معبّأة
          </button>
          <button
            type="button"
            onClick={() => setOutlined(true)}
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              outlined ? "name-box-outline" : "bg-cream text-silver-600"
            }`}
          >
            ⬜ مفرّغة
          </button>
        </div>

        {/* الشعارات */}
        <div className="mb-3 grid grid-cols-2 gap-2">
          {(
            [
              { key: "assoc", label: "شعار الجمعية", ref: assocRef },
              { key: "mosque", label: "شعار المسجد", ref: mosqueRef },
            ] as const
          ).map(({ key, label, ref }) => (
            <div key={key} className="rounded-xl bg-cream px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-plum-700">🖼️ {label}</span>
                {logos[key] ? (
                  <button
                    type="button"
                    onClick={() => clearLogo(key)}
                    className="text-xs font-bold text-red-600"
                  >
                    إزالة ✕
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => ref.current?.click()}
                    className="rounded-full bg-plum-100 px-2.5 py-0.5 text-xs font-bold text-plum-700"
                  >
                    + رفع
                  </button>
                )}
              </div>
              {logos[key] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logos[key]}
                  alt={label}
                  className="mx-auto mt-1 h-10 object-contain"
                />
              )}
              <input
                ref={ref}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) saveLogo(key, f);
                  e.target.value = "";
                }}
              />
            </div>
          ))}
        </div>

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

      {/* المعاينة — بوستر بمقاس ثابت يتصغّر ليناسب الشاشة */}
      <div
        ref={wrapRef}
        className="overflow-hidden rounded-2xl border border-cream-dark bg-white p-0"
      >
        <div style={{ height: posterH ? posterH * scale : undefined }}>
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top right",
              width: POSTER_W,
            }}
          >
            <div
              ref={posterRef}
              className="pattern-bg relative text-center"
              style={{ width: POSTER_W, padding: "56px 48px 40px" }}
            >
              {/* الشعارات */}
              <div className="mb-6 flex items-center justify-center gap-10">
                {logos.mosque && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logos.mosque}
                    alt="شعار المسجد"
                    className="h-24 object-contain"
                  />
                )}
                {logos.assoc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logos.assoc}
                    alt="شعار الجمعية"
                    className="h-24 object-contain"
                  />
                ) : (
                  <AssocLogo className="h-32" />
                )}
              </div>

              <h2 className="font-kufi text-5xl font-bold leading-tight text-plum-800">
                {title}
              </h2>
              {subtitle && (
                <p className="mt-3 font-kufi text-2xl font-semibold text-plum-700">
                  {subtitle}
                </p>
              )}

              {halaqa && (
                <div className="ribbon ribbon-shape mx-auto mt-8 w-fit px-14 py-2.5">
                  <span className="font-kufi text-2xl font-semibold text-white drop-shadow-sm">
                    حلقات {halaqa.mosque}
                  </span>
                </div>
              )}
              {halaqa?.day && (
                <div className="mx-auto mt-3 w-fit rounded-xl bg-plum-800 px-8 py-1.5">
                  <span className="font-kufi text-lg font-semibold text-white">
                    حلقات {halaqa.day}
                  </span>
                </div>
              )}

              {/* الأسماء — ٣ أعمدة مع توسيط الصف الأخير */}
              <div className="mt-10 flex flex-wrap justify-center gap-x-4 gap-y-5">
                {names.length === 0 && (
                  <p className="py-8 text-lg text-silver-500">
                    اختاري الأسماء من الأعلى ✨
                  </p>
                )}
                {names.map((n, i) => (
                  <div
                    key={i}
                    className={`flex min-h-12 items-center justify-center rounded-md px-2 font-kufi text-base font-semibold ${
                      outlined ? "name-box-outline" : "name-box text-white"
                    }`}
                    style={{ width: 194 }}
                  >
                    {n}
                  </div>
                ))}
              </div>

              <p className="mt-12 text-sm font-bold text-silver-600">
                📷 Maher.quran2
              </p>
            </div>
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
