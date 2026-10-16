"use client";

import { useEffect, useRef, useState } from "react";
import { addRecording, deleteRecording, listRecordings, recordingOwner, type Recording } from "@/lib/recordings";

const ar = (n: number) => n.toLocaleString("ar-EG");
// ⁦…⁩ يعزل الوقت فيُقرأ «٠:٠٤» لا «٠٤:٠» داخل النص العربي
const clock = (s: number) => `\u2066${ar(Math.floor(s / 60))}:${String(Math.floor(s % 60)).padStart(2, "0").replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)])}\u2069`;
const when = (t: number) =>
  new Date(t).toLocaleString("ar-u-ca-gregory-nu-arab", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });

const pickType = () => {
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"]) if (MediaRecorder.isTypeSupported(t)) return t;
  return "";
};

/** 🎙️ سجّلي صوتكِ — تسمّع الطالبة وتسجّل، ثم تسمع تسجيلها وتصحّح لنفسها.
    التسجيلات في جهازها فقط. */
export function VoiceRecorder({
  label,
  onStart,
  onStop,
}: {
  label: string; // المقطع الحالي
  onStart?: () => void; // إيقاف القارئ وإخفاء الآيات
  onStop?: () => void; // كشف الآيات للمقارنة
}) {
  const [recs, setRecs] = useState<Recording[]>([]);
  const [rec, setRec] = useState<{ t0: number } | null>(null);
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState("");
  const [openList, setOpenList] = useState(false);
  const [playingId, setPlayingId] = useState("");
  const [pos, setPos] = useState(0);
  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef("");

  const owner = useRef("me");
  const reload = () => listRecordings(owner.current).then(setRecs).catch(() => {});
  useEffect(() => {
    owner.current = recordingOwner();
    void reload();
    return () => {
      stream.current?.getTracks().forEach((t) => t.stop());
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!rec) return;
    const t = window.setInterval(() => setSecs((Date.now() - rec.t0) / 1000), 250);
    return () => window.clearInterval(t);
  }, [rec]);

  const start = async () => {
    setErr("");
    const type = pickType();
    if (!navigator.mediaDevices?.getUserMedia || !type) {
      setErr("جهازكِ لا يدعم التسجيل من المتصفح 😔");
      return;
    }
    try {
      stopPlayback();
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = s;
      const m = new MediaRecorder(s, { mimeType: type });
      chunks.current = [];
      m.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      const t0 = Date.now();
      m.onstop = async () => {
        s.getTracks().forEach((t) => t.stop());
        stream.current = null;
        const duration = (Date.now() - t0) / 1000;
        if (duration < 1 || !chunks.current.length) return;
        const blob = new Blob(chunks.current, { type: m.mimeType || type });
        await addRecording({ id: `${t0}`, owner: owner.current, label, createdAt: t0, duration, type: blob.type, blob }).catch(() =>
          setErr("تعذّر حفظ التسجيل — قد تكون ذاكرة الجهاز ممتلئة")
        );
        await reload();
        setOpenList(true);
      };
      mr.current = m;
      m.start(1000);
      setSecs(0);
      setRec({ t0 });
      onStart?.();
    } catch {
      setErr("اسمحي للتطبيق باستخدام الميكروفون من إعدادات الجوال 🎙️");
    }
  };

  const stop = () => {
    mr.current?.stop();
    mr.current = null;
    setRec(null);
    onStop?.();
  };

  const stopPlayback = () => {
    player.current?.pause();
    setPlayingId("");
  };

  const play = (r: Recording) => {
    if (playingId === r.id) {
      stopPlayback();
      return;
    }
    if (!player.current) player.current = new Audio();
    const el = player.current;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = URL.createObjectURL(r.blob);
    el.src = urlRef.current;
    el.ontimeupdate = () => setPos(el.currentTime);
    el.onended = () => setPlayingId("");
    setPos(0);
    setPlayingId(r.id);
    void el.play().catch(() => setPlayingId(""));
  };

  const remove = async (r: Recording) => {
    if (!window.confirm("حذف هذا التسجيل من جهازكِ؟")) return;
    if (playingId === r.id) stopPlayback();
    await deleteRecording(r.id).catch(() => {});
    await reload();
  };

  return (
    <div className="card mt-3 rounded-2xl p-3">
      {/* شريط ثابت أعلى الشاشة أثناء التسجيل — تُوقفه الطالبة وهي في أي مكان من الصفحة */}
      {rec && (
        <div className="fixed inset-x-3 top-3 z-50 mx-auto flex max-w-md items-center justify-between gap-2 rounded-2xl bg-red-600 px-4 py-2.5 text-white shadow-xl">
          <span className="flex items-center gap-2 text-sm font-bold">
            <span className="h-3 w-3 animate-pulse rounded-full bg-white" />
            🎙️ {clock(secs)}
          </span>
          <button type="button" onClick={stop} className="rounded-full bg-white px-4 py-1 text-sm font-bold text-red-700">
            ⏹ إيقاف
          </button>
        </div>
      )}
      {rec ? (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-red-50 px-3 py-2.5">
          <span className="flex items-center gap-2 text-sm font-bold text-red-800">
            <span className="h-3 w-3 animate-pulse rounded-full bg-red-600" />
            جارٍ التسجيل {clock(secs)}
          </span>
          <button type="button" onClick={stop} className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-bold text-white">
            ⏹ إيقاف
          </button>
        </div>
      ) : (
        <button type="button" onClick={start} className="w-full rounded-xl bg-plum-600 py-2.5 font-kufi text-sm font-bold text-white">
          🎙️ سمّعي وسجّلي صوتكِ
        </button>
      )}
      <p className="mt-1.5 text-center text-[11px] font-bold text-silver-600">
        تُخفى الآيات وأنتِ تسمّعين، ثم استمعي لتسجيلكِ والمصحف أمامكِ · 🔒 التسجيل في جوالكِ فقط
      </p>
      {err && <p className="mt-1.5 text-center text-xs font-bold text-red-700">{err}</p>}

      {recs.length > 0 && (
        <div className="mt-2">
          <button type="button" onClick={() => setOpenList((v) => !v)} className="flex w-full items-center justify-between text-xs font-bold text-plum-700">
            <span>🎧 تسجيلاتي ({ar(recs.length)})</span>
            <span className={`transition ${openList ? "rotate-180" : ""}`}>▾</span>
          </button>
          {openList && (
            <div className="mt-2 grid gap-1.5">
              {recs.map((r) => {
                const on = playingId === r.id;
                return (
                  <div key={r.id} className={`rounded-xl px-3 py-2 ${on ? "bg-plum-50 ring-1 ring-plum-200" : "bg-cream/70"}`}>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => play(r)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-plum-600 text-sm text-white"
                        aria-label={on ? "إيقاف" : "تشغيل"}
                      >
                        {on ? "⏸" : "▶"}
                      </button>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-plum-800">{r.label}</span>
                        <span className="block text-[10px] text-silver-600">
                          {when(r.createdAt)} · {clock(on ? pos : r.duration)}
                          {on && ` / ${clock(r.duration)}`}
                        </span>
                      </span>
                      <button type="button" onClick={() => remove(r)} className="shrink-0 text-sm" aria-label="حذف التسجيل">
                        🗑️
                      </button>
                    </div>
                    {on && (
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-cream-dark">
                        <div className="h-full bg-plum-600" style={{ width: `${Math.min(100, (pos / Math.max(1, r.duration)) * 100)}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
              <p className="text-center text-[10px] font-bold text-silver-600">
                💡 أخطأتِ في آية؟ اضغطي عليها مطوّلاً في المصحف ولوّنيها 🔴 · يُحفظ آخر ٣٠ تسجيلاً
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
