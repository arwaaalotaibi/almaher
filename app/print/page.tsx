"use client";

import { useEffect, useState } from "react";
import { formatSchedDate } from "@/lib/store";
import { PRINT_KEY, type PrintPayload } from "@/lib/print-schedule";

const ar = (n: number) => n.toLocaleString("ar-EG");

/** 🖨️ صفحة طباعة جدول الحفظ — داخل التطبيق (تعمل في المتصفح وفي التطبيق المثبّت) */
export default function PrintPage() {
  const [data, setData] = useState<PrintPayload | null | undefined>(undefined);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(PRINT_KEY);
      setData(raw ? (JSON.parse(raw) as PrintPayload) : null);
    } catch {
      setData(null);
    }
  }, []);

  const back = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.assign("/");
  };

  if (data === undefined) return <main className="p-8" />;

  if (!data) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-3xl">🖨️</p>
        <p className="mt-2 font-kufi font-bold text-plum-800">لا يوجد جدول للطباعة</p>
        <p className="mt-1 text-sm text-silver-600">
          ارجعي إلى «خطتي» واضغطي زر الطباعة من جديد
        </p>
        <button
          type="button"
          onClick={back}
          className="mt-5 rounded-xl bg-plum-600 px-5 py-2.5 text-sm font-bold text-white"
        >
          → رجوع
        </button>
      </main>
    );
  }

  const dash = "–";
  return (
    <main className="print-page">
      <style>{`
        .print-page{font-family:'Amiri','Traditional Arabic','Geeza Pro','Times New Roman',serif;color:#3a2a32;background:#fff;min-height:100dvh;padding:0 0 34px}
        .print-page .bar{position:sticky;top:0;z-index:10;display:flex;gap:10px;justify-content:space-between;background:#f2efec;padding:12px 14px;border-bottom:1px solid #e0d6dc}
        .print-page .bar button{font-family:inherit;font-size:17px;font-weight:700;border:none;border-radius:12px;padding:11px 20px;cursor:pointer}
        .print-page .back{background:#e8dfe4;color:#5d3f4e}
        .print-page .print{background:#5d3f4e;color:#fff}
        .print-page .sheet{padding:24px 16px}
        .print-page .frame{border:3px double #7d5a6c;border-radius:8px;padding:22px 18px 16px;max-width:900px;margin:0 auto}
        .print-page .head{text-align:center}
        .print-page .head img{height:74px}
        .print-page h1{font-size:32px;font-weight:700;color:#5d3f4e;margin:10px 0 2px}
        .print-page .name{font-size:21px;font-weight:700}
        .print-page .assoc{color:#a8894f;font-size:16px;margin-top:2px}
        .print-page .rule{height:2px;background:linear-gradient(90deg,transparent,#a8894f,transparent);margin:14px 0}
        .print-page .info{text-align:center;font-size:18px;color:#5d3f4e;margin-bottom:14px;line-height:2}
        .print-page .info b{color:#3a2a32}
        .print-page table{width:100%;border-collapse:collapse;font-size:17px}
        .print-page th{background:#5d3f4e;color:#fff;padding:11px 8px;font-weight:700;border:1px solid #4d3340}
        .print-page td{border:1px solid #d9c8d1;padding:10px 6px;text-align:center}
        .print-page td.num{font-weight:700;color:#5d3f4e}
        .print-page td.seg{font-weight:700}
        .print-page tr:nth-child(even) td{background:#faf6f8}
        .print-page .foot{text-align:center;color:#9c8fa0;font-size:14px;margin-top:14px;font-style:italic}
        @media print{
          body{background:#fff !important}
          .print-page .bar{display:none}
          .print-page .sheet{padding:0}
          .print-page table{font-size:15px}
        }
      `}</style>

      <div className="bar">
        <button type="button" className="back" onClick={back}>
          → رجوع
        </button>
        <button type="button" className="print" onClick={() => window.print()}>
          🖨️ طباعة
        </button>
      </div>

      <div className="sheet">
        <div className="frame">
          <div className="head">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="الماهر" />
            <h1>جدول الحفظ</h1>
            <div className="name">الطالبة: {data.studentName}</div>
            <div className="assoc">جمعية الماهر بالقرآن وعلومه</div>
          </div>
          <div className="rule" />
          <div className="info">
            <b>الحلقة:</b> {data.halaqaLabel}
            {data.startLabel && (
              <>
                &nbsp;&nbsp;•&nbsp;&nbsp;<b>بداية الحفظ:</b> {data.startLabel}
              </>
            )}
            <br />
            <b>عدد اللقاءات:</b> {ar(data.rows.length)}
          </div>
          <table>
            <thead>
              <tr>
                <th>اللقاء</th>
                <th>التاريخ</th>
                <th>الحفظ الجديد</th>
                <th>المراجعة</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((s) => (
                <tr key={s.n}>
                  <td className="num">{ar(s.n)}</td>
                  <td>{formatSchedDate(new Date(s.date))}</td>
                  <td className="seg">
                    {s.hifzLabel || (s.hifz ? `${ar(s.hifz)} أوجه` : dash)}
                  </td>
                  <td className="seg">
                    {s.murajaahLabel || (s.murajaah ? `${ar(s.murajaah)} أوجه` : dash)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="foot">جمعية الماهر بالقرآن وعلومه</div>
        </div>
      </div>
    </main>
  );
}
