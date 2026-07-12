"use client";

import { useState } from "react";
import {
  actions,
  halaqaTitle,
  SUPPORT_KINDS,
  useApp,
} from "@/lib/store";
import { inputCls, PageHeader, useHydrated } from "@/components/ui";
import { RoleOnly } from "@/components/admin-only";

const ar = (n: number) => n.toLocaleString("ar-EG");

export default function SupportAdminPage() {
  return (
    <RoleOnly roles={["admin"]}>
      <SupportInner />
    </RoleOnly>
  );
}

const FILTERS = [
  { key: "new", label: "جديدة" },
  { key: "done", label: "تم الرد" },
  { key: "all", label: "الكل" },
] as const;

function SupportInner() {
  const { support, students, halaqas } = useApp();
  const hydrated = useHydrated();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("new");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (!hydrated) return <main className="mx-auto max-w-2xl px-4 pt-10" />;

  const list = support.filter((m) =>
    filter === "all" ? true : m.status === filter
  );
  const newCount = support.filter((m) => m.status === "new").length;

  const studentLabel = (id: string) => {
    const st = students.find((s) => s.id === id);
    if (!st) return "طالبة محذوفة";
    const h = halaqas.find((x) => x.id === st.halaqaId);
    return `${st.name}${h ? ` — ${halaqaTitle(h)}` : ""}`;
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ar-u-ca-gregory-nu-arab", {
      weekday: "short",
      day: "numeric",
      month: "long",
    });

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-8">
      <PageHeader title="🛟 الدعم والاقتراحات" back="/" />
      <p className="-mt-2 mb-4 text-sm text-silver-600">
        رسائل الطالبات: مشاكل تقنية واقتراحات واستفسارات — ردّك يصلها في
        صفحتها
      </p>

      <div className="mb-4 flex gap-1 rounded-2xl bg-cream p-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`relative flex-1 rounded-xl py-2 font-kufi text-sm font-bold transition ${
              filter === f.key
                ? "bg-white text-plum-800 shadow-sm"
                : "text-silver-600"
            }`}
          >
            {f.label}
            {f.key === "new" && newCount > 0 && (
              <span className="absolute end-2 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {ar(newCount)}
              </span>
            )}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="card rounded-2xl p-8 text-center">
          <p className="text-3xl">📭</p>
          <p className="mt-2 font-kufi font-bold text-plum-800">
            لا رسائل هنا
          </p>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {list.map((m) => {
            const k = SUPPORT_KINDS.find((x) => x.key === m.kind);
            return (
              <div key={m.id} className="card rounded-2xl p-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-bold text-plum-800">
                    🌸 {studentLabel(m.studentId)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("حذف هذه الرسالة؟"))
                        actions.removeSupport(m.id);
                    }}
                    className="shrink-0 text-xs font-bold text-red-600"
                  >
                    حذف
                  </button>
                </div>
                <p className="mb-2 text-[11px] font-bold text-silver-600">
                  {k?.icon} {k?.label} · {fmtDate(m.createdAt)}
                </p>
                <p className="rounded-xl bg-cream/60 px-3 py-2 text-sm font-medium text-ink">
                  {m.body}
                </p>

                {m.status === "done" ? (
                  <div className="mt-2 rounded-xl bg-emerald-50 px-3 py-2">
                    <p className="text-[10px] font-bold text-emerald-600">
                      ردّك ✓
                    </p>
                    <p className="text-sm font-bold text-emerald-800">
                      {m.reply || "—"}
                    </p>
                  </div>
                ) : (
                  <div className="mt-2 flex gap-2">
                    <input
                      className={`${inputCls} !mb-0 flex-1`}
                      placeholder="اكتبي ردّك…"
                      value={drafts[m.id] ?? ""}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [m.id]: e.target.value }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const reply = (drafts[m.id] ?? "").trim();
                        if (!reply) {
                          window.alert("اكتبي الرد أولاً");
                          return;
                        }
                        actions.replySupport(m.id, reply);
                      }}
                      className="shrink-0 rounded-xl bg-plum-600 px-4 font-kufi text-sm font-bold text-white"
                    >
                      ردّ
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
