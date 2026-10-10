"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  activeStudents,
  buildSchedule,
  dateKey,
  EMPTY_PLAN,
  halaqaTitle,
  isDesc,
  isMurDesc,
  recitePartLabel,
  useApp,
  type Halaqa,
  type RecitationLog,
  type RecitePart,
  type Student,
} from "@/lib/store";
import { partFaces } from "@/lib/progress";
import { useForceLight } from "@/components/theme-toggle";
import { useHydrated } from "@/components/ui";
import { RoleOnly } from "@/components/admin-only";

const ar = (n: number) => n.toLocaleString("ar-EG");
const fmt = (n: number) => (Number.isInteger(n) ? ar(n) : n.toLocaleString("ar-EG", { maximumFractionDigits: 2 }));
const dayLabel = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("ar-u-ca-gregory-nu-arab", { weekday: "long", day: "numeric", month: "long" });
const shortDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("ar-u-ca-gregory-nu-arab", { day: "numeric", month: "numeric" });
const shortName = (name: string) => name.split(/\s+/).slice(0, 3).join(" ");

type Mode = "detail" | "grid";

/** 🖨️ سجل تسميع الحلقة — ما سمّعته كل طالبة في كل لقاء فائت من الفصل،
    لحلقة واحدة (المسجد واليوم)، ولمعلّمة واحدة إن اختيرت. «تفصيلي» = جدول لكل لقاء بالمقاطع،
    «مختصر» = جدول واحد بالأوجه (الطالبات × اللقاءات) بالعرض. */
export default function RecitePrintPage() {
  return (
    <RoleOnly roles={["admin"]}>
      <Suspense fallback={<main className="p-8" />}>
        <RecitePrint />
      </Suspense>
    </RoleOnly>
  );
}

interface Meeting {
  n: number; // رقم اللقاء في الفصل (٠ = خارج الجدول)
  date: string;
}

interface Cell {
  log?: RecitationLog;
  hifz: number;
  tathbit: number;
  mur: number;
}

function faceOf(log: RecitationLog, s: Student) {
  return {
    hifz: log.faces?.tasmi ?? partFaces(log.tasmi, isDesc(s.plan)),
    tathbit: log.faces?.tathbit ?? partFaces(log.tathbit, isDesc(s.plan)),
    mur: log.faces?.muraja ?? partFaces(log.muraja, isMurDesc(s.plan), "muraja"),
  };
}

/** لقاءات الفصل الفائتة (حتى اليوم) + أي تاريخ سُجّل خارج الجدول */
function meetingsOf(h: Halaqa, logs: RecitationLog[], today: string): Meeting[] {
  const sched = (buildSchedule(h, EMPTY_PLAN) ?? []).map((r) => ({ n: r.n, date: dateKey(r.date) }));
  const past = sched.filter((m) => m.date <= today);
  const known = new Set(past.map((m) => m.date));
  const extra = [...new Set(logs.map((l) => l.date))]
    .filter((d) => !known.has(d) && d <= today && (!h.termStart || d >= h.termStart))
    .map((d) => ({ n: sched.find((m) => m.date === d)?.n ?? 0, date: d }));
  return [...past, ...extra].sort((a, b) => a.date.localeCompare(b.date));
}

function RecitePrint() {
  useForceLight(); // 🖨️ الطباعة فاتحة دائماً
  const hydrated = useHydrated();
  const params = useSearchParams();
  const state = useApp();
  const { halaqas, teachers, recitations } = state;
  const students = useMemo(() => activeStudents(state.students), [state.students]);

  const initHalaqa = halaqas.find((h) => h.id === params.get("halaqa"));
  // كل حلقة باسمها: «مسجد البحر — الاثنين» غير «مسجد البحر — الأربعاء»
  const sortedHalaqas = useMemo(() => [...halaqas].sort((a, b) => halaqaTitle(a).localeCompare(halaqaTitle(b), "ar")), [halaqas]);
  const [halaqaId, setHalaqaId] = useState(initHalaqa?.id ?? "");
  const [teacherId, setTeacherId] = useState("");
  const [mode, setMode] = useState<Mode>("detail");
  const cur = sortedHalaqas.find((h) => h.id === halaqaId) ?? sortedHalaqas[0];
  const chosen = cur ? [cur] : [];
  const today = dateKey(new Date());
  // معلّمات النطاق المختار: من تُسند لها الحلقة أو لها طالبات فيها
  const scopeIds = new Set(chosen.map((h) => h.id));
  const scopeTeachers = teachers
    .filter((t) => t.halaqaIds.some((id) => scopeIds.has(id)) || students.some((s) => s.teacherId === t.id && scopeIds.has(s.halaqaId)))
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  const teacher = scopeTeachers.find((t) => t.id === teacherId);

  const blocks = useMemo(
    () =>
      chosen.flatMap((h) => {
        const list = students.filter((s) => s.halaqaId === h.id && (!teacher || s.teacherId === teacher.id)).sort((a, b) => a.name.localeCompare(b.name, "ar"));
        if (teacher && !list.length) return [];
        const ids = new Set(list.map((s) => s.id));
        const logs = recitations.filter((r) => ids.has(r.studentId) && (!h.termStart || r.date >= h.termStart) && r.date <= today);
        const meetings = meetingsOf(h, logs, today);
        const cell = (s: Student, date: string): Cell => {
          const log = logs.find((l) => l.studentId === s.id && l.date === date);
          if (!log || !log.attended) return { log, hifz: 0, tathbit: 0, mur: 0 };
          return { log, ...faceOf(log, s) };
        };
        const tNames = teacher ? [teacher.name] : teachers.filter((t) => t.halaqaIds.includes(h.id)).map((t) => t.name);
        return [{ h, list, meetings, cell, tNames }];
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chosen.map((h) => h.id).join(), teacher?.id, students, recitations, teachers, today]
  );

  if (!hydrated) return <main className="p-8" />;

  const back = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.assign("/director");
  };

  const partText = (p: RecitePart | undefined, faces: number, reverse = false) => {
    const label = recitePartLabel(p, reverse);
    if (!label) return <span className="none">—</span>;
    return (
      <>
        {label}
        <span className="f">{fmt(faces)} وجه</span>
      </>
    );
  };

  return (
    <main className="rp">
      <style>{`
        .rp{font-family:'Amiri','Traditional Arabic','Geeza Pro','Times New Roman',serif;color:#3a2a32;background:#fff;min-height:100dvh;padding-bottom:30px}
        .rp .bar{position:sticky;top:0;z-index:10;background:#f2efec;padding:10px 12px;border-bottom:1px solid #e0d6dc;display:flex;flex-direction:column;gap:8px}
        .rp .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
        .rp select{font-family:inherit;font-size:16px;font-weight:700;border:1px solid #d9c8d1;border-radius:10px;padding:8px 10px;background:#fff;color:#5d3f4e;flex:1;min-width:140px}
        .rp .seg{display:flex;background:#e8dfe4;border-radius:12px;padding:3px;flex:1}
        .rp .seg button{flex:1;font-family:inherit;font-size:15px;font-weight:700;border:none;border-radius:9px;padding:7px 8px;background:transparent;color:#7d5a6c;cursor:pointer}
        .rp .seg button.on{background:#fff;color:#4d3340;box-shadow:0 1px 3px #0001}
        .rp .act{font-family:inherit;font-size:16px;font-weight:700;border:none;border-radius:12px;padding:9px 18px;cursor:pointer}
        .rp .back{background:#e8dfe4;color:#5d3f4e}
        .rp .print{background:#5d3f4e;color:#fff}
        .rp .sheet{padding:18px 14px;max-width:1100px;margin:0 auto}
        .rp .hal{margin-bottom:26px}
        .rp .hal + .hal{break-before:page;page-break-before:always}
        .rp .head{text-align:center;border-bottom:2px solid #a8894f;padding-bottom:10px;margin-bottom:12px}
        .rp .head img{height:56px;display:block;margin:0 auto}
        .rp h1{font-size:26px;color:#5d3f4e;margin:4px 0 0}
        .rp .sub{font-size:17px;font-weight:700}
        .rp .meta{font-size:14px;color:#7d6a74}
        .rp .meet{margin-bottom:14px;break-inside:avoid;page-break-inside:avoid}
        .rp .mt{background:#5d3f4e;color:#fff;font-weight:700;font-size:16px;padding:6px 10px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between}
        .rp table{width:100%;border-collapse:collapse;font-size:14px}
        .rp th{background:#efe6eb;color:#4d3340;padding:6px 4px;border:1px solid #d9c8d1;font-weight:700}
        .rp td{border:1px solid #d9c8d1;padding:5px 5px;text-align:center;vertical-align:middle}
        .rp td.nm{text-align:start;font-weight:700;white-space:nowrap}
        .rp tr:nth-child(even) td{background:#faf6f8}
        .rp .f{display:block;font-size:12px;color:#8b7c84}
        .rp .none{color:#b9aab2}
        .rp .abs{color:#b42318;font-weight:700}
        .rp .nolog{color:#a16207;font-size:12px}
        .rp .star{color:#c99a3e}
        .rp td.sum{background:#f6efe2 !important;font-weight:700}
        .rp .mx td{padding:4px 3px;font-size:12.5px;line-height:1.35;white-space:nowrap}
        .rp .mx td.nm{white-space:normal;min-width:90px;width:16%}
        .rp .mx th{font-size:12px;padding:4px 2px}
        .rp .mx .c b{display:block}
        .rp .legend{font-size:12px;color:#7d6a74;margin-top:6px}
        .rp .empty{text-align:center;color:#8b7c84;padding:40px 10px;font-size:18px}
        @media print{
          body{background:#fff !important}
          .rp .bar{display:none}
          .rp .sheet{padding:0;max-width:none}
          @page{size:A4 ${mode === "grid" ? "landscape" : "portrait"};margin:10mm}
        }
      `}</style>

      <div className="bar">
        <div className="row">
          <button type="button" className="act back" onClick={back}>
            → رجوع
          </button>
          <select
            value={cur?.id ?? ""}
            onChange={(e) => {
              setHalaqaId(e.target.value);
              setTeacherId("");
            }}
            aria-label="الحلقة"
          >
            {sortedHalaqas.map((h) => (
              <option key={h.id} value={h.id}>
                🕌 {halaqaTitle(h)}
              </option>
            ))}
          </select>
          <select value={teacher ? teacherId : ""} onChange={(e) => setTeacherId(e.target.value)} aria-label="المعلّمة">
            <option value="">👩‍🏫 كل المعلّمات ({ar(scopeTeachers.length)})</option>
            {scopeTeachers.map((t) => (
              <option key={t.id} value={t.id}>
                👩‍🏫 {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="row">
          <div className="seg">
            <button type="button" className={mode === "detail" ? "on" : ""} onClick={() => setMode("detail")}>
              📋 تفصيلي (المقاطع)
            </button>
            <button type="button" className={mode === "grid" ? "on" : ""} onClick={() => setMode("grid")}>
              🔢 مختصر (الأوجه)
            </button>
          </div>
          <button type="button" className="act print" onClick={() => window.print()}>
            🖨️ طباعة
          </button>
        </div>
      </div>

      <div className="sheet">
        {!blocks.length && <p className="empty">{teacher ? "لا طالبات لهذه المعلّمة في هذه الحلقة" : "لا توجد حلقات"}</p>}
        {blocks.map(({ h, list, meetings, cell, tNames }) => {
          const totals = list.map((s) => {
            let hifz = 0,
              tathbit = 0,
              mur = 0,
              att = 0,
              abs = 0;
            for (const m of meetings) {
              const c = cell(s, m.date);
              if (!c.log) continue;
              if (c.log.attended) att++;
              else abs++;
              hifz += c.hifz;
              tathbit += c.tathbit;
              mur += c.mur;
            }
            return { s, hifz, tathbit, mur, att, abs };
          });
          return (
            <section key={h.id} className="hal">
              <div className="head">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="الماهر" />
                <h1>سجل تسميع الحلقة</h1>
                <div className="sub">🕌 {halaqaTitle(h)}</div>
                <div className="meta">
                  {tNames.length > 0 && <>المعلّمة: {tNames.join(" · ")} — </>}
                  {ar(list.length)} طالبة · {ar(meetings.length)} لقاء حتى {dayLabel(today)}
                </div>
              </div>

              {!meetings.length && <p className="empty">لم يبدأ الفصل بعد في هذه الحلقة</p>}

              {mode === "detail" &&
                meetings.map((m) => {
                  const rows = list.map((s) => ({ s, c: cell(s, m.date) }));
                  const present = rows.filter((r) => r.c.log?.attended).length;
                  return (
                    <div key={m.date} className="meet">
                      <div className="mt">
                        <span>{m.n ? `اللقاء ${ar(m.n)}` : "لقاء إضافي"} — {dayLabel(m.date)}</span>
                        <span>
                          حضور {ar(present)} من {ar(list.length)}
                        </span>
                      </div>
                      <table>
                        <thead>
                          <tr>
                            <th style={{ width: "22%" }}>الطالبة</th>
                            <th>📖 الحفظ الجديد</th>
                            <th>📌 التثبيت</th>
                            <th>🔁 المراجعة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(({ s, c }) => (
                            <tr key={s.id}>
                              <td className="nm">
                                {shortName(s.name)}
                                {c.log?.star && <span className="star"> ⭐</span>}
                              </td>
                              {!c.log ? (
                                <td colSpan={3} className="nolog">
                                  ⏳ لم يُسجَّل
                                </td>
                              ) : !c.log.attended ? (
                                <td colSpan={3} className="abs">
                                  ✗ غائبة
                                </td>
                              ) : (
                                <>
                                  <td>{partText(c.log.tasmi, c.hifz)}</td>
                                  <td>{partText(c.log.tathbit, c.tathbit)}</td>
                                  <td>{partText(c.log.muraja, c.mur, isMurDesc(s.plan))}</td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}

              {mode === "grid" && meetings.length > 0 && (
                <>
                  <table className="mx">
                    <thead>
                      <tr>
                        <th>الطالبة</th>
                        {meetings.map((m) => (
                          <th key={m.date}>
                            {m.n ? `ل${ar(m.n)}` : "إضافي"}
                            <span className="f">{shortDate(m.date)}</span>
                          </th>
                        ))}
                        <th>المجموع</th>
                      </tr>
                    </thead>
                    <tbody>
                      {totals.map((t) => (
                        <tr key={t.s.id}>
                          <td className="nm">{shortName(t.s.name)}</td>
                          {meetings.map((m) => {
                            const c = cell(t.s, m.date);
                            return (
                              <td key={m.date} className="c">
                                {!c.log ? (
                                  <span className="nolog">⏳</span>
                                ) : !c.log.attended ? (
                                  <span className="abs">غ</span>
                                ) : (
                                  <>
                                    <b>
                                      ح {fmt(c.hifz)}
                                      {c.log.star && <span className="star">⭐</span>}
                                    </b>
                                    {c.tathbit > 0 && <span>ث {fmt(c.tathbit)}</span>}
                                    {c.tathbit > 0 && <br />}
                                    <span>م {fmt(c.mur)}</span>
                                  </>
                                )}
                              </td>
                            );
                          })}
                          <td className="c sum">
                            ح {fmt(t.hifz)}
                            <br />
                            {t.tathbit > 0 && (
                              <>
                                ث {fmt(t.tathbit)}
                                <br />
                              </>
                            )}
                            م {fmt(t.mur)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="legend">ح = أوجه الحفظ · ث = التثبيت · م = المراجعة · غ = غائبة · ⏳ لم يُسجَّل · ⭐ ماهرة</p>
                </>
              )}

              {mode === "detail" && meetings.length > 0 && (
                <div className="meet">
                  <div className="mt">
                    <span>📊 المجموع في {ar(meetings.length)} لقاء</span>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: "22%" }}>الطالبة</th>
                        <th>📖 الحفظ</th>
                        <th>📌 التثبيت</th>
                        <th>🔁 المراجعة</th>
                        <th>حضور / غياب</th>
                      </tr>
                    </thead>
                    <tbody>
                      {totals.map((t) => (
                        <tr key={t.s.id}>
                          <td className="nm">{shortName(t.s.name)}</td>
                          <td>{fmt(t.hifz)} وجه</td>
                          <td>{fmt(t.tathbit)} وجه</td>
                          <td>{fmt(t.mur)} وجه</td>
                          <td>
                            {ar(t.att)} / <span className={t.abs ? "abs" : ""}>{ar(t.abs)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
