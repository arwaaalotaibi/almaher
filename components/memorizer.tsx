"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchWardAyahs,
  RECITERS,
  type ReciterId,
  type WardAyah,
} from "@/lib/quran-audio";
import { pageOf, refLabel } from "@/lib/mushaf";
import { MushafPage } from "./mushaf-page";
import { buildTrack, silence, stepAt, type Step } from "@/lib/ward-audio";

const ar = (n: number) => n.toLocaleString("ar-EG");
const rateLabel = (r: number) => (r === 1 ? "عادية" : r < 1 ? `🐢 ${ar(r)}×` : `${ar(r)}×`);

const PREFS_KEY = "almaher-memorizer";
const REPEATS = [1, 3, 5, 7];
const RATES = [0.75, 1, 1.25, 1.5]; // سرعة التلاوة
const LOOPS = [1, 2, 3, 0]; // تكرار الورد كاملاً (0 = بلا توقف)
const LINK_MAX = 10; // 🔗 الربط التراكمي: أقصى عدد آيات يُعاد ربطها (حتى لا يطول في المقاطع الكبيرة)

/** 🎧 مسمّعي: تشغيل الورد آيةً آية مع تكرار كل آية ووضع «ردّدي بعدي» */
export function Memorizer({
  from,
  to,
  startAt,
}: {
  from: { surah: number; ayah: number };
  to: { surah: number; ayah: number };
  /** 🔍 البدء من آية معيّنة (من البحث) — n يميّز كل طلب */
  startAt?: { surah: number; ayah: number; n: number } | null;
}) {
  const [ayahs, setAyahs] = useState<WardAyah[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [idx, setIdx] = useState(0); // الآية الجديدة الحالية في الورد
  const [rep, setRep] = useState(0); // التكرار الحالي للآية (0-based)
  // 🔗 التكرار التراكمي: بعد تكرار الآية الجديدة تُربط بما قبلها (من base إلى idx)
  const [mode, setMode] = useState<"each" | "link">("each");
  const [phase, setPhase] = useState<"new" | "link">("new");
  const [linkPos, setLinkPos] = useState(0);
  // 🔄 تكرار الورد كاملاً
  const [loops, setLoops] = useState(1);
  const [loopNo, setLoopNo] = useState(0);
  // 🙈 اختبري نفسك: إخفاء آيات الورد (كاملة أو إلا أول كلمة) وكشفها بالضغط
  const [hide, setHide] = useState<false | "all" | "first">(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [playing, setPlaying] = useState(false);
  const [echoing, setEchoing] = useState(false); // فترة «ردّدي الآن»
  const [finished, setFinished] = useState(false);
  const [reciter, setReciter] = useState<ReciterId>("ar.alafasy");
  const [perAyah, setPerAyah] = useState(3);
  const [rate, setRate] = useState(1);
  const [echo, setEcho] = useState(false);
  const [view, setView] = useState<"page" | "text">("page"); // 📖 صفحة المصحف أو الآية مكبّرة
  const [full, setFull] = useState(false); // ⛶ الصفحة على كامل الشاشة
  const [browse, setBrowse] = useState<number | null>(null); // 📖 صفحة تتصفّحها الطالبة (غير صفحة التلاوة)

  const audioRef = useRef<HTMLAudioElement>(null);
  const playIdx = phase === "link" ? linkPos : idx; // الآية التي تُسمع الآن

  /* التفضيلات المحفوظة */
  useEffect(() => {
    try {
      const p = JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "{}");
      if (RECITERS.some((r) => r.id === p.reciter)) setReciter(p.reciter);
      if (REPEATS.includes(p.perAyah)) setPerAyah(p.perAyah);
      if (RATES.includes(p.rate)) setRate(p.rate);
      if (typeof p.echo === "boolean") setEcho(p.echo);
      if (p.view === "page" || p.view === "text") setView(p.view);
      if (p.mode === "each" || p.mode === "link") setMode(p.mode);
      if (LOOPS.includes(p.loops)) setLoops(p.loops);
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
    setPhase("new");
    setLoopNo(0);
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

  const cur = ayahs?.[playIdx];

  /* 🔍 الانتقال إلى آية من البحث بعد تحميل الورد */
  useEffect(() => {
    if (!startAt || !ayahs) return;
    const i = ayahs.findIndex((a) => a.surah === startAt.surah && a.ayah === startAt.ayah);
    if (i >= 0) seekHead(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startAt?.n, ayahs]);

  /* 🔗 التلاوة المتصلة: ملف واحد يجمع آيات الورد بتكرارها وربطها وصمت «ردّدي بعدي»،
     فتستمر والشاشة مقفلة. الآية الجارية تُعرف من موضع التشغيل. */
  type Track = { url: string; steps: Step[]; lastHead: number; complete: boolean; sig: string };
  const track = useRef<Track | null>(null);
  const stepIdx = useRef(-1);
  const [preparing, setPreparing] = useState(false);
  const sig = `${reciter}|${perAyah}|${mode}|${echo}|${loops}|${ayahs?.length ?? 0}|${ayahs?.[0]?.n ?? 0}`;
  const buildSeq = useRef(0);

  const applyStep = (k: number) => {
    const s = track.current?.steps[k];
    if (!s) return;
    stepIdx.current = k;
    setIdx(s.head);
    setRep(s.rep);
    setLoopNo(s.loop);
    setPhase(s.link ? "link" : "new");
    if (s.link) setLinkPos(s.i);
    setEchoing(s.kind === "silence");
  };

  /** تجهيز الملف من آية معيّنة ودورة معيّنة؛ ثم التشغيل إن طُلب */
  const build = async (head: number, loop: number, play: boolean) => {
    const el = audioRef.current;
    if (!el || !ayahs) return;
    const my = ++buildSeq.current;
    setPreparing(true);
    try {
      const t = await buildTrack(reciter, ayahs, {
        len: ayahs.length, head, loopNo: loop, perAyah, mode, linkMax: LINK_MAX, echo, loops,
      });
      if (my !== buildSeq.current) {
        URL.revokeObjectURL(t.url);
        return;
      }
      if (track.current) URL.revokeObjectURL(track.current.url);
      track.current = { ...t, sig };
      el.src = t.url;
      el.defaultPlaybackRate = rate;
      el.playbackRate = rate;
      applyStep(0);
      if (play) {
        await el.play();
        setPlaying(true);
      }
    } catch {
      if (my === buildSeq.current) {
        setPlaying(false);
        setFailed(true);
      }
    } finally {
      if (my === buildSeq.current) setPreparing(false);
    }
  };

  /** الانتقال إلى آية جديدة: داخل الملف الحالي إن أمكن، وإلا يُجهَّز من جديد */
  const seekHead = (h: number) => {
    const el = audioRef.current;
    const t = track.current;
    setFinished(false);
    if (el && t && t.sig === sig) {
      const curLoop = t.steps[Math.max(0, stepIdx.current)]?.loop ?? 0;
      let k = t.steps.findIndex((s) => s.kind === "new" && s.head === h && s.rep === 0 && s.loop === curLoop);
      if (k < 0) k = t.steps.findIndex((s) => s.kind === "new" && s.head === h && s.rep === 0);
      if (k >= 0) {
        el.currentTime = t.steps[k].t0 + 0.001;
        applyStep(k);
        return;
      }
    }
    setIdx(h);
    setRep(0);
    setPhase("new");
    setEchoing(false);
    void build(h, loopNo, playing);
  };

  const onTime = () => {
    const el = audioRef.current;
    const t = track.current;
    if (!el || !t || el.src !== t.url) return;
    const k = stepAt(t.steps, el.currentTime);
    if (k !== stepIdx.current) applyStep(k);
  };

  /** نهاية الملف: انتهى الورد، أو تُجهَّز النافذة/الدورة التالية */
  const onEnded = () => {
    const t = track.current;
    const el = audioRef.current;
    if (!t || !ayahs || !el || el.src !== t.url) return; // صمت الفتح أو ملف قديم
    if (t.complete) {
      setPlaying(false);
      setEchoing(false);
      setFinished(true);
      return;
    }
    const lastLoop = t.steps[t.steps.length - 1]?.loop ?? 0;
    if (t.lastHead < ayahs.length - 1) void build(t.lastHead + 1, lastLoop, true);
    else void build(0, lastLoop + 1, true);
  };

  // تغيّرت الإعدادات أثناء التشغيل ⇒ يُعاد التجهيز من الآية الحالية
  useEffect(() => {
    if (!track.current || track.current.sig === sig || !ayahs) return;
    if (playing) void build(idx, loopNo, true);
    else track.current = { ...track.current, sig: "" };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  useEffect(
    () => () => {
      if (track.current) URL.revokeObjectURL(track.current.url);
    },
    []
  );

  // عند انتقال التلاوة لآية أخرى تعود الصفحة إلى موضعها
  useEffect(() => setBrowse(null), [playIdx]);

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

  /* 📱 شاشة القفل: اسم الآية والقارئ وأزرار التشغيل/الإيقاف/التالية/السابقة */
  const actionsRef = useRef<{ toggle: () => void; jump: (d: number) => void }>({ toggle: () => {}, jump: () => {} });
  useEffect(() => {
    if (!("mediaSession" in navigator) || !cur) return;
    const name = RECITERS.find((r) => r.id === reciter)?.name ?? "";
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: refLabel(cur.surah, cur.ayah),
        artist: name,
        album: "🎧 مسمّعي — الماهر",
        artwork: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      });
      navigator.mediaSession.playbackState = playing ? "playing" : "paused";
    } catch {
      /* متصفح لا يدعم */
    }
  }, [cur, reciter, playing]);
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const set = (a: MediaSessionAction, h: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(a, h);
      } catch {
        /* إجراء غير مدعوم */
      }
    };
    set("play", () => actionsRef.current.toggle());
    set("pause", () => actionsRef.current.toggle());
    set("nexttrack", () => actionsRef.current.jump(1));
    set("previoustrack", () => actionsRef.current.jump(-1));
    return () => {
      (["play", "pause", "nexttrack", "previoustrack"] as MediaSessionAction[]).forEach((a) => set(a, null));
    };
  }, []);

  /** صمت قصير يُشغَّل فوراً داخل ضغطة المستخدمة — يفتح الصوت على الآيفون قبل اكتمال التجهيز */
  const unlock = (el: HTMLAudioElement) => {
    const h = new Uint8Array([0xff, 0xfb, 0x90, 0x64]);
    el.src = URL.createObjectURL(new Blob([silence(h, 0.1).frames as BlobPart], { type: "audio/mpeg" }));
    void el.play().catch(() => {});
  };

  const toggle = () => {
    const el = audioRef.current;
    if (!el || !cur || preparing) return;
    if (playing) {
      el.pause();
      setPlaying(false);
      return;
    }
    setFinished(false);
    const t = track.current;
    if (t && t.sig === sig && el.src === t.url) {
      void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      return;
    }
    unlock(el);
    void build(idx, loopNo, true);
  };

  const jump = (d: number) => {
    if (!ayahs) return;
    seekHead(Math.max(0, Math.min(ayahs.length - 1, idx + d)));
  };

  /** الانتقال إلى آية بالضغط عليها في صفحة المصحف */
  const goTo = (key: string) => {
    if (!ayahs) return;
    const n = ayahs.findIndex((a) => `${a.surah}:${a.ayah}` === key);
    if (n >= 0) seekHead(n);
  };

  const restart = () => {
    const el = audioRef.current;
    if (!el) return;
    setFinished(false);
    setLoopNo(0);
    unlock(el);
    void build(0, 0, true);
  };

  actionsRef.current = { toggle, jump };

  const wardKeys = new Set((ayahs ?? []).map((a) => `${a.surah}:${a.ayah}`));
  const reveal = (key: string) => setRevealed((r) => new Set(r).add(key));

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

  const readPage = pageOf(cur.surah, cur.ayah);
  const page = browse ?? readPage;
  const turn = (d: 1 | -1) => setBrowse(Math.min(604, Math.max(1, page + d)));
  const back = page !== readPage ? () => setBrowse(null) : undefined;
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
        {preparing ? <span className="animate-pulse text-base">⏳</span> : playing ? "⏸" : "▶️"}
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
        onTimeUpdate={onTime}
        onPause={() => {
          const el = audioRef.current;
          if (el && !el.ended && track.current && el.src === track.current.url) setPlaying(false);
        }}
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
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              setHide(hide ? false : "all");
              setRevealed(new Set());
            }}
            className={`rounded-full px-3 py-1 text-xs font-bold transition ${
              hide ? "bg-plum-600 text-white" : "bg-cream text-plum-700"
            }`}
          >
            🙈 اختبري نفسك
          </button>
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
      </div>

      {/* 🙈 شريط الاختبار */}
      {hide && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-2xl bg-amber-50 px-3 py-2">
          <span className="text-[11px] font-bold text-amber-900">سمّعي من حفظكِ، ثم اضغطي الآية لتكشفيها 👆</span>
          <span className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => setHide(hide === "first" ? "all" : "first")}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                hide === "first" ? "bg-amber-600 text-white" : "bg-white text-amber-800"
              }`}
              aria-pressed={hide === "first"}
            >
              <span
                className={`flex h-3.5 w-3.5 items-center justify-center rounded border text-[9px] ${
                  hide === "first" ? "border-white" : "border-amber-500 text-transparent"
                }`}
              >
                ✓
              </span>
              💡 أول كلمة
            </button>
            {revealed.size > 0 && (
              <button type="button" onClick={() => setRevealed(new Set())} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-amber-800">
                ↺ إخفاء
              </button>
            )}
          </span>
        </div>
      )}

      {view === "page" ? (
        <MushafPage page={page} currentKey={`${cur.surah}:${cur.ayah}`} wardKeys={wardKeys} onPick={goTo} onTurn={turn} onBack={back} hide={hide || undefined} revealed={revealed} onReveal={reveal} />
      ) : (
        <div className="card rounded-2xl px-5 py-6 text-center">
          {hide && !revealed.has(`${cur.surah}:${cur.ayah}`) ? (
            <button type="button" onClick={() => reveal(`${cur.surah}:${cur.ayah}`)} className="w-full rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 px-4 py-6">
              {hide === "first" && (
                <span className="mb-2 block font-body text-2xl font-medium text-ink" dir="rtl">
                  {cur.text.split(" ")[0]} …
                </span>
              )}
              <span className="text-sm font-bold text-amber-800">🙈 الآية مخفية — سمّعيها ثم اضغطي لكشفها</span>
            </button>
          ) : (
            <p className="font-body text-2xl font-medium leading-[2.3] text-ink" dir="rtl">
              {cur.text}
            </p>
          )}
        </div>
      )}

      {/* ② المشغّل — يبقى ظاهراً أسفل الشاشة أثناء قراءة الصفحة */}
      <div className="card sticky bottom-3 z-20 mt-3 rounded-2xl p-3 shadow-lg">
        <div className="flex items-center justify-between gap-2 text-xs font-bold">
          <span className="font-kufi text-sm text-plum-800">{refLabel(cur.surah, cur.ayah)}</span>
          <span className="text-silver-600">
            {phase === "link"
              ? `🔗 ربط ${ar(ayahs[Math.max(0, idx - (LINK_MAX - 1))].ayah)}–${ar(ayahs[idx].ayah)}`
              : `آية ${ar(idx + 1)} من ${ar(ayahs.length)}${perAyah > 1 ? ` · تكرار ${ar(Math.min(rep + 1, perAyah))}/${ar(perAyah)}` : ""}`}
            {loops !== 1 && ` · 🔄 ${loops === 0 ? `الدورة ${ar(loopNo + 1)}` : `${ar(loopNo + 1)}/${ar(loops)}`}`}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream-dark">
          <div className="h-full rounded-full bg-plum-600 transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        {preparing && (
          <p className="mt-2 text-center text-[11px] font-bold text-silver-600">⏳ جارٍ تجهيز التلاوة المتصلة…</p>
        )}
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
            {mode === "link" && " · 🔗"}
            {loops !== 1 && ` · 🔄${loops === 0 ? "∞" : ar(loops)}`}
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
            <span className="mb-1 block text-xs font-bold text-plum-700">🔗 طريقة التكرار</span>
            <div className="flex gap-1.5">
              {(
                [
                  { v: "each", label: "كل آية وحدها" },
                  { v: "link", label: "🔗 تراكمي (ربط)" },
                ] as const
              ).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => {
                    setMode(o.v);
                    setPhase("new");
                    savePrefs({ mode: o.v });
                  }}
                  className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
                    mode === o.v ? "bg-plum-600 text-white" : "bg-cream text-silver-600"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {mode === "link" && (
              <p className="mt-1 text-[10px] font-bold text-silver-600">
                تُكرَّر الآية الجديدة، ثم تُقرأ مع ما قبلها لتترابط: ١ ← ١–٢ ← ١–٣ … (حتى ١٠ آيات)
              </p>
            )}
          </div>
          <div>
            <span className="mb-1 block text-xs font-bold text-plum-700">🔄 تكرار الورد كاملاً</span>
            <div className="flex gap-1.5">
              {LOOPS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setLoops(n);
                    savePrefs({ loops: n });
                  }}
                  className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
                    loops === n ? "bg-plum-600 text-white" : "bg-cream text-silver-600"
                  }`}
                >
                  {n === 0 ? "∞ بلا توقف" : n === 1 ? "مرة" : `×${ar(n)}`}
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
              {refLabel(cur.surah, cur.ayah)} · آية {ar(playIdx + 1)} من {ar(ayahs.length)}
            </span>
          </div>
          <div className="min-h-0 flex-1">
            <MushafPage fill page={page} currentKey={`${cur.surah}:${cur.ayah}`} wardKeys={wardKeys} onPick={goTo} onTurn={turn} onBack={back} hide={hide || undefined} revealed={revealed} onReveal={reveal} />
          </div>
          <div className="mt-2">{controls(false)}</div>
        </div>
      )}
    </div>
  );
}
