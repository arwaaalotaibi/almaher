"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  audioUrl,
  audioUrlFallback,
  fetchWardAyahs,
  RECITERS,
  type ReciterId,
  type WardAyah,
} from "@/lib/quran-audio";
import { pageOf, refLabel } from "@/lib/mushaf";
import { MushafPage } from "./mushaf-page";

const ar = (n: number) => n.toLocaleString("ar-EG");
const rateLabel = (r: number) => (r === 1 ? "عادية" : r < 1 ? `🐢 ${ar(r)}×` : `${ar(r)}×`);

const PREFS_KEY = "almaher-memorizer";
const REPEATS = [1, 3, 5, 7];
const RATES = [0.75, 1, 1.25, 1.5]; // سرعة التلاوة

/** 🎧 مسمّعي: تشغيل الورد آيةً آية مع تكرار كل آية ووضع «ردّدي بعدي» */
export function Memorizer({
  from,
  to,
}: {
  from: { surah: number; ayah: number };
  to: { surah: number; ayah: number };
}) {
  const [ayahs, setAyahs] = useState<WardAyah[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [idx, setIdx] = useState(0);
  const [rep, setRep] = useState(0); // التكرار الحالي للآية (0-based)
  const [playing, setPlaying] = useState(false);
  const [echoing, setEchoing] = useState(false); // فترة «ردّدي الآن»
  const [finished, setFinished] = useState(false);
  const [reciter, setReciter] = useState<ReciterId>("ar.alafasy");
  const [perAyah, setPerAyah] = useState(3);
  const [rate, setRate] = useState(1);
  const [echo, setEcho] = useState(false);
  const [view, setView] = useState<"page" | "text">("page"); // 📖 صفحة المصحف أو الآية مكبّرة
  const [full, setFull] = useState(false); // ⛶ الصفحة على كامل الشاشة

  const audioRef = useRef<HTMLAudioElement>(null);
  const echoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // مراجع حيّة للقيم المستخدمة داخل معالج «انتهى الصوت»
  const live = useRef({ idx: 0, rep: 0, perAyah: 3, echo: false, len: 0 });
  live.current = { idx, rep, perAyah, echo, len: ayahs?.length ?? 0 };

  /* التفضيلات المحفوظة */
  useEffect(() => {
    try {
      const p = JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "{}");
      if (RECITERS.some((r) => r.id === p.reciter)) setReciter(p.reciter);
      if (REPEATS.includes(p.perAyah)) setPerAyah(p.perAyah);
      if (RATES.includes(p.rate)) setRate(p.rate);
      if (typeof p.echo === "boolean") setEcho(p.echo);
      if (p.view === "page" || p.view === "text") setView(p.view);
    } catch {
      /* نتجاهل */
    }
  }, []);
  const savePrefs = (patch: Record<string, unknown>) => {
    try {
      const p = JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "{}");
      window.localStorage.setItem(PREFS_KEY, JSON.stringify({ ...p, ...patch }));
    } catch {
      /* نتجاهل */
    }
  };

  /* جلب آيات الورد */
  useEffect(() => {
    let cancelled = false;
    setAyahs(null);
    setFailed(false);
    setIdx(0);
    setRep(0);
    setFinished(false);
    setPlaying(false);
    fetchWardAyahs(from, to)
      .then((list) => {
        if (!cancelled) setAyahs(list.length ? list : null);
        if (!cancelled && !list.length) setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const cur = ayahs?.[idx];

  /* ⚡ الصوت: الآيات القادمة تُحمَّل مسبقاً على الجهاز فتتصل التلاوة بلا انتظار بين الآيات */
  const blobs = useRef(new Map<string, string>()); // «قارئ:رقم» ← رابط محلي
  const pending = useRef(new Set<string>());
  const srcOf = (a: WardAyah) =>
    blobs.current.get(`${reciter}:${a.n}`) ?? audioUrl(reciter, a.surah, a.ayah);
  useEffect(() => {
    if (!ayahs) return;
    for (let i = idx; i < Math.min(ayahs.length, idx + 4); i++) {
      const a = ayahs[i];
      const k = `${reciter}:${a.n}`;
      if (blobs.current.has(k) || pending.current.has(k)) continue;
      pending.current.add(k);
      fetch(audioUrl(reciter, a.surah, a.ayah))
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("audio"))))
        .then((b) => blobs.current.set(k, URL.createObjectURL(b)))
        .catch(() => {})
        .finally(() => pending.current.delete(k));
    }
  }, [idx, reciter, ayahs]);
  useEffect(() => {
    const m = blobs.current;
    return () => m.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  // ⛶ إيقاف تمرير الصفحة خلف وضع ملء الشاشة، والخروج بزر الرجوع/Escape
  useEffect(() => {
    if (!full) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const k = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", k);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", k);
    };
  }, [full]);

  // ⏩ السرعة: الافتراضية تبقى مع تغيّر مصدر الآية، والحالية للآية الجارية
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.defaultPlaybackRate = rate;
    el.playbackRate = rate;
  }, [rate, ayahs]);

  /** تعذّر المصدر ⇒ الرابط الاحتياطي (مرة واحدة لكل آية) */
  const onError = () => {
    const el = audioRef.current;
    const a = ayahs?.[live.current.idx];
    if (!el || !a) return;
    const fb = audioUrlFallback(reciter, a.n);
    if (el.src === fb) return;
    el.src = fb;
    if (playing) void el.play().catch(() => setPlaying(false));
  };

  /** الانتقال بعد اكتمال آية (بكل تكراراتها) */
  const advance = useCallback(() => {
    const v = live.current;
    if (v.rep + 1 < v.perAyah) {
      setRep(v.rep + 1);
      const el = audioRef.current;
      if (el) {
        el.currentTime = 0;
        void el.play();
      }
      return;
    }
    if (v.idx + 1 < v.len) {
      setRep(0);
      setIdx(v.idx + 1);
      // المصدر يتغيّر — التشغيل يستمر عبر useEffect أدناه
    } else {
      setPlaying(false);
      setFinished(true);
    }
  }, []);

  /** عند انتهاء الصوت: إمّا ترديد صامت ثم متابعة، أو متابعة فورية */
  const onEnded = useCallback(() => {
    const el = audioRef.current;
    if (live.current.echo && el && isFinite(el.duration)) {
      setEchoing(true);
      echoTimer.current = setTimeout(
        () => {
          setEchoing(false);
          advance();
        },
        Math.max(1500, el.duration * 1000)
      );
    } else {
      advance();
    }
  }, [advance]);

  /* تشغيل تلقائي عند تغيّر الآية أثناء التشغيل + تجهيز التالية */
  useEffect(() => {
    if (!cur) return;
    const el = audioRef.current;
    if (el && playing && !echoing) {
      el.src = srcOf(cur);
      void el.play().catch(() => setPlaying(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, reciter, ayahs]);

  /* تنظيف مؤقّت الترديد */
  useEffect(
    () => () => clearTimeout(echoTimer.current),
    []
  );

  const toggle = () => {
    const el = audioRef.current;
    if (!el || !cur) return;
    if (playing) {
      el.pause();
      clearTimeout(echoTimer.current);
      setEchoing(false);
      setPlaying(false);
    } else {
      setFinished(false);
      if (!el.src) el.src = srcOf(cur);
      void el.play().catch(() => setPlaying(false));
      setPlaying(true);
    }
  };

  const jump = (d: number) => {
    if (!ayahs) return;
    clearTimeout(echoTimer.current);
    setEchoing(false);
    setFinished(false);
    const n = Math.max(0, Math.min(ayahs.length - 1, idx + d));
    setRep(0);
    setIdx(n);
    const el = audioRef.current;
    if (el && ayahs[n]) {
      el.src = srcOf(ayahs[n]);
      if (playing) void el.play().catch(() => setPlaying(false));
    }
  };

  /** الانتقال إلى آية بالضغط عليها في صفحة المصحف */
  const goTo = (key: string) => {
    if (!ayahs) return;
    const n = ayahs.findIndex((a) => `${a.surah}:${a.ayah}` === key);
    if (n >= 0) jump(n - idx);
  };

  const restart = () => {
    setIdx(0);
    setRep(0);
    setFinished(false);
    const el = audioRef.current;
    if (el && ayahs?.[0]) {
      el.src = srcOf(ayahs[0]);
      void el.play().catch(() => setPlaying(false));
      setPlaying(true);
    }
  };

  const wardKeys = new Set((ayahs ?? []).map((a) => `${a.surah}:${a.ayah}`));

  if (failed) {
    return (
      <div className="card rounded-2xl p-8 text-center">
        <p className="text-3xl">📡</p>
        <p className="mt-2 font-kufi font-bold text-plum-800">
          تعذّر تحميل الآيات
        </p>
        <p className="mt-1 text-sm text-silver-600">
          تأكدي من الإنترنت وأعيدي المحاولة
        </p>
      </div>
    );
  }

  if (!ayahs || !cur) {
    return (
      <div className="card rounded-2xl p-10 text-center">
        <p className="animate-pulse text-3xl">🎧</p>
        <p className="mt-2 text-sm font-bold text-silver-600">
          جارٍ تجهيز وردك…
        </p>
      </div>
    );
  }

  const page = pageOf(cur.surah, cur.ayah);
  const reciterName = RECITERS.find((r) => r.id === reciter)?.name ?? "";
  const progressPct = ((idx + (rep + 1) / perAyah) / ayahs.length) * 100;

  /** أزرار التشغيل — مشتركة بين العرض العادي وملء الشاشة */
  const controls = (big: boolean) => (
    <div className="flex items-center justify-center gap-5">
      <button
        type="button"
        onClick={() => jump(1)}
        className={`card flex items-center justify-center rounded-full text-plum-700 ${big ? "h-12 w-12 text-xl" : "h-11 w-11 text-lg"}`}
        aria-label="الآية التالية"
      >
        ⏭
      </button>
      <button
        type="button"
        onClick={toggle}
        className={`flex items-center justify-center rounded-full bg-plum-600 text-white shadow-lg transition active:scale-95 ${big ? "h-16 w-16 text-2xl" : "h-14 w-14 text-2xl"}`}
        aria-label={playing ? "إيقاف" : "تشغيل"}
      >
        {playing ? "⏸" : "▶️"}
      </button>
      <button
        type="button"
        onClick={() => jump(-1)}
        className={`card flex items-center justify-center rounded-full text-plum-700 ${big ? "h-12 w-12 text-xl" : "h-11 w-11 text-lg"}`}
        aria-label="الآية السابقة"
      >
        ⏮
      </button>
    </div>
  );

  return (
    <div>
      <audio
        ref={audioRef}
        onEnded={onEnded}
        onError={onError}
        onPlay={(e) => {
          if (e.currentTarget.playbackRate !== rate) e.currentTarget.playbackRate = rate;
        }}
        preload="auto"
      />

      {/* ① النص: صفحة المصحف أو الآية مكبّرة — مع أزرار صغيرة للتبديل والتكبير */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex gap-1 rounded-full bg-cream p-0.5">
          {(
            [
              { v: "page", label: "📖 المصحف" },
              { v: "text", label: "🔤 الآية" },
            ] as const
          ).map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => {
                setView(o.v);
                savePrefs({ view: o.v });
              }}
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                view === o.v ? "bg-white text-plum-800 shadow-sm" : "text-silver-600"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {view === "page" && (
          <button
            type="button"
            onClick={() => setFull(true)}
            className="rounded-full bg-cream px-3 py-1 text-xs font-bold text-plum-700"
          >
            ⛶ تكبير
          </button>
        )}
      </div>

      {view === "page" ? (
        <MushafPage page={page} currentKey={`${cur.surah}:${cur.ayah}`} wardKeys={wardKeys} onPick={goTo} />
      ) : (
        <div className="card rounded-2xl px-5 py-6 text-center">
          <p className="font-body text-2xl font-medium leading-[2.3] text-ink" dir="rtl">
            {cur.text}
          </p>
        </div>
      )}

      {/* ② المشغّل — يبقى ظاهراً أسفل الشاشة أثناء قراءة الصفحة */}
      <div className="card sticky bottom-3 z-20 mt-3 rounded-2xl p-3 shadow-lg">
        <div className="flex items-center justify-between gap-2 text-xs font-bold">
          <span className="font-kufi text-sm text-plum-800">{refLabel(cur.surah, cur.ayah)}</span>
          <span className="text-silver-600">
            آية {ar(idx + 1)} من {ar(ayahs.length)}
            {perAyah > 1 && ` · تكرار ${ar(Math.min(rep + 1, perAyah))}/${ar(perAyah)}`}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream-dark">
          <div className="h-full rounded-full bg-plum-600 transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        {echoing && (
          <p className="mt-3 animate-pulse rounded-xl bg-plum-600 px-3 py-2 text-center font-kufi text-sm font-bold text-white">
            🎤 ردّدي الآن…
          </p>
        )}
        {finished && (
          <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-center">
            <p className="font-kufi text-sm font-bold text-emerald-700">🎉 أتممتِ وردكِ — بوركتِ!</p>
            <button type="button" onClick={restart} className="mt-1 text-sm font-bold text-plum-700 underline">
              🔄 إعادة من أوله
            </button>
          </div>
        )}
        <div className="mt-3">{controls(false)}</div>
      </div>

      {/* ③ إعدادات التلاوة — مطويّة */}
      <details className="card group mt-3 rounded-2xl">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3">
          <span className="text-sm font-bold text-plum-800">⚙️ إعدادات التلاوة</span>
          <span className="text-xs font-bold text-silver-600">
            {reciterName} · ×{ar(perAyah)}
            {rate !== 1 && ` · ${rateLabel(rate)}`}
            {echo && " · 🎤"} <span className="inline-block transition group-open:rotate-180">▾</span>
          </span>
        </summary>
        <div className="grid gap-3 border-t border-cream-dark px-4 pb-4 pt-3">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-plum-700">🎙️ القارئ</span>
            <select
              className="w-full rounded-xl border border-cream-dark bg-white px-3 py-2.5 text-sm font-bold text-ink"
              value={reciter}
              onChange={(e) => {
                const r = e.target.value as ReciterId;
                setReciter(r);
                savePrefs({ reciter: r });
              }}
            >
              {RECITERS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <div>
            <span className="mb-1 block text-xs font-bold text-plum-700">🔁 تكرار كل آية</span>
            <div className="flex gap-1.5">
              {REPEATS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setPerAyah(n);
                    savePrefs({ perAyah: n });
                  }}
                  className={`flex-1 rounded-xl py-2 text-sm font-bold transition ${
                    perAyah === n ? "bg-plum-600 text-white" : "bg-cream text-silver-600"
                  }`}
                >
                  ×{ar(n)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1 block text-xs font-bold text-plum-700">⏩ سرعة التلاوة</span>
            <div className="flex gap-1.5">
              {RATES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setRate(r);
                    savePrefs({ rate: r });
                  }}
                  className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
                    rate === r ? "bg-plum-600 text-white" : "bg-cream text-silver-600"
                  }`}
                >
                  {rateLabel(r)}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setEcho(!echo);
              savePrefs({ echo: !echo });
            }}
            className={`flex items-center justify-between gap-2 rounded-xl border-2 px-3 py-2.5 text-start text-sm font-bold transition ${
              echo ? "border-plum-600 bg-plum-50 text-plum-800" : "border-cream-dark text-silver-600"
            }`}
          >
            <span>🎤 «ردّدي بعدي» — يصمت بعد كل آية لتردّديها</span>
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 text-xs ${
                echo ? "border-plum-600 bg-plum-600 text-white" : "border-silver-400 text-transparent"
              }`}
            >
              ✓
            </span>
          </button>
        </div>
      </details>

      {/* ⛶ ملء الشاشة */}
      {full && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-cream px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-[max(env(safe-area-inset-top),8px)]">
          <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
            <button
              type="button"
              onClick={() => setFull(false)}
              className="rounded-full bg-white px-3 py-1.5 text-sm font-bold text-plum-700 shadow-sm"
              aria-label="إغلاق ملء الشاشة"
            >
              ✕ تصغير
            </button>
            <span className="text-[11px] font-bold text-silver-600">
              {refLabel(cur.surah, cur.ayah)} · آية {ar(idx + 1)} من {ar(ayahs.length)}
            </span>
          </div>
          <div className="min-h-0 flex-1">
            <MushafPage fill page={page} currentKey={`${cur.surah}:${cur.ayah}`} wardKeys={wardKeys} onPick={goTo} />
          </div>
          <div className="mt-2">{controls(false)}</div>
        </div>
      )}
    </div>
  );
}
