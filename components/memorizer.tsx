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

const PREFS_KEY = "almaher-memorizer";
const REPEATS = [1, 3, 5, 7];

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

  return (
    <div>
      <audio ref={audioRef} onEnded={onEnded} onError={onError} preload="auto" />

      {/* طريقة العرض */}
      <div className="mb-2.5 flex gap-1 rounded-2xl bg-cream p-1">
        {(
          [
            { v: "page", label: "📖 صفحة المصحف" },
            { v: "text", label: "🔤 الآية مكبّرة" },
          ] as const
        ).map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => {
              setView(o.v);
              savePrefs({ view: o.v });
            }}
            className={`flex-1 rounded-xl py-2 font-kufi text-sm font-bold transition ${
              view === o.v ? "bg-white text-plum-800 shadow-sm" : "text-silver-600"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* الآية الحالية */}
      <div className={view === "page" ? "text-center" : "card rounded-2xl p-5 text-center"}>
        <p className="mb-3 flex items-center justify-center gap-2 text-[11px] font-bold text-silver-600">
          <span className="rounded-full bg-plum-100 px-2.5 py-0.5 text-plum-700">
            آية {ar(idx + 1)} من {ar(ayahs.length)}
          </span>
          <span className="rounded-full bg-plum-100 px-2.5 py-0.5 text-plum-700">
            تكرار {ar(Math.min(rep + 1, perAyah))} / {ar(perAyah)}
          </span>
        </p>
        {view === "page" ? (
          <>
            <MushafPage
              page={pageOf(cur.surah, cur.ayah)}
              currentKey={`${cur.surah}:${cur.ayah}`}
              wardKeys={wardKeys}
              onPick={goTo}
            />
            <button
              type="button"
              onClick={() => setFull(true)}
              className="mx-auto mt-2 flex items-center gap-1.5 rounded-full bg-plum-600 px-4 py-2 font-kufi text-sm font-bold text-white shadow"
            >
              ⛶ تكبير الصفحة على الشاشة
            </button>
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
                    آية {ar(idx + 1)} من {ar(ayahs.length)} · تكرار {ar(Math.min(rep + 1, perAyah))}/{ar(perAyah)}
                  </span>
                </div>
                <div className="min-h-0 flex-1">
                  <MushafPage
                    fill
                    page={pageOf(cur.surah, cur.ayah)}
                    currentKey={`${cur.surah}:${cur.ayah}`}
                    wardKeys={wardKeys}
                    onPick={goTo}
                  />
                </div>
                <div className="mt-2 flex items-center justify-center gap-4">
                  <button type="button" onClick={() => jump(1)} className="card flex h-11 w-11 items-center justify-center rounded-full text-lg text-plum-700" aria-label="الآية التالية">
                    ⏭
                  </button>
                  <button
                    type="button"
                    onClick={toggle}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-plum-600 text-2xl text-white shadow-lg transition active:scale-95"
                    aria-label={playing ? "إيقاف" : "تشغيل"}
                  >
                    {playing ? "⏸" : "▶️"}
                  </button>
                  <button type="button" onClick={() => jump(-1)} className="card flex h-11 w-11 items-center justify-center rounded-full text-lg text-plum-700" aria-label="الآية السابقة">
                    ⏮
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <p
            className="font-body text-2xl font-medium leading-[2.3] text-ink"
            dir="rtl"
          >
            {cur.text}
          </p>
        )}
        <p className="mt-3 font-kufi text-sm font-bold text-plum-700">
          {refLabel(cur.surah, cur.ayah)}
        </p>
        {echoing && (
          <p className="mt-2 animate-pulse rounded-xl bg-plum-600 px-3 py-2 font-kufi text-sm font-bold text-white">
            🎤 ردّدي الآن…
          </p>
        )}
        {finished && (
          <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2.5">
            <p className="font-kufi text-sm font-bold text-emerald-700">
              🎉 أتممتِ وردك — بوركتِ! أعيديه أو سمّعيه لمعلّمتك
            </p>
            <button
              type="button"
              onClick={restart}
              className="mt-1.5 text-sm font-bold text-plum-700 underline"
            >
              🔄 إعادة الورد من أوله
            </button>
          </div>
        )}
      </div>

      {/* شريط التقدّم عبر الورد */}
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-cream-dark">
        <div
          className="h-full rounded-full bg-plum-600 transition-all"
          style={{
            width: `${((idx + (rep + 1) / perAyah) / ayahs.length) * 100}%`,
          }}
        />
      </div>

      {/* أزرار التشغيل */}
      <div className="mt-4 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => jump(1)}
          className="card flex h-12 w-12 items-center justify-center rounded-full text-xl text-plum-700"
          aria-label="الآية التالية"
        >
          ⏭
        </button>
        <button
          type="button"
          onClick={toggle}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-plum-600 text-2xl text-white shadow-lg transition active:scale-95"
          aria-label={playing ? "إيقاف" : "تشغيل"}
        >
          {playing ? "⏸" : "▶️"}
        </button>
        <button
          type="button"
          onClick={() => jump(-1)}
          className="card flex h-12 w-12 items-center justify-center rounded-full text-xl text-plum-700"
          aria-label="الآية السابقة"
        >
          ⏮
        </button>
      </div>

      {/* الإعدادات */}
      <div className="card mt-4 grid gap-3 rounded-2xl p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-plum-700">
            🎙️ القارئ
          </span>
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
          <span className="mb-1 block text-xs font-bold text-plum-700">
            🔁 تكرار كل آية
          </span>
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
                  perAyah === n
                    ? "bg-plum-600 text-white"
                    : "bg-cream text-silver-600"
                }`}
              >
                ×{ar(n)}
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
          className={`flex items-center justify-between rounded-xl border-2 px-3 py-2.5 text-sm font-bold transition ${
            echo
              ? "border-plum-600 bg-plum-50 text-plum-800"
              : "border-cream-dark text-silver-600"
          }`}
        >
          <span>🎤 وضع «ردّدي بعدي» — يصمت بعد كل آية لتردّدي</span>
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 text-xs ${
              echo
                ? "border-plum-600 bg-plum-600 text-white"
                : "border-silver-400 text-transparent"
            }`}
          >
            ✓
          </span>
        </button>
      </div>
    </div>
  );
}
