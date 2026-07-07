"use client";

import { useEffect, useState } from "react";
import {
  actions,
  buildSchedule,
  CoursePlan,
  EMPTY_PLAN,
  formatSchedDate,
  halaqaTitle,
  hifzStartLabel,
  normalizeDigits,
  PLAN_FIELDS,
  useApp,
  type Student,
} from "@/lib/store";

const ar = (n: number) => n.toLocaleString("ar-EG");
import { ayahCount, SURAHS } from "@/lib/surahs";
import { DangerBtn, Field, inputCls, PrimaryBtn, Sheet } from "./ui";

/** نافذة بيانات الطالبة: الاسم + المعلّمة + بداية الحفظ + خطة الفصل */
export function StudentSheet({
  student,
  onClose,
}: {
  student: Student | null;
  onClose: () => void;
}) {
  const { teachers, halaqas } = useApp();
  const [name, setName] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [halaqaId, setHalaqaId] = useState("");
  const [note, setNote] = useState("");
  const [plan, setPlan] = useState<CoursePlan>({ ...EMPTY_PLAN });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (student) {
      setName(student.name);
      setTeacherId(student.teacherId);
      setHalaqaId(student.halaqaId);
      setPlan({ ...EMPTY_PLAN, ...student.plan });
      setNote(student.note ?? "");
    }
  }, [student]);

  const planNum = (v: string) => Math.max(0, Number(normalizeDigits(v)) || 0);

  if (!student) return null;

  const save = () => {
    if (!name.trim()) return;
    actions.updateStudent(student.id, {
      name: name.trim(),
      teacherId,
      halaqaId,
      plan,
      note: note.trim(),
    });
    onClose();
  };

  const remove = () => {
    if (window.confirm(`حذف الطالبة «${student.name}»؟`)) {
      actions.removeStudent(student.id);
      onClose();
    }
  };

  const updatedLabel = student.updatedAt
    ? new Date(student.updatedAt).toLocaleDateString("ar-u-ca-gregory-nu-arab", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const halaqa = halaqas.find((h) => h.id === halaqaId);
  const schedule = halaqa ? buildSchedule(halaqa, plan) : null;

  const printSchedule = () => {
    if (!schedule || !halaqa) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const startLabel = hifzStartLabel(plan);
    const rows = schedule
      .map(
        (s) =>
          `<tr><td>${ar(s.n)}</td><td>${formatSchedDate(s.date)}</td><td>${
            s.hifz || "—"
          }</td><td>${s.tathbit || "—"}</td><td>${s.murajaah || "—"}</td></tr>`
      )
      .join("");
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<title>جدول حفظ — ${name}</title>
<style>
  *{font-family:'Segoe UI','Tahoma',sans-serif;box-sizing:border-box}
  body{margin:0;padding:28px;color:#453039}
  .head{text-align:center;border-bottom:3px solid #7d5a6c;padding-bottom:14px;margin-bottom:18px}
  .head img{height:60px}
  h1{font-size:22px;color:#5d3f4e;margin:8px 0 2px}
  .sub{color:#8f8880;font-size:13px}
  .info{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin:14px 0}
  .chip{background:#f7f2f5;border:1px solid #d9c8d1;border-radius:10px;padding:5px 12px;font-size:13px;font-weight:bold;color:#5d3f4e}
  table{width:100%;border-collapse:collapse;margin-top:10px;font-size:14px}
  th{background:#5d3f4e;color:#fff;padding:9px;font-size:14px}
  td{border:1px solid #e8e4df;padding:8px;text-align:center}
  tr:nth-child(even) td{background:#f7f2f5}
  .foot{text-align:center;color:#a39c93;font-size:12px;margin-top:18px}
  @media print{body{padding:10px}}
</style></head><body>
  <div class="head">
    <img src="${window.location.origin}/logo.png" alt="الماهر"/>
    <h1>جدول الحفظ — الطالبة ${name || ""}</h1>
    <div class="sub">جمعية الماهر بالقرآن وعلومه</div>
  </div>
  <div class="info">
    <span class="chip">🕌 ${halaqaTitle(halaqa)}</span>
    ${startLabel ? `<span class="chip">📖 بداية الحفظ: ${startLabel}</span>` : ""}
    <span class="chip">📅 ${ar(schedule.length)} لقاء</span>
  </div>
  <table>
    <thead><tr><th>اللقاء</th><th>التاريخ</th><th>حفظ</th><th>تثبيت</th><th>مراجعة</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="foot">الأوجه لكل لقاء · التثبيت = حفظ اللقاء السابق</div>
  <script>window.onload=function(){window.print()}</script>
</body></html>`);
    w.document.close();
  };

  return (
    <Sheet open onClose={onClose} title="بيانات الطالبة">
      <Field label="اسم الطالبة" icon="🌸">
        <input
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>

      {student.code && (
        <div className="mb-3 flex items-center justify-between rounded-2xl bg-plum-50 px-4 py-3">
          <div>
            <p className="text-xs font-bold text-plum-700">🔑 رمز دخول الطالبة</p>
            <p
              className="font-kufi text-2xl font-bold tracking-[0.2em] text-plum-800"
              dir="ltr"
            >
              {student.code}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(student.code).then(
                () => setCopied(true),
                () => setCopied(false)
              );
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="rounded-xl bg-plum-600 px-4 py-2 text-sm font-bold text-white"
          >
            {copied ? "تم النسخ ✓" : "نسخ"}
          </button>
        </div>
      )}

      <div className="mb-1 grid grid-cols-2 gap-3">
        <Field label="المعلّمة" icon="👩‍🏫">
          <select
            className={inputCls}
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
          >
            <option value="">بدون معلّمة</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="الحلقة" icon="🕌">
          <select
            className={inputCls}
            value={halaqaId}
            onChange={(e) => setHalaqaId(e.target.value)}
          >
            {halaqas.map((h) => (
              <option key={h.id} value={h.id}>
                {h.mosque} {h.day && `— ${h.day}`}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mb-1 grid grid-cols-2 gap-3">
        <Field label="بداية الحفظ — السورة" icon="📖">
          <select
            className={inputCls}
            value={plan.startSurah ?? ""}
            onChange={(e) =>
              setPlan({ ...plan, startSurah: e.target.value, startAyah: 1 })
            }
          >
            <option value="">اختاري السورة…</option>
            {SURAHS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="رقم الآية" icon="🔢">
          <select
            className={inputCls}
            value={plan.startAyah ?? 1}
            onChange={(e) =>
              setPlan({ ...plan, startAyah: Number(e.target.value) })
            }
            disabled={!plan.startSurah}
          >
            {Array.from(
              { length: Math.max(1, ayahCount(plan.startSurah ?? "")) },
              (_, i) => i + 1
            ).map((n) => (
              <option key={n} value={n}>
                {n.toLocaleString("ar-EG")}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* خطة الفصل بالأوجه */}
      <div className="mb-3 rounded-2xl border border-cream-dark p-3">
        <p className="mb-1 font-kufi text-sm font-bold text-plum-800">
          📋 خطة الفصل (بالأوجه)
        </p>
        <p className="mb-2 text-[11px] text-silver-600">
          إجمالي أوجه الفصل — يوزّعها النظام على اللقاءات، والتثبيت يُحسب تلقائياً
          (= حفظ الحصة الفائتة)
        </p>
        <div className="grid grid-cols-2 gap-2">
          {PLAN_FIELDS.map(({ key, label, icon }) => (
            <label key={key} className="block">
              <span className="mb-1 block text-xs font-bold text-plum-700">
                {icon} {label.replace("أوجه ", "")}
              </span>
              <input
                className={`${inputCls} text-center`}
                inputMode="numeric"
                placeholder="٠"
                value={plan[key] || ""}
                onChange={(e) =>
                  setPlan({ ...plan, [key]: planNum(e.target.value) })
                }
              />
            </label>
          ))}
        </div>
      </div>

      {/* جدول الحفظ المولّد */}
      {schedule ? (
        <div className="mb-3 rounded-2xl border border-cream-dark p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-kufi text-sm font-bold text-plum-800">
              📅 جدول الحفظ ({ar(schedule.length)} لقاء)
            </p>
            <button
              type="button"
              onClick={printSchedule}
              className="rounded-full bg-plum-600 px-3 py-1 text-xs font-bold text-white"
            >
              🖨️ طباعة
            </button>
          </div>
          <div className="overflow-hidden rounded-xl border border-cream-dark">
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] text-center text-xs">
              {["لقاء", "التاريخ", "📖", "📌", "🔁"].map((h) => (
                <div
                  key={h}
                  className="bg-plum-800 py-1.5 font-kufi font-bold text-white"
                >
                  {h}
                </div>
              ))}
              {schedule.map((s) => (
                <div key={s.n} className="contents">
                  <div className="border-t border-cream-dark py-1.5">{ar(s.n)}</div>
                  <div className="border-t border-cream-dark py-1.5">
                    {formatSchedDate(s.date)}
                  </div>
                  <div className="border-t border-cream-dark py-1.5">
                    {s.hifz ? ar(s.hifz) : "—"}
                  </div>
                  <div className="border-t border-cream-dark py-1.5">
                    {s.tathbit ? ar(s.tathbit) : "—"}
                  </div>
                  <div className="border-t border-cream-dark py-1.5">
                    {s.murajaah ? ar(s.murajaah) : "—"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (plan.hifz || plan.murajaah) && halaqa ? (
        <p className="mb-3 rounded-xl bg-cream px-3 py-2.5 text-center text-xs font-bold text-silver-600">
          حدّدي «تاريخ البداية وعدد اللقاءات» من صفحة الحلقة ليظهر الجدول
        </p>
      ) : null}

      <Field label="ملاحظات" icon="📝">
        <textarea
          className={`${inputCls} min-h-16`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

      {updatedLabel && (
        <p className="mb-3 text-center text-xs text-silver-600">
          آخر تحديث: {updatedLabel}
        </p>
      )}

      <PrimaryBtn onClick={save}>حفظ البيانات</PrimaryBtn>
      <div className="mt-2">
        <DangerBtn onClick={remove}>حذف الطالبة</DangerBtn>
      </div>
    </Sheet>
  );
}

/** سطر صغير تحت اسم الطالبة: بداية الحفظ إن وُجدت */
export function GoalDots({ student }: { student: Student }) {
  const start = hifzStartLabel(student.plan);
  if (!start) return null;
  return (
    <span className="text-[11px] font-normal text-white/80">📖 {start}</span>
  );
}
