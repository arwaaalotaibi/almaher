"use client";

import { useMemo, useState } from "react";
import { activeStudents, codeLink, codeMessage, halaqaTitle, timeAgo, useApp, whatsappLink, type Student } from "@/lib/store";
import { PageHeader, useHydrated } from "@/components/ui";
import { RoleOnly } from "@/components/admin-only";
import { StudentSheet } from "@/components/student-sheet";

const ar = (n: number) => n.toLocaleString("ar-EG");
const DAY = 24 * 60 * 60 * 1000;
const daysLabel = (n: number) => (n === 1 ? "يوم واحد" : n === 2 ? "يومين" : n <= 10 ? `${ar(n)} أيام` : `${ar(n)} يوماً`);
const daysSince = (iso?: string) => (iso ? (Date.now() - new Date(iso).getTime()) / DAY : Infinity);

type Filter = "all" | "away" | "never" | "noListen" | "listenWeek";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "away", label: "لم تدخل منذ ٧ أيام" },
  { key: "never", label: "لم تدخل أبداً" },
  { key: "noListen", label: "لم تستخدم مسمّعي" },
  { key: "listenWeek", label: "🎧 استمعت هذا الأسبوع" },
];

/** 📱 متابعة استخدام الطالبات — آخر دخول للتطبيق، وآخر استماع في مسمّعي وعدد أيامه،
    ورابط الدخول (نسخ أو واتساب) لمن تحتاج تذكيراً */
export default function UsagePage() {
  return (
    <RoleOnly roles={["admin"]}>
      <UsageInner />
    </RoleOnly>
  );
}

function UsageInner() {
  const state = useApp();
  const hydrated = useHydrated();
  const students = useMemo(() => activeStudents(state.students), [state.students]);
  const [halaqaId, setHalaqaId] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Student | null>(null);
  const [copied, setCopied] = useState("");

  if (!hydrated) return <main className="mx-auto max-w-2xl px-4 pt-10" />;

  const halaqaOf = (s: Student) => state.halaqas.find((h) => h.id === s.halaqaId);
  const scope = halaqaId ? students.filter((s) => s.halaqaId === halaqaId) : students;
  const seenWeek = scope.filter((s) => daysSince(s.lastSeen) <= 7).length;
  const everListen = scope.filter((s) => s.lastListen).length;
  const listenWeek = scope.filter((s) => daysSince(s.lastListen) <= 7).length;

  const list = scope
    .filter((s) =>
      filter === "away"
        ? daysSince(s.lastSeen) > 7
        : filter === "never"
          ? !s.lastSeen
          : filter === "noListen"
            ? !s.lastListen
            : filter === "listenWeek"
              ? daysSince(s.lastListen) <= 7
              : true
    )
    // الأقدم دخولاً أولاً (من لم تدخل أبداً في الأعلى)
    .sort((a, b) => daysSince(b.lastSeen) - daysSince(a.lastSeen) || a.name.localeCompare(b.name, "ar"));

  const copyLink = async (s: Student) => {
    try {
      await navigator.clipboard.writeText(codeMessage(s.name, s.code));
      setCopied(s.id);
      setTimeout(() => setCopied(""), 1800);
    } catch {
      window.prompt("انسخي الرابط:", codeLink(s.code));
    }
  };

  const tone = (d: number) => (d <= 3 ? "text-emerald-700" : d <= 7 ? "text-amber-700" : "text-red-700");

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-8">
      <PageHeader title="📱 متابعة الاستخدام" back="/director" />

      <select
        className="mb-3 w-full rounded-xl border border-cream-dark bg-white px-3 py-2.5 text-sm font-bold text-plum-800"
        value={halaqaId}
        onChange={(e) => setHalaqaId(e.target.value)}
        aria-label="الحلقة"
      >
        <option value="">🌍 كل الحلقات</option>
        {state.halaqas.map((h) => (
          <option key={h.id} value={h.id}>
            🕌 {halaqaTitle(h)}
          </option>
        ))}
      </select>

      <div className="mb-3 grid grid-cols-3 gap-2">
        {[
          { v: `${ar(seenWeek)} / ${ar(scope.length)}`, l: "👣 دخلن هذا الأسبوع" },
          { v: ar(everListen), l: "🎧 استخدمن مسمّعي" },
          { v: ar(listenWeek), l: "🎧 استمعن هذا الأسبوع" },
        ].map((k) => (
          <div key={k.l} className="card rounded-2xl px-2 py-3 text-center">
            <p className="text-lg font-bold text-plum-800">{k.v}</p>
            <p className="mt-0.5 text-[10px] font-bold text-silver-600">{k.l}</p>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${filter === f.key ? "bg-plum-600 text-white" : "bg-cream text-plum-700"}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <p className="mb-3 text-[11px] font-bold text-silver-600">
        {ar(list.length)} طالبة · متابعة مسمّعي تُسجَّل من بداية تفعيلها، وما قبلها لا يظهر
      </p>

      <div className="grid gap-2">
        {list.map((s) => {
          const seen = daysSince(s.lastSeen);
          const heard = daysSince(s.lastListen);
          const h = halaqaOf(s);
          return (
            <div key={s.id} className="card rounded-2xl px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <button type="button" onClick={() => setSelected(s)} className="min-w-0 text-start">
                  <span className="block truncate text-sm font-bold text-plum-800 underline decoration-dotted underline-offset-4">{s.name}</span>
                  {!halaqaId && h && <span className="block text-[10px] text-silver-600">{halaqaTitle(h)}</span>}
                </button>
                <span className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => copyLink(s)}
                    className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-bold text-plum-700"
                    title="نسخ رسالة الدخول مع الرابط"
                  >
                    {copied === s.id ? "✓ نُسخ" : "📋 الرابط"}
                  </button>
                  <a
                    href={whatsappLink(s.phone, codeMessage(s.name, s.code))}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white"
                    title={s.phone ? "إرسال الرابط لرقمها" : "إرسال الرابط — اختاري جهة الاتصال"}
                  >
                    💬 واتساب
                  </a>
                </span>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[11px] font-bold">
                <span className={`rounded-lg bg-cream/70 px-2 py-1 ${s.lastSeen ? tone(seen) : "text-red-700"}`}>
                  👣 {s.lastSeen ? `آخر دخول: ${timeAgo(s.lastSeen)}` : "لم تدخل أبداً"}
                </span>
                <span className={`rounded-lg bg-cream/70 px-2 py-1 ${s.lastListen ? tone(heard) : "text-silver-600"}`}>
                  🎧 {s.lastListen ? `آخر استماع: ${timeAgo(s.lastListen)}` : "لم تستخدم مسمّعي"}
                  {s.lastListen && <span className="block text-[10px] text-silver-600">استمعت في {daysLabel(s.listenDays ?? 0)}</span>}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <StudentSheet student={selected ? (students.find((s) => s.id === selected.id) ?? selected) : null} onClose={() => setSelected(null)} />
    </main>
  );
}
