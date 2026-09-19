"use client";

import { useMemo, useState } from "react";
import {
  actions,
  activeStudents,
  halaqaTitle,
  lastPlanIssue,
  planConfirmMark,
  useApp,
  whatsappLink,
  type Student,
} from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { PageHeader, useHydrated } from "@/components/ui";
import { RoleOnly } from "@/components/admin-only";
import { StudentSheet } from "@/components/student-sheet";

const ar = (n: number) => n.toLocaleString("ar-EG");

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ar-u-ca-gregory-nu-arab", {
    day: "numeric",
    month: "long",
  });

/** 📋 تأكيد خطط الفصل — شاشة واحدة للإدارة: من أبلغت عن خطأ (مع ملاحظتها)،
    ومن لم تؤكّد بعد، ومن أكّدت. التعديل من هنا مباشرة عبر بطاقة الطالبة. */
export default function PlansPage() {
  return (
    <RoleOnly roles={["admin", "teacher"]}>
      <PlansInner />
    </RoleOnly>
  );
}

function PlansInner() {
  const { students: allStudents, halaqas, support } = useApp();
  const students = useMemo(() => activeStudents(allStudents), [allStudents]);
  const hydrated = useHydrated();
  const [halaqaId, setHalaqaId] = useState("");
  const [selected, setSelected] = useState<Student | null>(null);
  const [replyFor, setReplyFor] = useState<string | null>(null); // معرّف الرسالة المفتوح ردّها
  const [replyText, setReplyText] = useState("");

  /** ردّ الإدارة على ملاحظة: الخطة صحيحة كما هي — تصلها رسالة وتُطلب منها إعادة التأكيد */
  const sendReply = (msgId: string, studentId: string) => {
    const text = replyText.trim();
    if (text.length < 2) return;
    actions.replySupport(msgId, text);
    void supabase.functions.invoke("almaher-push", {
      body: { kind: "direct", student_id: studentId, body: `💬 ردّ الإدارة على ملاحظتكِ على الخطة:\n${text}` },
    });
    setReplyFor(null);
    setReplyText("");
  };

  const groups = useMemo(() => {
    const issue: { st: Student; note: string; at: string; msgId: string }[] = [];
    const pending: Student[] = [];
    const ok: { st: Student; at: string }[] = [];
    const noTerm: Student[] = [];
    for (const st of students) {
      if (halaqaId && st.halaqaId !== halaqaId) continue;
      const h = halaqas.find((x) => x.id === st.halaqaId);
      const mark = planConfirmMark(st, h, support);
      if (mark === "") {
        noTerm.push(st);
        continue;
      }
      if (mark === "✅") ok.push({ st, at: st.plan.confirmedAt ?? "" });
      else if (mark === "⚠️") {
        const m = lastPlanIssue(support, st.id, h?.termStart ?? "");
        issue.push({
          st,
          note: (m?.body ?? "").replace(/^⚠️ خطأ في خطة فصل \S+:\s*/, ""),
          at: m?.createdAt ?? "",
          msgId: m?.id ?? "",
        });
      } else pending.push(st);
    }
    const byName = (a: Student, b: Student) => a.name.localeCompare(b.name, "ar");
    issue.sort((a, b) => (a.at < b.at ? 1 : -1));
    pending.sort(byName);
    ok.sort((a, b) => (a.at < b.at ? 1 : -1));
    return { issue, pending, ok, noTerm };
  }, [students, halaqas, support, halaqaId]);

  // 📜 سجلّ كل الملاحظات على الخطط (كل الفصول) مع حالة كل واحدة
  const history = useMemo(() => {
    const rows: {
      m: (typeof support)[number];
      st: Student | undefined;
      note: string;
      term: string;
      state: "open" | "edited" | "done" | "replied";
    }[] = [];
    for (const m of support) {
      if (m.kind !== "plan_issue" && m.kind !== "plan_edit") continue;
      const st = students.find((s) => s.id === m.studentId);
      if (halaqaId && st && st.halaqaId !== halaqaId) continue;
      const term = m.body.match(/فصل (\S+):/)?.[1] ?? "";
      const note = m.body.replace(/^[^:]*:\s*/, "");
      let state: "open" | "edited" | "done" | "replied" = "open";
      if (st?.plan?.confirmedAt && st.plan.confirmedAt > m.createdAt) state = "done";
      else if (m.status === "done" && m.reply) state = "replied";
      else if (st?.updatedAt && st.updatedAt > m.createdAt) state = "edited";
      else if (!st) state = "done";
      rows.push({ m, st, note, term, state });
    }
    rows.sort((a, b) => (a.m.createdAt < b.m.createdAt ? 1 : -1));
    return rows;
  }, [support, students, halaqaId]);

  if (!hydrated) return <main className="mx-auto max-w-2xl px-4 pt-10" />;

  const hLabel = (st: Student) => {
    const h = halaqas.find((x) => x.id === st.halaqaId);
    return h ? halaqaTitle(h) : "";
  };
  const total = groups.issue.length + groups.pending.length + groups.ok.length;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-8">
      <PageHeader title="📋 تأكيد خطط الفصل" back="/" />
      <p className="-mt-2 mb-4 text-sm text-silver-600">
        كل طالبة تراجع خطتها في بداية الفصل: إمّا تؤكّدها أو تكتب ملاحظة. عدّلي الخطة
        من بطاقة الطالبة، وستُطلب منها إعادة التأكيد تلقائياً.
      </p>

      {/* تصفية بالحلقة */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {[{ id: "", label: "كل الحلقات" }, ...halaqas.map((h) => ({ id: h.id, label: halaqaTitle(h) }))].map(
          (h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setHalaqaId(h.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                halaqaId === h.id ? "bg-plum-600 text-white" : "bg-cream text-plum-700"
              }`}
            >
              {h.label}
            </button>
          )
        )}
      </div>

      {/* ملخّص */}
      <div className="mb-5 grid grid-cols-3 gap-2 text-center">
        {[
          { k: "⚠️", l: "ملاحظات", n: groups.issue.length, c: "bg-amber-50 text-amber-900" },
          { k: "⏳", l: "لم تؤكّد", n: groups.pending.length, c: "bg-cream text-plum-800" },
          { k: "✅", l: "أكّدت", n: groups.ok.length, c: "bg-emerald-50 text-emerald-800" },
        ].map((x) => (
          <div key={x.k} className={`rounded-2xl py-3 ${x.c}`}>
            <p className="text-xl font-bold">{ar(x.n)}</p>
            <p className="text-[11px] font-bold">
              {x.k} {x.l}
            </p>
          </div>
        ))}
      </div>
      {total === 0 && (
        <div className="card mb-4 rounded-2xl p-6 text-center text-sm text-silver-600">
          {groups.noTerm.length > 0
            ? "لم يُحدَّد تاريخ بداية الفصل لهذه الحلقات بعد — حدّديه من صفحة الحلقة لتبدأ التأكيدات"
            : "لا طالبات في هذا النطاق"}
        </div>
      )}

      {/* ⚠️ ملاحظات الطالبات */}
      <section className="mb-6">
        <h2 className="mb-2 font-kufi text-base font-bold text-amber-900">
          ⚠️ أبلغن عن خطأ ({ar(groups.issue.length)})
        </h2>
        {groups.issue.length === 0 ? (
          <p className="rounded-xl bg-cream/60 px-3 py-2.5 text-xs text-silver-600">لا ملاحظات قائمة 🌸</p>
        ) : (
          <div className="grid gap-2.5">
            {groups.issue.map(({ st, note, at, msgId }) => (
              <div key={st.id} className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-bold text-plum-800">🌸 {st.name}</span>
                  <span className="shrink-0 text-[11px] text-silver-600">{at && fmtDate(at)}</span>
                </div>
                <p className="mb-2 text-[11px] font-bold text-silver-600">{hLabel(st)}</p>
                <p className="rounded-xl bg-white px-3 py-2 text-sm font-medium text-ink">{note || "—"}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelected(st)}
                    className="flex-1 rounded-xl bg-plum-600 py-2 text-xs font-bold text-white"
                  >
                    ✏️ تعديل خطتها
                  </button>
                  <a
                    href={whatsappLink(
                      st.phone,
                      `السلام عليكم «${st.name}» 🌸\nبخصوص ملاحظتكِ على خطة الفصل: `
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white"
                    aria-label="مراسلة عبر واتساب"
                  >
                    📲
                  </a>
                </div>
                {replyFor === msgId ? (
                  <div className="mt-2 rounded-xl bg-white p-2.5">
                    <p className="mb-1 text-[11px] font-bold text-plum-800">💬 ردّكِ عليها (الخطة صحيحة كما هي)</p>
                    <textarea
                      className="min-h-20 w-full rounded-lg border border-cream-dark p-2 text-sm"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="مثال: خطتكِ صحيحة، المراجعة ١٠ أوجه كما اتفقنا في اللقاء الأول 🌸"
                      autoFocus
                    />
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setReplyFor(null);
                          setReplyText("");
                        }}
                        className="rounded-lg bg-cream py-2 text-xs font-bold text-plum-700"
                      >
                        رجوع
                      </button>
                      <button
                        type="button"
                        onClick={() => sendReply(msgId, st.id)}
                        className="rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white"
                      >
                        إرسال الردّ ✓
                      </button>
                    </div>
                    <p className="mt-1.5 text-[10px] text-silver-600">
                      يصلها الردّ إشعاراً وفي صندوقها، وتُطلب منها إعادة تأكيد الخطة نفسها.
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setReplyFor(msgId);
                      setReplyText("");
                    }}
                    className="mt-2 w-full rounded-xl bg-white py-2 text-xs font-bold text-emerald-800 ring-1 ring-emerald-300"
                  >
                    💬 الخطة صحيحة — اكتبي لها ردّاً
                  </button>
                )}
                <p className="mt-2 text-[10px] text-amber-800">
                  «تعديل خطتها» بعد الحفظ تُطلب منها إعادة التأكيد، و«الردّ» يبقي الخطة ويطلب تأكيدها من جديد
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ⏳ لم يؤكّدن */}
      <section className="mb-6">
        <h2 className="mb-2 font-kufi text-base font-bold text-plum-800">
          ⏳ لم يؤكّدن بعد ({ar(groups.pending.length)})
        </h2>
        {groups.pending.length === 0 ? (
          <p className="rounded-xl bg-cream/60 px-3 py-2.5 text-xs text-silver-600">الجميع أكّدن 🎉</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {groups.pending.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelected(st)}
                className="rounded-full bg-cream px-3 py-1.5 text-xs font-bold text-plum-800"
                title={hLabel(st)}
              >
                {st.name}
                {!halaqaId && <span className="ms-1 text-[10px] text-silver-600">· {hLabel(st)}</span>}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ✅ أكّدن */}
      <section>
        <h2 className="mb-2 font-kufi text-base font-bold text-emerald-800">
          ✅ أكّدن خطتهن ({ar(groups.ok.length)})
        </h2>
        {groups.ok.length === 0 ? (
          <p className="rounded-xl bg-cream/60 px-3 py-2.5 text-xs text-silver-600">لا تأكيدات بعد</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {groups.ok.map(({ st, at }) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelected(st)}
                className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-900"
                title={`${hLabel(st)}${at ? " · " + fmtDate(at) : ""}`}
              >
                {st.name}
                {at && <span className="ms-1 text-[10px] text-emerald-700">· {fmtDate(at)}</span>}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 📜 سجلّ الملاحظات */}
      <section className="mt-8">
        <h2 className="mb-1 font-kufi text-base font-bold text-plum-800">
          📜 سجلّ ملاحظات الخطط ({ar(history.length)})
        </h2>
        <p className="mb-2 text-[11px] text-silver-600">
          كل ما كتبته الطالبات عن خططهن، بما فيه ما عُولج وأُكّد بعد التعديل
        </p>
        {history.length === 0 ? (
          <p className="rounded-xl bg-cream/60 px-3 py-2.5 text-xs text-silver-600">لا ملاحظات مسجّلة</p>
        ) : (
          <div className="grid gap-2">
            {history.map(({ m, st, note, term, state }) => {
              const badge =
                state === "done"
                  ? { t: "✅ عُدّلت وأكّدت", c: "bg-emerald-50 text-emerald-800" }
                  : state === "replied"
                    ? { t: "💬 رُدّ عليها — بانتظار تأكيدها", c: "bg-emerald-50 text-emerald-800" }
                    : state === "edited"
                      ? { t: "✏️ عُدّلت — بانتظار تأكيدها", c: "bg-plum-50 text-plum-700" }
                      : { t: "⚠️ قائمة", c: "bg-amber-100 text-amber-900" };
              return (
                <div key={m.id} className="rounded-2xl border border-cream-dark bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => st && setSelected(st)}
                      className="min-w-0 flex-1 truncate text-start text-sm font-bold text-plum-800"
                    >
                      🌸 {st?.name ?? "طالبة محذوفة"}
                    </button>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.c}`}>
                      {badge.t}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-silver-600">
                    {st ? hLabel(st) : ""}
                    {term ? ` · فصل ${term}` : ""} · {fmtDate(m.createdAt)}
                  </p>
                  <p className="mt-1.5 rounded-xl bg-cream/60 px-3 py-2 text-sm text-ink">{note || "—"}</p>
                  {m.reply && <p className="mt-1 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900">💬 ردّكِ: {m.reply}</p>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <StudentSheet
        student={selected ? (students.find((s) => s.id === selected.id) ?? selected) : null}
        onClose={() => setSelected(null)}
      />
    </main>
  );
}
