"use client";

import { useState } from "react";
import {
  actions,
  isDesc,
  halaqaTitle,
  type CoursePlan,
  type Halaqa,
  type HifzDirection,
  type Student,
} from "@/lib/store";
import { facesLabel } from "@/lib/arabic";
import { ayahCount, SURAHS } from "@/lib/surahs";
import { inputCls, PrimaryBtn } from "./ui";

const ar = (n: number) => n.toLocaleString("ar-EG");
const dirLabel = (desc: boolean) => (desc ? "من الناس" : "من البقرة");

/** بداية المراجعة تُشتقّ من الاتجاه: صاعد → من الفاتحة، نازل → من الناس */
function reviewStartFor(dir: HifzDirection): Pick<CoursePlan, "murStartSurah" | "murStartAyah"> {
  return dir === "desc"
    ? { murStartSurah: "الناس", murStartAyah: ayahCount("الناس") }
    : { murStartSurah: "الفاتحة", murStartAyah: 1 };
}

/** 📋 تأكيد خطة الفصل: تظهر للطالبة مرة في بداية كل فصل — تراجع خطتها
    (أوجه الحفظ والمراجعة، الاتجاه، وبداية الفصل) ثم تؤكّدها أو تعدّلها مرة واحدة فقط */
export function PlanConfirmGate({
  student,
  halaqa,
  onLogout,
}: {
  student: Student;
  halaqa: Halaqa;
  onLogout: () => void;
}) {
  const p = student.plan;
  const termStart = halaqa.termStart;
  const alreadyEdited = p.studentEditedTerm === termStart;
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hifz, setHifz] = useState(String(p.hifz || ""));
  const [mur, setMur] = useState(String(p.murajaah || ""));
  const [dir, setDir] = useState<HifzDirection>(isDesc(p) ? "desc" : "asc");
  const [surah, setSurah] = useState(p.startSurah ?? "");
  const [ayah, setAyah] = useState(p.startAyah ?? 1);

  const termLabel = termStart
    ? new Date(termStart + "T00:00:00").toLocaleDateString("ar-u-ca-gregory-nu-arab", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  const toNum = (v: string) => {
    const n = Number(v.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await actions.confirmPlan(student.id);
    setBusy(false);
    if (!ok) window.alert("تعذّر الحفظ — تحققي من الاتصال ثم أعيدي المحاولة");
  };

  const save = async () => {
    if (busy) return;
    const h = toNum(hifz), m = toNum(mur);
    if (h <= 0 && m <= 0) {
      window.alert("أدخلي عدد أوجه الحفظ أو المراجعة");
      return;
    }
    if (!surah) {
      window.alert("اختاري سورة بداية الحفظ");
      return;
    }
    const edit: Partial<CoursePlan> = {
      hifz: h,
      murajaah: m,
      direction: dir,
      murDirection: dir,
      startSurah: surah,
      startAyah: Math.min(Math.max(1, ayah), ayahCount(surah) || 1),
      ...reviewStartFor(dir),
    };
    const summary =
      `✏️ عدّلت خطتها: الحفظ ${facesLabel(p.hifz ?? 0)} ← ${facesLabel(h)}، ` +
      `المراجعة ${facesLabel(p.murajaah ?? 0)} ← ${facesLabel(m)}، ` +
      `الاتجاه ${dirLabel(isDesc(p))} ← ${dirLabel(dir === "desc")}، ` +
      `البداية ${p.startSurah ? `${p.startSurah} ${ar(p.startAyah ?? 1)}` : "—"} ← ${surah} ${ar(edit.startAyah ?? 1)}`;
    setBusy(true);
    const ok = await actions.confirmPlan(student.id, edit, summary);
    setBusy(false);
    if (!ok) window.alert("تعذّر الحفظ — تحققي من الاتصال ثم أعيدي المحاولة");
  };

  const rows: { icon: string; label: string; value: string }[] = [
    { icon: "📖", label: "الحفظ في كل لقاء", value: p.hifz ? facesLabel(p.hifz) : "لا يوجد" },
    { icon: "🔁", label: "المراجعة في كل لقاء", value: p.murajaah ? facesLabel(p.murajaah) : "لا يوجد" },
    { icon: "🧭", label: "الاتجاه", value: dirLabel(isDesc(p)) },
    {
      icon: "🚩",
      label: "بداية الفصل",
      value: p.startSurah ? `سورة ${p.startSurah} — آية ${ar(p.startAyah ?? 1)}` : "لم تُحدَّد",
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
            <span className="block text-xs font-medium text-plum-600">الفصل يبدأ {termLabel}</span>
          )}
        </p>
      </div>

      {!editing ? (
        <>
          <div className="card rounded-3xl p-4">
            <div className="grid gap-2">
              {rows.map((r) => (
                <div key={r.label} className="flex items-center gap-3 rounded-xl bg-cream/70 px-3 py-2.5">
                  <span className="text-xl">{r.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-bold text-silver-600">{r.label}</span>
                    <span className="block font-kufi text-base font-bold text-plum-800">{r.value}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-center text-xs text-silver-600">
              راجعي الأرقام والبداية جيداً — عليها يُبنى وردكِ وجدولكِ طوال الفصل
            </p>
          </div>

          <div className="mt-5 grid gap-2">
            <PrimaryBtn onClick={confirm} className={busy ? "opacity-60" : ""}>
              {busy ? "⏳ جاري الحفظ…" : "✅ الخطة صحيحة"}
            </PrimaryBtn>
            {!alreadyEdited && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="w-full rounded-xl border-2 border-plum-300 bg-white py-3 font-kufi text-base font-bold text-plum-700 transition active:scale-[0.98]"
              >
                ✏️ تعديل الخطة
              </button>
            )}
            <p className="text-center text-[11px] text-silver-600">
              {alreadyEdited
                ? "عدّلتِ خطتكِ هذا الفصل، ولا يمكن تعديلها مرة أخرى — تواصلي مع الإدارة لأي تغيير"
                : "يمكنكِ تعديل الخطة مرة واحدة فقط في الفصل، وستعلم الإدارة بالتعديل"}
            </p>
          </div>
        </>
      ) : (
        <div className="card rounded-3xl p-4">
          <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-center text-xs font-bold text-amber-900">
            تعديل واحد فقط في الفصل — تأكدي قبل الحفظ
          </p>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-plum-700">📖 أوجه الحفظ في كل لقاء</span>
              <input inputMode="decimal" className={inputCls} value={hifz} onChange={(e) => setHifz(e.target.value)} placeholder="٥" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-plum-700">🔁 أوجه المراجعة في كل لقاء</span>
              <input inputMode="decimal" className={inputCls} value={mur} onChange={(e) => setMur(e.target.value)} placeholder="٥" />
            </label>
          </div>

          <span className="mb-1 block text-xs font-bold text-plum-700">🧭 الاتجاه</span>
          <div className="mb-3 grid grid-cols-2 gap-2">
            {(
              [
                { key: "asc", label: "من البقرة" },
                { key: "desc", label: "من الناس" },
              ] as const
            ).map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => {
                  setDir(d.key);
                  if (surah) setAyah(d.key === "desc" ? ayahCount(surah) : 1);
                }}
                className={`rounded-xl border px-3 py-2.5 font-kufi text-sm font-bold transition ${
                  dir === d.key ? "border-plum-600 bg-plum-600 text-white" : "border-cream-dark bg-white text-plum-800"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <p className="mb-3 text-[11px] text-silver-600">
            المراجعة تُحسب من بداية الاتجاه: {dirLabel(dir === "desc")}
          </p>

          <div className="mb-1 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-plum-700">🚩 بداية الفصل — السورة</span>
              <select
                className={inputCls}
                value={surah}
                onChange={(e) => {
                  setSurah(e.target.value);
                  setAyah(dir === "desc" ? ayahCount(e.target.value) : 1);
                }}
              >
                <option value="">اختاري السورة…</option>
                {SURAHS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-plum-700">🔢 رقم الآية</span>
              <select
                className={inputCls}
                value={ayah}
                onChange={(e) => setAyah(Number(e.target.value))}
                disabled={!surah}
              >
                {Array.from({ length: Math.max(1, ayahCount(surah || "")) }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {ar(n)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-xl bg-cream py-3 font-kufi text-sm font-bold text-plum-700"
            >
              رجوع
            </button>
            <PrimaryBtn onClick={save} className={busy ? "opacity-60" : ""}>
              {busy ? "⏳ جاري الحفظ…" : "💾 حفظ وتأكيد"}
            </PrimaryBtn>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onLogout}
        className="mx-auto mt-5 block text-sm font-bold text-silver-600 underline"
      >
        الدخول برمز آخر
      </button>
    </main>
  );
}
