"use client";

import { useMemo, useState } from "react";
import { activeStudents, dateKey, halaqaTitle, useApp, type Student } from "@/lib/store";
import { achievementRows, type AchievementRow } from "@/lib/achievement";
import { useForceLight } from "@/components/theme-toggle";
import { useHydrated } from "@/components/ui";
import { RoleOnly } from "@/components/admin-only";
import { StudentSheet } from "@/components/student-sheet";

const ar = (n: number) => n.toLocaleString("ar-EG", { maximumFractionDigits: 2 });
const facesWord = (n: number) => (!Number.isInteger(n) ? "وجه" : n > 2 && n <= 10 ? "أوجه" : "وجهاً");
const faces = (n: number) => (n === 1 ? "وجه" : n === 2 ? "وجهان" : `${ar(n)} ${facesWord(n)}`);
const byName = (a: AchievementRow, b: AchievementRow) => a.st.name.localeCompare(b.st.name, "ar");

type Tab = "perfect" | "ahead" | "behind" | "top";
const TABS: { key: Tab; icon: string; label: string; hint: string }[] = [
  { key: "perfect", icon: "🌟", label: "المواظبات", hint: "حضرن كل لقاءات الحلقة من بداية الفصل، وكلها مسجّلة" },
  { key: "ahead", icon: "🚀", label: "المتقدمات عن الخطة", hint: "موضع حفظهن أبعد من المطلوب في الخطة حتى آخر لقاء مسجّل" },
  { key: "behind", icon: "⏳", label: "المتأخرات عن الخطة", hint: "موضع حفظهن دون المطلوب في الخطة حتى آخر لقاء مسجّل" },
  { key: "top", icon: "🏆", label: "الأكثر حفظاً", hint: "مجموع أوجه الحفظ الجديد المسمَّعة هذا الفصل" },
];

/** 📊 قوائم الإنجاز — للإدارة: المواظبات، المتقدمات والمتأخرات عن الخطة بالأوجه، والأكثر حفظاً؛ مع الطباعة */
export default function AchievementsPage() {
  return (
    <RoleOnly roles={["admin"]}>
      <Achievements />
    </RoleOnly>
  );
}

function Achievements() {
  useForceLight(); // 🖨️ الطباعة فاتحة دائماً
  const hydrated = useHydrated();
  const state = useApp();
  const { halaqas, teachers, recitations } = state;
  const students = useMemo(() => activeStudents(state.students), [state.students]);
  const [tab, setTab] = useState<Tab>("perfect");
  const [halaqaId, setHalaqaId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [selected, setSelected] = useState<Student | null>(null);

  const sortedHalaqas = useMemo(() => [...halaqas].sort((a, b) => halaqaTitle(a).localeCompare(halaqaTitle(b), "ar")), [halaqas]);
  const sortedTeachers = useMemo(() => [...teachers].sort((a, b) => a.name.localeCompare(b.name, "ar")), [teachers]);
  const all = useMemo(() => (hydrated ? achievementRows(students, halaqas, recitations) : []), [hydrated, students, halaqas, recitations]);

  if (!hydrated) return <main className="p-8" />;

  const scope = all.filter((r) => (!halaqaId || r.st.halaqaId === halaqaId) && (!teacherId || r.st.teacherId === teacherId));
  const lists: Record<Tab, AchievementRow[]> = {
    perfect: scope.filter((r) => r.perfect).sort((a, b) => b.attended - a.attended || byName(a, b)),
    ahead: scope.filter((r) => r.aheadHifz > 0).sort((a, b) => b.aheadHifz - a.aheadHifz || byName(a, b)),
    behind: scope.filter((r) => r.aheadHifz < 0).sort((a, b) => a.aheadHifz - b.aheadHifz || byName(a, b)),
    top: scope.filter((r) => r.hifzFaces > 0).sort((a, b) => b.hifzFaces - a.hifzFaces || byName(a, b)),
  };
  const list = lists[tab];
  const meta = TABS.find((t) => t.key === tab)!;
  // بلا غياب لكن لهن لقاءات لم تُسجَّل — يدخلن المواظبات بعد إدخالها
  const waiting = scope.filter((r) => r.meetings > 0 && r.absent === 0 && r.unlogged > 0).sort(byName);
  const teacherName = (id: string) => teachers.find((t) => t.id === id)?.name ?? "—";
  const scopeLabel = [halaqaId && halaqaTitle(halaqas.find((h) => h.id === halaqaId)!), teacherId && `أ. ${teacherName(teacherId)}`]
    .filter(Boolean)
    .join(" · ");
  const today = new Date().toLocaleDateString("ar-u-ca-gregory-nu-arab", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const mur = (r: AchievementRow) =>
    !r.hasMurPlan ? <span className="none">—</span> : r.aheadMur === 0 ? "على الخطة" : `${r.aheadMur > 0 ? "متقدمة" : "متأخرة"} ${faces(Math.abs(r.aheadMur))}`;

  const back = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.assign("/director");
  };

  return (
    <main className="ach">
      <style>{`
        .ach{font-family:'Amiri','Traditional Arabic','Geeza Pro','Times New Roman',serif;color:#3a2a32;background:#fff;min-height:100dvh;padding-bottom:30px}
        .ach .bar{position:sticky;top:0;z-index:10;background:#f2efec;padding:10px 12px;border-bottom:1px solid #e0d6dc;display:flex;flex-direction:column;gap:8px}
        .ach .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
        .ach select{font-family:inherit;font-size:16px;font-weight:700;border:1px solid #d9c8d1;border-radius:10px;padding:8px 10px;background:#fff;color:#5d3f4e;flex:1;min-width:140px}
        .ach .tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px}
        .ach .tabs button{font-family:inherit;font-size:15px;font-weight:700;border:1px solid #d9c8d1;border-radius:12px;padding:8px 6px;background:#fff;color:#7d5a6c;cursor:pointer}
        .ach .tabs button.on{background:#5d3f4e;color:#fff;border-color:#5d3f4e}
        .ach .tabs small{display:block;font-size:12px;font-weight:400;opacity:.85}
        .ach .act{font-family:inherit;font-size:16px;font-weight:700;border:none;border-radius:12px;padding:9px 18px;cursor:pointer}
        .ach .back{background:#e8dfe4;color:#5d3f4e}
        .ach .print{background:#5d3f4e;color:#fff;flex:1}
        .ach .sheet{padding:18px 14px;max-width:900px;margin:0 auto}
        .ach .head{text-align:center;border-bottom:2px solid #a8894f;padding-bottom:10px;margin-bottom:12px}
        .ach .head img{height:56px;display:block;margin:0 auto}
        .ach h1{font-size:26px;color:#5d3f4e;margin:4px 0 0}
        .ach .sub{font-size:17px;font-weight:700}
        .ach .meta{font-size:14px;color:#7d6a74}
        .ach table{width:100%;border-collapse:collapse;font-size:15px}
        .ach th{background:#efe6eb;color:#4d3340;padding:6px 4px;border:1px solid #d9c8d1;font-weight:700}
        .ach td{border:1px solid #d9c8d1;padding:6px 5px;text-align:center;vertical-align:middle}
        .ach td.nm{text-align:start;font-weight:700}
        .ach td.nm button{font:inherit;color:inherit;background:none;border:none;padding:0;cursor:pointer;text-align:start}
        .ach td.num{font-weight:700;white-space:nowrap}
        .ach td.up{color:#166534}
        .ach td.down{color:#b42318}
        .ach tr:nth-child(even) td{background:#faf6f8}
        .ach .none{color:#b9aab2}
        .ach .note{margin-top:14px;border:1px solid #ecd9a8;background:#fdf8ea;border-radius:10px;padding:10px 12px;font-size:14px}
        .ach .note b{color:#7a5a12}
        .ach .empty{text-align:center;color:#8b7c84;padding:40px 10px;font-size:18px}
        @media print{
          body{background:#fff !important}
          .ach .bar{display:none}
          .ach .sheet{padding:0;max-width:none}
          .ach td.nm button{cursor:default}
          @page{size:A4 portrait;margin:10mm}
        }
      `}</style>

      <div className="bar">
        <div className="row">
          <button type="button" className="act back" onClick={back}>
            → رجوع
          </button>
          <button type="button" className="act print" onClick={() => window.print()}>
            🖨️ طباعة القائمة
          </button>
        </div>
        <div className="row">
          <select value={halaqaId} onChange={(e) => setHalaqaId(e.target.value)} aria-label="الحلقة">
            <option value="">🕌 كل الحلقات</option>
            {sortedHalaqas.map((h) => (
              <option key={h.id} value={h.id}>
                🕌 {halaqaTitle(h)}
              </option>
            ))}
          </select>
          <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} aria-label="المعلّمة">
            <option value="">👩‍🏫 كل المعلّمات</option>
            {sortedTeachers.map((t) => (
              <option key={t.id} value={t.id}>
                👩‍🏫 {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t.key} type="button" className={tab === t.key ? "on" : ""} onClick={() => setTab(t.key)}>
              {t.icon} {t.label}
              <small>{ar(lists[t.key].length)} طالبة</small>
            </button>
          ))}
        </div>
      </div>

      <div className="sheet">
        <div className="head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" />
          <h1>
            {meta.icon} {meta.label}
          </h1>
          <p className="sub">
            {scopeLabel || "كل الحلقات"} · {ar(list.length)} طالبة
          </p>
          <p className="meta">
            {meta.hint} · {today}
          </p>
        </div>

        {!list.length ? (
          <p className="empty">لا طالبات في هذه القائمة</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: "6%" }}>م</th>
                <th>الطالبة</th>
                <th>الحلقة</th>
                <th>المعلّمة</th>
                {tab === "perfect" && <th>لقاءات الحضور</th>}
                {tab === "ahead" && <th>التقدّم في الحفظ</th>}
                {tab === "behind" && <th>التأخّر في الحفظ</th>}
                {(tab === "ahead" || tab === "behind") && <th>المراجعة</th>}
                {tab === "top" && <th>مجموع الحفظ</th>}
                {tab === "top" && <th>الحضور</th>}
              </tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={r.st.id}>
                  <td>{ar(i + 1)}</td>
                  <td className="nm">
                    <button type="button" onClick={() => setSelected(r.st)}>
                      {r.st.name}
                    </button>
                  </td>
                  <td>{r.halaqa ? halaqaTitle(r.halaqa) : "—"}</td>
                  <td>{teacherName(r.st.teacherId)}</td>
                  {tab === "perfect" && (
                    <td className="num">
                      {ar(r.attended)} من {ar(r.meetings)}
                    </td>
                  )}
                  {tab === "ahead" && <td className="num up">+ {faces(r.aheadHifz)}</td>}
                  {tab === "behind" && <td className="num down">− {faces(Math.abs(r.aheadHifz))}</td>}
                  {(tab === "ahead" || tab === "behind") && <td>{mur(r)}</td>}
                  {tab === "top" && <td className="num">{faces(r.hifzFaces)}</td>}
                  {tab === "top" && (
                    <td>
                      {ar(r.attended)} من {ar(r.meetings)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "perfect" && waiting.length > 0 && (
          <div className="note">
            <b>⏳ بلا غياب، لكن لهن لقاءات لم تُسجَّل بعد ({ar(waiting.length)}):</b> يدخلن القائمة بعد أن تسجّل المعلّمة اللقاءات الناقصة.
            <br />
            {waiting.map((r) => `${r.st.name} (${ar(r.unlogged)})`).join(" · ")}
          </div>
        )}
      </div>

      <StudentSheet student={selected ? (students.find((s) => s.id === selected.id) ?? selected) : null} onClose={() => setSelected(null)} />
    </main>
  );
}
