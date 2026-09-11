"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { codeLink } from "@/lib/store";
import { PRINT_CODES_KEY, type PrintCodesPayload } from "@/lib/print-codes";

const ar = (n: number) => n.toLocaleString("ar-EG");

/** 🖨️ بطاقات رموز الدخول — بطاقة لكل طالبة (اسم + رمز + QR يُدخلها مباشرة)،
    ثماني بطاقات في صفحة A4 مع خطوط قصّ */
export default function PrintCodesPage() {
  const [data, setData] = useState<PrintCodesPayload | null | undefined>(undefined);
  const [qrs, setQrs] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(PRINT_CODES_KEY);
      setData(raw ? (JSON.parse(raw) as PrintCodesPayload) : null);
    } catch {
      setData(null);
    }
  }, []);

  // توليد QR لكل رمز (رابط دخول مباشر)
  useEffect(() => {
    if (!data) return;
    let alive = true;
    (async () => {
      const out: Record<string, string> = {};
      for (const r of data.rows) {
        try {
          out[r.code] = await QRCode.toDataURL(codeLink(r.code), {
            errorCorrectionLevel: "M",
            margin: 1,
            width: 240,
            color: { dark: "#4d3340", light: "#ffffff" },
          });
        } catch {
          /* بلا QR — تبقى البطاقة بالرمز فقط */
        }
      }
      if (alive) setQrs(out);
    })();
    return () => {
      alive = false;
    };
  }, [data]);

  const back = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.assign("/");
  };

  if (data === undefined) return <main className="p-8" />;

  if (!data || data.rows.length === 0) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-3xl">🖨️</p>
        <p className="mt-2 font-kufi font-bold text-plum-800">لا توجد بطاقات للطباعة</p>
        <p className="mt-1 text-sm text-silver-600">
          ارجعي إلى صفحة الحلقة ثم «عرض أرقام الدخول» واضغطي زر الطباعة
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

  const host =
    typeof window !== "undefined" ? window.location.host : "almaher-one.vercel.app";

  return (
    <main className="print-codes">
      <style>{`
        .print-codes{font-family:'Cairo','Amiri','Geeza Pro',sans-serif;color:#3a2a32;background:#fff;min-height:100dvh;padding-bottom:34px}
        .print-codes .bar{position:sticky;top:0;z-index:10;display:flex;gap:10px;justify-content:space-between;align-items:center;background:#f2efec;padding:12px 14px;border-bottom:1px solid #e0d6dc}
        .print-codes .bar button{font-family:inherit;font-size:17px;font-weight:700;border:none;border-radius:12px;padding:11px 20px;cursor:pointer}
        .print-codes .back{background:#e8dfe4;color:#5d3f4e}
        .print-codes .print{background:#5d3f4e;color:#fff}
        .print-codes .bar .meta{font-size:14px;color:#5d3f4e;font-weight:700}
        .print-codes .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:0;max-width:210mm;margin:16px auto;padding:0 8px}
        .print-codes .card{border:1px dashed #b39aa8;padding:6mm 5mm;display:flex;flex-direction:column;align-items:center;text-align:center;break-inside:avoid;page-break-inside:avoid;height:68mm;box-sizing:border-box;overflow:hidden}
        .print-codes .card img.logo{height:9mm}
        .print-codes .brand{font-size:11px;color:#a8894f;font-weight:700;margin-top:1mm}
        .print-codes .name{font-size:17px;font-weight:800;color:#5d3f4e;margin-top:1.5mm;line-height:1.25}
        .print-codes .halaqa{font-size:11px;color:#8b7a84;margin-top:0.5mm}
        .print-codes .row{display:flex;align-items:center;justify-content:center;gap:5mm;margin-top:1.5mm}
        .print-codes .qr{width:21mm;height:21mm}
        .print-codes .lbl{font-size:11px;color:#8b7a84;font-weight:700}
        .print-codes .code{font-size:26px;font-weight:800;letter-spacing:0.18em;color:#3a2a32;direction:ltr;line-height:1.1}
        .print-codes .hint{font-size:10px;color:#8b7a84;margin-top:1.5mm;line-height:1.45}
        .print-codes .hint b{color:#5d3f4e;direction:ltr;unicode-bidi:embed}
        @media print{
          @page{size:A4;margin:8mm}
          body{background:#fff !important}
          .print-codes .bar{display:none}
          .print-codes{padding:0}
          .print-codes .grid{margin:0;padding:0;max-width:none}
          .print-codes .card:nth-child(8n){page-break-after:always}
        }
      `}</style>

      <div className="bar">
        <button type="button" className="back" onClick={back}>
          → رجوع
        </button>
        <span className="meta">
          {data.halaqaLabel} · {ar(data.rows.length)} بطاقة
        </span>
        <button type="button" className="print" onClick={() => window.print()}>
          🖨️ طباعة
        </button>
      </div>

      <div className="grid">
        {data.rows.map((r) => (
          <div key={r.code} className="card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="logo" src="/logo.png" alt="" />
            <div className="brand">تطبيق الماهر — جمعية الماهر بالقرآن وعلومه</div>
            <div className="name">{r.name}</div>
            <div className="halaqa">{data.halaqaLabel}</div>
            <div className="row">
              {qrs[r.code] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="qr" src={qrs[r.code]} alt="" />
              ) : (
                <span className="qr" />
              )}
              <div>
                <div className="lbl">رمز الدخول</div>
                <div className="code">{r.code}</div>
              </div>
            </div>
            <div className="hint">
              امسحي الرمز بالكاميرا فيدخلكِ مباشرة،
              <br />
              أو افتحي <b>{host}</b> وأدخلي رمزك
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
