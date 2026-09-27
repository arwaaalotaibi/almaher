"use client";

import { useEffect, useState } from "react";
import { enablePush, getPushState, isIOS, isStandalone, pushSupported } from "@/lib/push";
import { Sheet } from "./ui";

/** 🔔 نافذة تدعو الطالبة لتفعيل الإشعارات — تظهر بعد دخولها إن لم تكن مفعّلة.
    • أندرويد، أو آيفون من أيقونة الشاشة الرئيسية: زر يطلب الإذن مباشرة.
    • آيفون من Safari: لا يمكن طلب الإذن قبل الإضافة للشاشة الرئيسية — نشرح الخطوات.
    «لاحقاً» يؤجّلها ٣ أيام، وتتوقف بعد ٣ مرات. لا تظهر للمفعّلة ولا لمن رفضت الإذن
    (المتصفح لا يعيد السؤال بعد الرفض). */

const PROMPT_KEY = "almaher-push-prompt";
const MAX_TIMES = 3;
const GAP_MS = 3 * 24 * 60 * 60 * 1000;
const DELAY_MS = 3500; // بعد شاشة الترحيب

type Mode = "ask" | "iosInstall";

function readSeen(): { n: number; at: number } {
  try {
    const v = JSON.parse(window.localStorage.getItem(PROMPT_KEY) ?? "null");
    return { n: Number(v?.n) || 0, at: Number(v?.at) || 0 };
  } catch {
    return { n: 0, at: 0 };
  }
}

function markSeen(final = false) {
  try {
    const { n } = readSeen();
    window.localStorage.setItem(
      PROMPT_KEY,
      JSON.stringify({ n: final ? MAX_TIMES : n + 1, at: Date.now() })
    );
  } catch {
    /* تخزين معطّل — قد تظهر مرة أخرى، لا بأس */
  }
}

export function PushPrompt({
  studentId,
  halaqaId,
  enabled,
}: {
  studentId: string;
  halaqaId: string;
  /** لا تظهر فوق اللائحة أو جولة الشرح */
  enabled: boolean;
}) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const { n, at } = readSeen();
    if (n >= MAX_TIMES || Date.now() - at < GAP_MS) return;
    let alive = true;
    const t = window.setTimeout(async () => {
      let m: Mode | null = null;
      if (isIOS() && !isStandalone()) m = "iosInstall";
      else if (pushSupported() && (await getPushState()) === "default") m = "ask";
      if (alive && m) setMode(m);
    }, DELAY_MS);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [enabled]);

  const later = () => {
    markSeen();
    setMode(null);
  };

  const enable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const st = await enablePush(studentId, halaqaId);
      if (st === "subscribed" || st === "denied") {
        markSeen(true); // تمّ القرار — لا نسأل ثانية
        setMode(null);
      }
    } catch (e) {
      window.alert(
        e instanceof Error && e.message ? e.message : "تعذّر تفعيل الإشعارات — حاولي مرة أخرى من 🔔"
      );
    } finally {
      setBusy(false);
    }
  };

  if (!mode) return null;

  return (
    <Sheet open onClose={later}>
      {mode === "ask" ? (
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-plum-50 text-5xl ring-8 ring-plum-100">
            🔔
          </div>
          <h2 className="mt-3 font-kufi text-2xl font-bold text-plum-800">خلّي الماهر يذكّركِ</h2>
          <p className="mt-1 text-sm font-bold text-silver-600">فعّلي الإشعارات ليصلكِ:</p>
          <div className="mt-3 grid gap-2 text-start">
            {[
              ["🌙", "تذكير قبل لقائكِ بالمطلوب"],
              ["✅", "«أحسنتِ» فور اعتماد تسميعكِ"],
              ["✉️", "رسائل الإدارة وإعلانات الحلقة"],
            ].map(([i, t]) => (
              <div key={t} className="flex items-center gap-3 rounded-xl bg-plum-50 px-3 py-2.5 text-sm font-bold text-plum-800">
                <span className="text-xl">{i}</span>
                {t}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={enable}
            className="mt-4 w-full rounded-2xl bg-plum-600 py-3.5 font-kufi text-lg font-bold text-white transition active:scale-[0.98]"
          >
            {busy ? "⏳ …" : "🔔 فعّلي الإشعارات"}
          </button>
          <button type="button" onClick={later} className="mt-2 w-full py-2 text-sm font-bold text-silver-600">
            لاحقاً
          </button>
        </div>
      ) : (
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-plum-50 text-5xl ring-8 ring-plum-100">
            📲
          </div>
          <h2 className="mt-3 font-kufi text-2xl font-bold text-plum-800">أضيفي الماهر لشاشتكِ</h2>
          <p className="mt-1 text-sm font-bold text-silver-600">
            على الآيفون تصل الإشعارات بعد هذه الخطوة فقط
          </p>
          <div className="mt-3 grid gap-2 text-start">
            {[
              <>اضغطي زر المشاركة <span className="rounded-md border border-cream-dark bg-white px-1.5 text-[#3478f6]">⬆︎</span> في Safari</>,
              <>اختاري «إضافة إلى الشاشة الرئيسية» ⊞ ثم «إضافة»</>,
              <>افتحي الماهر من أيقونته الجديدة — وسيسألكِ عن الإشعارات</>,
            ].map((t, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-plum-50 px-3 py-2.5 text-sm font-bold text-plum-800">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold text-sm text-white">
                  {(i + 1).toLocaleString("ar-EG")}
                </span>
                <span>{t}</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={later}
            className="mt-4 w-full rounded-2xl border-2 border-plum-200 bg-white py-3 font-kufi text-lg font-bold text-plum-700 transition active:scale-[0.98]"
          >
            فهمت 👍
          </button>
        </div>
      )}
    </Sheet>
  );
}
