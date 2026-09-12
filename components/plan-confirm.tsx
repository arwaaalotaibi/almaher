"use client";

import { useState } from "react";
import {
  actions,
  hifzStartLabel,
  isDesc,
  isMurDesc,
  murStartLabel,
  planConfirmBody,
  halaqaTitle,
  type Halaqa,
  type Student,
} from "@/lib/store";
import { facesLabel } from "@/lib/arabic";
import { inputCls, PrimaryBtn } from "./ui";

const ar = (n: number) => n.toLocaleString("ar-EG");

/** 📋 تأكيد خطة الفصل: تظهر للطالبة مرة في بداية كل فصل — تراجع خطتها كما أدخلتها
    الإدارة (أوجه الحفظ والمراجعة، الاتجاه، وبداية الفصل) ثم تؤكّد أو تبلّغ عن خطأ */
export function PlanConfirmGate({
  student,
  halaqa,
  onLogout,
}: {
  student: Student;
  halaqa: Halaqa;
  onLogout: () => void;
}) {
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState("");
  const p = student.plan;
  const termStart = halaqa.termStart;
  const termLabel = termStart
    ? new Date(termStart + "T00:00:00").toLocaleDateString("ar-u-ca-gregory-nu-arab", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  const dirLabel = (desc: boolean) =>
    desc ? "من الناس نزولاً ⬇️" : "من البقرة صعوداً ⬆️";

  const confirm = () => {
    actions.addSupport(student.id, "plan_ok", planConfirmBody(termStart, true));
  };
  const report = () => {
    if (note.trim().length < 3) {
      window.alert("اكتبي ما الخطأ في الخطة أولاً");
      return;
    }
    actions.addSupport(student.id, "plan_issue", planConfirmBody(termStart, false, note));
  };

  const rows: { icon: string; label: string; value: string; sub?: string }[] = [
    {
      icon: "📖",
      label: "الحفظ في كل لقاء",
      value: p.hifz ? facesLabel(p.hifz) : "لا يوجد",
      sub: p.hifz ? dirLabel(isDesc(p)) : undefined,
    },
    ...(p.tathbit
      ? [{ icon: "📌", label: "التثبيت في كل لقاء", value: facesLabel(p.tathbit) }]
      : []),
    {
      icon: "🔁",
      label: "المراجعة في كل لقاء",
      value: p.murajaah ? facesLabel(p.murajaah) : "لا يوجد",
      sub: p.murajaah ? dirLabel(isMurDesc(p)) : undefined,
    },
    {
      icon: "🚩",
      label: "بداية الحفظ هذا الفصل",
      value: hifzStartLabel(p).replace(" ⬇️ نزولاً", "") || "لم تُحدَّد",
    },
    {
      icon: "🔖",
      label: "بداية المراجعة هذا الفصل",
      value: murStartLabel(p).replace(" ⬇️ نزولاً", "") || "لم تُحدَّد",
    },
  ];

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-4 py-10">
      <div className="mb-5 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="الماهر" className="mx-auto mb-3 h-16 w-auto" />
        <h1 className="font-kufi text-2xl font-bold text-plum-800">📋 تأكيد خطة الفصل</h1>
        <p className="mt-2 rounded-xl bg-plum-50 px-4 py-2.5 text-sm font-bold text-plum-700">
          {student.name} 🌸 — هذه خطتكِ في {halaqaTitle(halaqa)}
          {termLabel && (
            <span className="block text-xs font-medium text-plum-600">
              الفصل يبدأ {termLabel}
            </span>
          )}
        </p>
      </div>

      <div className="card rounded-3xl p-4">
        <div className="grid gap-2">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3 rounded-xl bg-cream/70 px-3 py-2.5">
              <span className="text-xl">{r.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold text-silver-600">{r.label}</span>
                <span className="block font-kufi text-base font-bold text-plum-800">{r.value}</span>
                {r.sub && <span className="block text-xs text-plum-600">{r.sub}</span>}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-silver-600">
          راجعي الأرقام والبداية جيداً — عليها يُبنى وردكِ وجدولكِ طوال الفصل
        </p>
      </div>

      {!reporting ? (
        <div className="mt-5 grid gap-2">
          <PrimaryBtn onClick={confirm}>✅ الخطة صحيحة</PrimaryBtn>
          <button
            type="button"
            onClick={() => setReporting(true)}
            className="w-full rounded-xl border-2 border-amber-400 bg-amber-50 py-3 font-kufi text-base font-bold text-amber-900 transition active:scale-[0.98]"
          >
            ⚠️ فيها خطأ
          </button>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-bold text-amber-900">ما الخطأ في خطتكِ؟</p>
          <textarea
            className={`${inputCls} min-h-24`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="مثال: المراجعة ١٠ أوجه لا ٥، والبداية من سورة يس"
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setReporting(false)}
              className="rounded-xl bg-white py-2.5 text-sm font-bold text-plum-700 ring-1 ring-cream-dark"
            >
              رجوع
            </button>
            <button
              type="button"
              onClick={report}
              className="rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white"
            >
              إرسال للإدارة
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-amber-800">
            ستصل الإدارة وتُصحّح الخطة، ثم يُطلب منكِ تأكيدها من جديد
          </p>
        </div>
      )}

      <p className="mt-4 text-center text-[11px] text-silver-600">
        {ar(1)} دقيقة فقط — وتظهر مرة واحدة كل فصل
      </p>
      <button
        type="button"
        onClick={onLogout}
        className="mx-auto mt-3 block text-sm font-bold text-silver-600 underline"
      >
        الدخول برمز آخر
      </button>
    </main>
  );
}
