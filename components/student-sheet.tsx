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
    const dash = "–";
    const rows = schedule
      .map(
        (s) =>
          `<tr><td class="num">${ar(s.n)}</td><td>${formatSchedDate(
            s.date
          )}</td><td class="seg">${
            s.hifzLabel || (s.hifz ? `${ar(s.hifz)} أوجه` : dash)
          }</td><td class="seg">${s.tathbitLabel || dash}</td><td>${
            s.murajaah ? `${ar(s.murajaah)} أوجه` : dash
          }</td></tr>`
      )
      .join("");
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<title>جدول حفظ — ${name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
<style>
  *{font-family:'Amiri','Traditional Arabic','Geeza Pro','Times New Roman',serif;box-sizing:border-box}
  body{margin:0;padding:34px;color:#3a2a32;background:#fff}
  .frame{border:3px double #7d5a6c;border-radius:8px;padding:26px 28px 20px}
  .head{text-align:center}
  .head img{height:74px}
  h1{font-size:34px;font-weight:700;color:#5d3f4e;margin:10px 0 2px}
  .name{font-size:22px;color:#3a2a32;font-weight:700}
  .assoc{color:#a8894f;font-size:17px;margin-top:2px}
  .rule{height:2px;background:linear-gradient(90deg,transparent,#a8894f,transparent);margin:16px 0}
  .info{text-align:center;font-size:19px;color:#5d3f4e;margin-bottom:16px;line-height:2.1}
  .info b{color:#3a2a32}
  table{width:100%;border-collapse:collapse;font-size:20px}
  th{background:#5d3f4e;color:#fff;padding:13px 10px;font-weight:700;border:1px solid #4d3340}
  td{border:1px solid #d9c8d1;padding:11px 8px;text-align:center}
  td.num{font-weight:700;color:#5d3f4e}
  td.seg{font-weight:700;color:#3a2a32}
  tr:nth-child(even) td{background:#faf6f8}
  .foot{text-align:center;color:#9c8fa0;font-size:15px;margin-top:16px;font-style:italic}
  @media print{body{padding:8px}}
</style></head><body>
  <div class="frame">
    <div class="head">
      <img src="${window.location.origin}/logo.png" alt="الماهر"/>
      <h1>جدول الحفظ</h1>
      <div class="name">الطالبة: ${name || ""}</div>
      <div class="assoc">جمعية الماهر بالقرآن وعلومه</div>
    </div>
    <div class="rule"></div>
    <div class="info">
      <b>الحلقة:</b> ${halaqaTitle(halaqa)}${
        startLabel ? `&nbsp;&nbsp;•&nbsp;&nbsp;<b>بداية الحفظ:</b> ${startLabel}` : ""
      }<br/>
      <b>عدد اللقاءات:</b> ${ar(schedule.length)}
    </div>
    <table>
      <thead><tr><th>اللقاء</th><th>التاريخ</th><th>الحفظ الجديد</th><th>التثبيت</th><th>المراجعة</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="foot">التثبيت = حفظ اللقاء السابق · المراجعة بالأوجه</div>
  </div>
  <script>window.onload=function(){setTimeout(function(){window.print()},400)}</script>
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
          <div className="grid gap-1.5">
            {schedule.map((s) => (
              <div key={s.n} className="rounded-xl bg-cream px-3 py-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-plum-700">لقاء {ar(s.n)}</span>
                  <span className="text-silver-600">
                    {formatSchedDate(s.date)}
                  </span>
                </div>
                <p className="mt-0.5 font-kufi text-sm font-bold text-plum-800">
                  📖 {s.hifzLabel || (s.hifz ? `${ar(s.hifz)} أوجه` : "—")}
                </p>
                <p className="text-[11px] text-silver-600">
                  {s.tathbitLabel && `📌 تثبيت: ${s.tathbitLabel} · `}
                  🔁 مراجعة: {s.murajaah ? `${ar(s.murajaah)} أوجه` : "—"}
                </p>
              </div>
            ))}
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
