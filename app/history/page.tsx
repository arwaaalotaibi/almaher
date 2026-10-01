"use client";

import { useEffect, useMemo, useState } from "react";
import {
  actions,
  fetchSessionHistory,
  halaqaTitle,
  recitePartLabel,
  useApp,
  type RecitationLog,
  type SessionHistoryRow,
} from "@/lib/store";
import { facesLabel } from "@/lib/arabic";
import { PageHeader, Sheet, inputCls } from "@/components/ui";
import { RoleOnly } from "@/components/admin-only";

const fmtDay = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("ar-u-ca-gregory-nu-arab", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("ar-u-ca-gregory-nu-arab", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

/** 🗂️ أرشيف سجلات التسميع — كل سجلّ حُذف أو عُدّل (قبل الحذف/التعديل) مع من فعل ذلك ومتى،
    واسترجاعه بضغطة. للإدارة فقط. */
export default function HistoryPage() {
  return (
    <RoleOnly roles={["admin"]}>
      <HistoryInner />
    </RoleOnly>
  );
}

type Filter = "all" | "delete" | "update";

function Parts({ log }: { log: Omit<RecitationLog, "id" | "createdAt"> }) {
  if (!log.attended) return <p className="text-sm font-bold text-amber-700">🚫 غائبة</p>;
  const rows: [string, string, number | undefined][] = [
    ["📖 حفظ", recitePartLabel(log.tasmi), log.faces?.tasmi],
    ["📌 تثبيت", recitePartLabel(log.tathbit), log.faces?.tathbit],
    ["🔁 مراجعة", recitePartLabel(log.muraja), log.faces?.muraja],
  ];
  const shown = rows.filter(([, l]) => l);
  if (shown.length === 0) return <p className="text-sm text-silver-600">حاضرة — بلا مقاطع</p>;
  return (
    <div className="grid gap-0.5">
      {shown.map(([k, l, f]) => (
        <p key={k} className="text-sm text-ink">
          <span className="font-bold text-plum-700">{k}:</span> {l}
          {f ? <span className="text-silver-600"> ({facesLabel(f)})</span> : null}
        </p>
      ))}
      {log.note && <p className="text-xs text-amber-800">📝 {log.note}</p>}
    </div>
  );
}

function HistoryInner() {
  const { students, halaqas, recitations } = useApp();
  const [state, setState] = useState<{ ready: boolean; rows: SessionHistoryRow[] } | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [restored, setRestored] = useState<Set<number>>(new Set());
  // 🔒 نافذة تأكيد الاسترجاع: مقارنة + «راجعتُ» + كتابة «استرجاع» — حتى لا يُسترجع بالخطأ
  const [pending, setPending] = useState<SessionHistoryRow | null>(null);
  const [checked, setChecked] = useState(false);
  const [typed, setTyped] = useState("");
  const WORD = "استرجاع";
  const norm = (x: string) => x.replace(/[\sً-ْ]/g, "").replace(/[أإآ]/g, "ا");
  const ready = checked && norm(typed) === norm(WORD);
  const openConfirm = (r: SessionHistoryRow) => {
    setPending(r);
    setChecked(false);
    setTyped("");
  };

  const load = () => {
    setState(null);
    fetchSessionHistory().then(setState).catch(() => setState({ ready: false, rows: [] }));
  };
  useEffect(load, []);

  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const rows = useMemo(() => {
    const term = q.trim();
    return (state?.rows ?? []).filter((r) => {
      if (filter !== "all" && r.op !== filter) return false;
      if (term && !(byId.get(r.log.studentId)?.name ?? "").includes(term)) return false;
      return true;
    });
  }, [state, filter, q, byId]);

  const doRestore = () => {
    if (!pending || !ready) return;
    actions.restoreRecitation(pending);
    setRestored((x) => new Set(x).add(pending.hid));
    setPending(null);
  };


  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-8">
      <PageHeader title="🗂️ أرشيف السجلات" back="/" />
      <p className="mb-4 text-sm text-silver-600">
        كل سجلّ تسميع حُذف (مثل «↩️ التراجع عن الاعتماد») أو عُدّل تُحفظ نسخته السابقة هنا مع من قام
        بذلك ومتى — واسترجعيه بضغطة إن كان خطأً.
      </p>

      {state === null ? (
        <p className="py-10 text-center text-sm font-bold text-silver-600">جاري التحميل…</p>
      ) : !state.ready ? (
        <div className="card rounded-2xl p-4 text-center text-sm font-bold text-amber-800">
          الأرشيف غير مفعّل بعد — شغّلي ملف <span dir="ltr">schema-v15-sessions-history.sql</span> في
          Supabase، ثم افتحي الصفحة من جديد.
        </div>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {(
              [
                ["all", "الكل"],
                ["delete", "🗑️ المحذوفة"],
                ["update", "✏️ المعدّلة"],
              ] as [Filter, string][]
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`rounded-xl border-2 py-2 text-sm font-bold ${
                  filter === k ? "border-plum-600 bg-plum-600 text-white" : "border-cream-dark bg-white text-plum-800"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <input
            className={`${inputCls} mb-4`}
            placeholder="🔎 ابحثي باسم الطالبة"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          {rows.length === 0 ? (
            <p className="card rounded-2xl py-8 text-center text-sm font-bold text-silver-600">
              لا شيء هنا — لم يُحذف أو يُعدَّل أي سجلّ منذ تفعيل الأرشيف 🌸
            </p>
          ) : (
            <div className="grid gap-2.5">
              {rows.map((r) => {
                const st = byId.get(r.log.studentId);
                const name = st?.name ?? "طالبة محذوفة";
                const h = halaqas.find((x) => x.id === st?.halaqaId);
                const cur = recitations.find(
                  (x) => x.id === r.sessionId || (x.studentId === r.log.studentId && x.date === r.log.date)
                );
                const done = restored.has(r.hid);
                return (
                  <div key={r.hid} className="card rounded-2xl p-3.5">
                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-kufi text-base font-bold text-plum-800">{name}</p>
                        <p className="text-xs text-silver-600">
                          {h ? halaqaTitle(h) : ""} · لقاء {fmtDay(r.log.date)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          r.op === "delete" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"
                        }`}
                      >
                        {r.op === "delete" ? "🗑️ حُذف" : "✏️ عُدّل"}
                      </span>
                    </div>
                    <p className="mb-2 text-[11px] font-bold text-silver-600">
                      {r.actor || "غير معروف"} · {fmtWhen(r.changedAt)}
                    </p>

                    <div className="rounded-xl bg-cream px-3 py-2">
                      <p className="mb-1 text-[11px] font-bold text-silver-600">
                        {r.op === "delete" ? "السجلّ المحذوف:" : "قبل التعديل:"}
                      </p>
                      <Parts log={r.log} />
                    </div>
                    {cur && (
                      <div className="mt-1.5 rounded-xl border border-cream-dark px-3 py-2">
                        <p className="mb-1 text-[11px] font-bold text-silver-600">الموجود الآن:</p>
                        <Parts log={cur} />
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={done}
                      onClick={() => openConfirm(r)}
                      className={`mt-2.5 w-full rounded-xl py-2.5 text-sm font-bold transition active:scale-[0.98] ${
                        done ? "bg-emerald-50 text-emerald-700" : "bg-plum-600 text-white"
                      }`}
                    >
                      {done ? "✓ تم الاسترجاع" : cur ? "↩️ استرجاع هذه النسخة بدل الحالية" : "↩️ استرجاع السجلّ"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <button
            type="button"
            onClick={load}
            className="mx-auto mt-5 block text-sm font-bold text-plum-700 underline"
          >
            🔄 تحديث
          </button>
        </>
      )}
      {pending &&
        (() => {
          const st = byId.get(pending.log.studentId);
          const cur = recitations.find(
            (x) =>
              x.id === pending.sessionId ||
              (x.studentId === pending.log.studentId && x.date === pending.log.date)
          );
          return (
            <Sheet open onClose={() => setPending(null)} title="↩️ تأكيد الاسترجاع">
              <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">
                ⚠️ {st?.name ?? "طالبة"} — لقاء {fmtDay(pending.log.date)}
                <span className="block text-xs font-normal">
                  {cur
                    ? "سيُستبدل السجلّ الموجود الآن بالنسخة المؤرشفة (ويُحفظ الحالي في الأرشيف)."
                    : "سيُعاد هذا السجلّ المحذوف كما كان."}
                </span>
              </p>
              <div className="grid gap-2">
                <div className="rounded-xl border border-red-200 bg-red-50/40 px-3 py-2">
                  <p className="mb-1 text-xs font-bold text-red-700">الموجود الآن</p>
                  {cur ? <Parts log={cur} /> : <p className="text-sm text-silver-600">لا سجلّ لهذا اللقاء</p>}
                </div>
                <div className="rounded-xl border border-emerald-300 bg-emerald-50/40 px-3 py-2">
                  <p className="mb-1 text-xs font-bold text-emerald-700">بعد الاسترجاع</p>
                  <Parts log={pending.log} />
                </div>
              </div>
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-bold text-plum-800">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                  className="h-5 w-5 accent-plum-600"
                />
                راجعتُ المقارنة وأريد الاسترجاع
              </label>
              <input
                className={`${inputCls} mt-2 text-center`}
                placeholder={`اكتبي «${WORD}» للتأكيد`}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
              />
              <button
                type="button"
                disabled={!ready}
                onClick={doRestore}
                className="mt-3 w-full rounded-xl bg-plum-600 py-3 font-bold text-white transition disabled:bg-silver-400"
              >
                ↩️ استرجاع
              </button>
              <button
                type="button"
                onClick={() => setPending(null)}
                className="mt-2 w-full py-2 text-sm font-bold text-silver-600"
              >
                إلغاء
              </button>
            </Sheet>
          );
        })()}
    </main>
  );
}
