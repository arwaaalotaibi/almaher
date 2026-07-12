"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  audioUrl,
  fetchWardAyahs,
  RECITERS,
  type ReciterId,
  type WardAyah,
} from "@/lib/quran-audio";
import { refLabel } from "@/lib/mushaf";

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
      el.src = audioUrl(reciter, cur.n);
      void el.play().catch(() => setPlaying(false));
    }
    // تحميل مسبق للآية التالية
    const next = ayahs?.[idx + 1];
    if (next) new Audio(audioUrl(reciter, next.n)).preload = "auto";
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
      if (!el.src) el.src = audioUrl(reciter, cur.n);
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
      el.src = audioUrl(reciter, ayahs[n].n);
      if (playing) void el.play().catch(() => setPlaying(false));
    }
  };

  const restart = () => {
    setIdx(0);
    setRep(0);
    setFinished(false);
    const el = audioRef.current;
    if (el && ayahs?.[0]) {
      el.src = audioUrl(reciter, ayahs[0].n);
      void el.play().catch(() => setPlaying(false));
      setPlaying(true);
    }
  };

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
      <audio ref={audioRef} onEnded={onEnded} preload="auto" />

      {/* الآية الحالية */}
      <div className="card rounded-2xl p-5 text-center">
        <p className="mb-3 flex items-center justify-center gap-2 text-[11px] font-bold text-silver-600">
          <span className="rounded-full bg-plum-100 px-2.5 py-0.5 text-plum-700">
            آية {ar(idx + 1)} من {ar(ayahs.length)}
          </span>
          <span className="rounded-full bg-plum-100 px-2.5 py-0.5 text-plum-700">
            تكرار {ar(Math.min(rep + 1, perAyah))} / {ar(perAyah)}
          </span>
        </p>
        <p
          className="font-body text-2xl font-medium leading-[2.3] text-ink"
          dir="rtl"
        >
          {cur.text}
        </p>
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
