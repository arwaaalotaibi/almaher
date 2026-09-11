"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { codeLink } from "@/lib/store";
import { PRINT_CODES_KEY, type PrintCodesPayload } from "@/lib/print-codes";

const ar = (n: number) => n.toLocaleString("ar-EG");

/** 🖨️ بطاقات رموز الدخول — بطاقة لكل طالبة (اسم + رمز + QR يُدخلها مباشرة)،
    أربع بطاقات في صفحة A4 مع خطوط قصّ */
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
            width: 400,
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
  // أربع بطاقات في كل صفحة A4
  const pages: PrintCodesPayload["rows"][] = [];
  for (let i = 0; i < data.rows.length; i += 4) pages.push(data.rows.slice(i, i + 4));

  return (
    <main className="print-codes">
      <style>{`
        .print-codes{font-family:'Cairo','Amiri','Geeza Pro',sans-serif;color:#3a2a32;background:#f7f4f1;min-height:100dvh;padding-bottom:34px}
        .print-codes .bar{position:sticky;top:0;z-index:10;display:flex;gap:10px;justify-content:space-between;align-items:center;background:#f2efec;padding:12px 14px;border-bottom:1px solid #e0d6dc}
        .print-codes .bar button{font-family:inherit;font-size:17px;font-weight:700;border:none;border-radius:12px;padding:11px 20px;cursor:pointer}
        .print-codes .back{background:#e8dfe4;color:#5d3f4e}
        .print-codes .print{background:#5d3f4e;color:#fff}
        .print-codes .bar .meta{font-size:14px;color:#5d3f4e;font-weight:700}
        /* صفحة A4 صريحة: ٢١٠×٢٩٧ ملم، هوامش داخلية، وشبكة ٢×٢ ثابتة */
        .print-codes .pages{display:flex;flex-direction:column;gap:16px;align-items:center;padding:16px 0}
        .print-codes .page{width:210mm;height:297mm;box-sizing:border-box;padding:8mm;background:#fff;box-shadow:0 2px 12px rgba(77,51,64,.12);display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr}
        .print-codes .cell{border:1px dashed #c9b6c0;padding:3mm;box-sizing:border-box;min-height:0;min-width:0}
        .print-codes .card{height:100%;box-sizing:border-box;border:3px double #7d5a6c;border-radius:14px;padding:4mm 5mm;display:flex;flex-direction:column;align-items:center;text-align:center;background:#fff;position:relative;overflow:hidden}
        .print-codes .card>*{flex-shrink:0}
        .print-codes .card::before,.print-codes .card::after{content:"❁";position:absolute;color:#c9a96a;font-size:14px}
        .print-codes .card::before{top:3mm;right:4mm}
        .print-codes .card::after{bottom:3mm;left:4mm}
        .print-codes .card img.logo{height:13mm}
        .print-codes .app{font-size:15px;font-weight:800;color:#5d3f4e;margin-top:2mm}
        .print-codes .brand{font-size:11px;color:#a8894f;font-weight:700;margin-top:0.5mm}
        .print-codes .rule{width:60%;height:2px;background:linear-gradient(90deg,transparent,#c9a96a,transparent);margin:2mm 0}
        .print-codes .name{font-size:20px;font-weight:800;color:#3a2a32;line-height:1.3;max-height:2.6em;overflow:hidden}
        .print-codes .halaqa{font-size:12px;color:#8b7a84;margin-top:1mm}
        .print-codes .qr{width:40mm;height:40mm;margin-top:2mm;border:1px solid #e8dfe4;border-radius:6px;padding:1.5mm;background:#fff;box-sizing:content-box}
        .print-codes .lbl{font-size:12px;color:#8b7a84;font-weight:700;margin-top:2mm}
        .print-codes .code{font-size:30px;font-weight:800;letter-spacing:0.22em;color:#5d3f4e;direction:ltr;line-height:1.15;background:#faf6f8;border-radius:10px;padding:1mm 4mm 1mm 6mm;margin-top:1mm}
        .print-codes .hint{font-size:10.5px;color:#6f5f68;margin-top:auto;padding-top:2mm;line-height:1.55}
        .print-codes .hint b{color:#5d3f4e;direction:ltr;unicode-bidi:embed}
        @media print{
          @page{size:A4 portrait;margin:10mm}
          html,body{background:#fff !important;margin:0;padding:0;height:auto}
          .print-codes{background:#fff;padding:0;min-height:0}
          .print-codes .bar{display:none}
          .print-codes .pages{display:block;padding:0;gap:0}
          /* الصفحة بعرض المساحة المتاحة (لا ٢١٠ ملم ثابتة) وارتفاع ٢٥٦ ملم:
             يتّسع لأي هوامش يفرضها المتصفح (كروم أو سفاري أو الجوال) فلا تفيض ورقة فارغة */
          .print-codes .page{width:100%;height:auto;padding:0;grid-template-rows:128mm 128mm;box-shadow:none;margin:0;overflow:hidden;break-inside:avoid;page-break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}
          .print-codes .page + .page{break-before:page;page-break-before:always}
          .print-codes .cell{padding:2mm}
          .print-codes .card{padding:3mm 4mm}
          .print-codes .card img.logo{height:11mm}
          .print-codes .rule{margin:1.5mm 0}
          .print-codes .name{font-size:19px}
          .print-codes .qr{width:34mm;height:34mm;margin-top:1.5mm}
          .print-codes .lbl{margin-top:1.5mm}
          .print-codes .code{font-size:28px}
          .print-codes .hint{padding-top:1.5mm}
        }
      `}</style>

      <div className="bar">
        <button type="button" className="back" onClick={back}>
          → رجوع
        </button>
        <span className="meta">
          {data.halaqaLabel} · {ar(data.rows.length)} بطاقة · {ar(pages.length)} صفحات
        </span>
        <button type="button" className="print" onClick={() => window.print()}>
          🖨️ طباعة
        </button>
      </div>

      <div className="pages">
        {pages.map((group, pi) => (
          <div key={pi} className="page">
            {group.map((r) => (
              <div key={r.code} className="cell">
                <div className="card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="logo" src="/logo.png" alt="" />
                  <div className="app">تطبيق الماهر</div>
                  <div className="brand">جمعية الماهر بالقرآن وعلومه</div>
                  <div className="rule" />
                  <div className="name">{r.name}</div>
                  <div className="halaqa">🕌 {data.halaqaLabel}</div>
                  {qrs[r.code] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="qr" src={qrs[r.code]} alt="" />
                  ) : (
                    <span className="qr" />
                  )}
                  <div className="lbl">رمز الدخول</div>
                  <div className="code">{r.code}</div>
                  <div className="hint">
                    امسحي الرمز بكاميرا الجوال فيدخلكِ التطبيق مباشرة
                    <br />
                    أو افتحي <b>{host}</b> وأدخلي رمزك
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}
