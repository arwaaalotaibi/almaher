"use client";

import { useState } from "react";
import {
  actions,
  SUPPORT_KINDS,
  useApp,
  type SupportKind,
} from "@/lib/store";
import { inputCls, PrimaryBtn, Sheet } from "./ui";

/** 🛟 الدعم والاقتراحات: الطالبة ترسل مشكلة/اقتراحاً/استفساراً وتتابع الرد */
export function SupportBox({ studentId }: { studentId: string }) {
  const { support } = useApp();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<SupportKind>("issue");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);

  const mine = support.filter((m) => m.studentId === studentId);
  const hasNewReply = mine.some((m) => m.status === "done" && m.reply);

  const send = () => {
    if (body.trim().length < 3) {
      window.alert("اكتبي رسالتك أولاً");
      return;
    }
    actions.addSupport(studentId, kind, body);
    setBody("");
    setSent(true);
    setTimeout(() => setSent(false), 2500);
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ar-u-ca-gregory-nu-arab", {
      day: "numeric",
      month: "long",
    });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="card mx-auto mt-8 flex items-center gap-2 rounded-full px-5 py-2.5 font-kufi text-sm font-bold text-plum-700 transition active:scale-[0.98]"
      >
        🛟 الدعم والاقتراحات
        {hasNewReply && (
          <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
            تم الرد ✓
          </span>
        )}
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="🛟 الدعم والاقتراحات"
      >
        <p className="mb-3 rounded-xl bg-plum-50 px-3 py-2.5 text-xs font-bold text-plum-700">
          واجهتك مشكلة في التطبيق؟ عندك فكرة تطوّره؟ اكتبيها وستصل الإدارة
          مباشرة 🌸
        </p>

        {/* نوع الرسالة */}
        <div className="mb-3 grid grid-cols-3 gap-2">
          {SUPPORT_KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              onClick={() => setKind(k.key)}
              className={`rounded-xl border-2 py-2.5 text-xs font-bold transition ${
                kind === k.key
                  ? "border-plum-600 bg-plum-50 text-plum-800"
                  : "border-cream-dark text-silver-600"
              }`}
            >
              <span className="block text-lg">{k.icon}</span>
              {k.label}
            </button>
          ))}
        </div>

        <textarea
          className={`${inputCls} min-h-24`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            kind === "issue"
              ? "صفي المشكلة: ماذا حصل؟ وفي أي شاشة؟"
              : kind === "idea"
                ? "ما فكرتك؟ وكيف تساعدك في حفظك؟"
                : "ما سؤالك؟"
          }
        />
        <PrimaryBtn onClick={send}>
          {sent ? "وصلت رسالتك ✓" : "📨 إرسال"}
        </PrimaryBtn>

        {/* رسائلي السابقة وردود الإدارة */}
        {mine.length > 0 && (
          <>
            <p className="mb-2 mt-5 font-kufi text-sm font-bold text-plum-700">
              رسائلي السابقة
            </p>
            <div className="grid gap-2">
              {mine.map((m) => {
                const k = SUPPORT_KINDS.find((x) => x.key === m.kind);
                return (
                  <div key={m.id} className="rounded-xl bg-cream/60 p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-plum-700">
                        {k?.icon} {k?.label} · {fmtDate(m.createdAt)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          m.status === "done"
                            ? "bg-emerald-500 text-white"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {m.status === "done" ? "تم الرد ✓" : "قيد المراجعة ⏳"}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-ink">{m.body}</p>
                    {m.reply && (
                      <div className="mt-2 rounded-xl bg-plum-50 px-3 py-2">
                        <p className="text-[10px] font-bold text-plum-600">
                          ردّ الإدارة:
                        </p>
                        <p className="text-sm font-bold text-plum-800">
                          {m.reply}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Sheet>
    </>
  );
}
