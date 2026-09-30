"use client";

import { useEffect, useMemo, useState } from "react";
import { halaqaTitle, useApp, whatsappLink } from "@/lib/store";
import { followupMessage, followupPushText, teacherFollowups, type TeacherFollowup } from "@/lib/followup";
import { supabase } from "@/lib/supabase";
import { PageHeader, useHydrated } from "@/components/ui";
import { RoleOnly } from "@/components/admin-only";

const ar = (n: number) => n.toLocaleString("ar-EG");

/** آخر دخول لكل معلّمة (من أجهزتها المربوطة) — تقرؤه الإدارة فقط */
function useTeacherLastSeen(): Map<string, string> | null {
  const [map, setMap] = useState<Map<string, string> | null>(null);
  useEffect(() => {
    supabase
      .from("almaher_teacher_devices")
      .select("teacher_id,last_seen")
      .then(({ data }) => {
        const m = new Map<string, string>();
        for (const d of (data ?? []) as { teacher_id: string; last_seen: string | null }[]) {
          if (d.last_seen && (!m.has(d.teacher_id) || d.last_seen > m.get(d.teacher_id)!))
            m.set(d.teacher_id, d.last_seen);
        }
        setMap(m);
      });
  }, []);
  return map;
}

function lastSeenLabel(iso?: string): { text: string; cls: string } {
  if (!iso) return { text: "لم تدخل أبداً", cls: "bg-red-50 text-red-700" };
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  const text =
    days <= 0 ? "دخلت اليوم" : days === 1 ? "دخلت أمس" : `آخر دخول قبل ${ar(days)} أيام`;
  return { text, cls: days >= 7 ? "bg-amber-50 text-amber-800" : "bg-cream text-silver-600" };
}

/** 👩‍🏫 متابعة المعلّمات — من أكملت تسجيل اللقاءات ومن ينقصها (بالأسماء)، ولقاء اليوم،
    وآخر دخول، ورسالة واتساب جاهزة بالناقص. للإدارة فقط. */
export default function FollowupPage() {
  return (
    <RoleOnly roles={["admin"]}>
      <FollowupInner />
    </RoleOnly>
  );
}

function FollowupInner() {
  const { teachers, halaqas, students, recitations, settings } = useApp();
  // 👭 الحلقة المشتركة: المعلّمات اللاتي يدخلنها من روابطهنّ (teacherShares)
  const sharersOf = (id: string) =>
    teachers.filter((t) => (settings.teacherShares?.[t.id] ?? []).includes(id));
  /** آخر دخول: للحلقة المشتركة = أحدث دخول لمن تدخلها (ولها إن كان لها جهاز) */
  const seenOf = (id: string): string | undefined =>
    [id, ...sharersOf(id).map((t) => t.id)]
      .map((x) => lastSeen?.get(x))
      .filter((x): x is string => !!x)
      .sort()
      .pop();
  const hydrated = useHydrated();
  const lastSeen = useTeacherLastSeen();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [pushed, setPushed] = useState<Record<string, string>>({}); // نتيجة الإشعار لكل معلّمة

  /** 🔔 إرسال التذكير إشعاراً لجوال المعلّمة (ولمن تدخل الحلقة المشتركة) */
  const notify = async (f: TeacherFollowup) => {
    const targets = [f.teacher.id, ...sharersOf(f.teacher.id).map((t) => t.id)];
    setPushed((p) => ({ ...p, [f.teacher.id]: "⏳ …" }));
    let sent = 0;
    try {
      for (const id of targets) {
        const { data, error } = await supabase.functions.invoke("almaher-push", {
          body: { kind: "teacher_direct", teacher_id: id, title: "📋 تذكير من الإدارة", body: followupPushText(f) },
        });
        if (error) throw error;
        sent += (data as { sent?: number } | null)?.sent ?? 0;
      }
      setPushed((p) => ({ ...p, [f.teacher.id]: sent ? `✓ وصل (${ar(sent)})` : "🔕 لم تفعّل الإشعارات" }));
    } catch {
      setPushed((p) => ({ ...p, [f.teacher.id]: "تعذّر الإرسال" }));
    }
  };

  const list = useMemo(
    () => (hydrated ? teacherFollowups(teachers, halaqas, students, recitations) : []),
    [hydrated, teachers, halaqas, students, recitations]
  );
  const behind = list.filter((f) => f.missingCount > 0);
  const done = list.filter((f) => f.missingCount === 0);
  const totalMissing = behind.reduce((n, f) => n + f.missingCount, 0);
  const todays = list.flatMap((f) =>
    f.halaqas.filter((h) => h.today).map((h) => ({ f, h, t: h.today! }))
  );

  const copy = async (f: TeacherFollowup) => {
    const msg = followupMessage(f, sharersOf(f.teacher.id).map((t) => t.name));
    try {
      await navigator.clipboard.writeText(msg);
      setCopied(f.teacher.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt("انسخي الرسالة:", msg);
    }
  };
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-8">
      <PageHeader title="👩‍🏫 متابعة المعلّمات" back="/" />

      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <div className="card rounded-2xl py-3">
          <p className="text-2xl font-bold text-emerald-700">{ar(done.length)}</p>
          <p className="text-[11px] font-bold text-silver-600">✅ أكملن</p>
        </div>
        <div className="card rounded-2xl py-3">
          <p className="text-2xl font-bold text-amber-700">{ar(behind.length)}</p>
          <p className="text-[11px] font-bold text-silver-600">⚠️ عليهن نقص</p>
        </div>
        <div className="card rounded-2xl py-3">
          <p className="text-2xl font-bold text-red-700">{ar(totalMissing)}</p>
          <p className="text-[11px] font-bold text-silver-600">سجلّ ناقص</p>
        </div>
      </div>
      <p className="mb-4 text-xs text-silver-600">
        «ناقص» = لقاء مضى ولم يُسجَّل للطالبة (حضوراً أو غياباً). لقاء اليوم يظهر وحده ولا يُحسب ناقصاً.
      </p>

      {todays.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 font-kufi text-lg font-bold text-plum-800">📍 لقاء اليوم</h2>
          <div className="grid gap-1.5">
            {todays.map(({ f, h, t }) => (
              <div
                key={f.teacher.id + h.halaqa.id}
                className="card flex items-center justify-between rounded-xl px-3 py-2 text-sm"
              >
                <span className="font-bold text-plum-800">
                  {f.teacher.name} <span className="text-xs font-normal text-silver-600">· {halaqaTitle(h.halaqa)}</span>
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    t.recorded === t.total
                      ? "bg-emerald-50 text-emerald-700"
                      : t.recorded === 0
                        ? "bg-cream text-silver-600"
                        : "bg-amber-50 text-amber-800"
                  }`}
                >
                  {t.recorded === t.total ? "✅ " : ""}
                  {ar(t.recorded)} / {ar(t.total)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {behind.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 font-kufi text-lg font-bold text-plum-800">⚠️ عليهن نقص</h2>
          <div className="grid gap-2.5">
            {behind.map((f) => {
              const seen = lastSeenLabel(seenOf(f.teacher.id));
              const sharers = sharersOf(f.teacher.id);
              const isOpen = open.has(f.teacher.id);
              return (
                <div key={f.teacher.id} className="card rounded-2xl p-3.5">
                  <button
                    type="button"
                    onClick={() => toggle(f.teacher.id)}
                    className="flex w-full items-start justify-between gap-2 text-start"
                  >
                    <span className="min-w-0">
                      <span className="block font-kufi text-base font-bold text-plum-800">
                        {f.teacher.name}
                      </span>
                      <span className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] font-bold">
                        <span className="rounded-full bg-cream px-2 py-0.5 text-silver-600">
                          {ar(f.students)} طالبة
                        </span>
                        {sharers.length > 0 && (
                          <span className="rounded-full bg-plum-50 px-2 py-0.5 text-plum-700">
                            👭 مشتركة: {sharers.map((t) => t.name).join(" و")}
                          </span>
                        )}
                        {lastSeen && <span className={`rounded-full px-2 py-0.5 ${seen.cls}`}>{seen.text}</span>}
                      </span>
                    </span>
                    <span className="shrink-0 text-center">
                      <span className="block rounded-full bg-red-50 px-2.5 py-0.5 text-sm font-bold text-red-700">
                        ناقص {ar(f.missingCount)}
                      </span>
                      <span className="text-[10px] text-silver-600">{isOpen ? "▲ إخفاء" : "▼ التفاصيل"}</span>
                    </span>
                  </button>

                  {isOpen && (
                    <div className="mt-2 grid gap-2">
                      {f.halaqas
                        .filter((h) => h.missing.length)
                        .map((h) => (
                          <div key={h.halaqa.id} className="rounded-xl bg-cream px-3 py-2">
                            <p className="mb-1 text-xs font-bold text-plum-700">🕌 {halaqaTitle(h.halaqa)}</p>
                            {h.missing.map((m) => (
                              <p key={m.n} className="text-sm text-ink">
                                <span className="font-bold">لقاء {ar(m.n)}</span>
                                <span className="text-xs text-silver-600"> ({m.dateLabel})</span>:{" "}
                                {m.names.length === m.total
                                  ? `كل الطالبات (${ar(m.total)})`
                                  : m.names.join("، ")}
                              </p>
                            ))}
                          </div>
                        ))}
                    </div>
                  )}

                  <div className="mt-2.5 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => notify(f)}
                      className="rounded-xl bg-amber-500 py-2 text-sm font-bold text-white"
                      title="إرسال التذكير إشعاراً لجوالها"
                    >
                      {pushed[f.teacher.id] ?? "🔔 إشعار"}
                    </button>
                    <button
                      type="button"
                      onClick={() => copy(f)}
                      className="rounded-xl bg-plum-600 py-2 text-sm font-bold text-white"
                    >
                      {copied === f.teacher.id ? "تم النسخ ✓" : "📋 نسخ"}
                    </button>
                    <a
                      href={whatsappLink("", followupMessage(f, sharers.map((t) => t.name)))}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl bg-emerald-500 py-2 text-center text-sm font-bold text-white"
                    >
                      📲 واتساب
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section>
          <h2 className="mb-2 font-kufi text-lg font-bold text-plum-800">✅ أكملن كل اللقاءات</h2>
          <div className="grid gap-1.5">
            {done.map((f) => {
              const seen = lastSeenLabel(seenOf(f.teacher.id));
              const sharers = sharersOf(f.teacher.id);
              return (
                <div
                  key={f.teacher.id}
                  className="card flex items-center justify-between rounded-xl px-3 py-2 text-sm"
                >
                  <span className="font-bold text-plum-800">
                    {f.teacher.name}{" "}
                    <span className="text-xs font-normal text-silver-600">· {ar(f.students)} طالبة</span>
                    {sharers.length > 0 && (
                      <span className="text-xs font-normal text-plum-700"> · 👭 {sharers.map((t) => t.name).join(" و")}</span>
                    )}
                  </span>
                  {lastSeen && (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${seen.cls}`}>
                      {seen.text}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
