import { formatSchedDate, type ScheduleRow } from "./store";

const ar = (n: number) => n.toLocaleString("ar-EG");

/** يفتح صفحة طباعة كلاسيكية لجدول الحفظ */
export function printHifzSchedule(opts: {
  studentName: string;
  halaqaLabel: string;
  startLabel: string;
  schedule: ScheduleRow[];
}) {
  const { studentName, halaqaLabel, startLabel, schedule } = opts;
  const w = window.open("", "_blank");
  if (!w) return;
  const dash = "–";
  const rows = schedule
    .map(
      (s) =>
        `<tr><td class="num">${ar(s.n)}</td><td>${formatSchedDate(
          s.date
        )}</td><td class="seg">${
          s.hifzLabel || (s.hifz ? `${ar(s.hifz)} أوجه` : dash)
        }</td><td class="seg">${
          s.murajaahLabel || (s.murajaah ? `${ar(s.murajaah)} أوجه` : dash)
        }</td></tr>`
    )
    .join("");
  w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<title>جدول حفظ — ${studentName}</title>
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
      <div class="name">الطالبة: ${studentName || ""}</div>
      <div class="assoc">جمعية الماهر بالقرآن وعلومه</div>
    </div>
    <div class="rule"></div>
    <div class="info">
      <b>الحلقة:</b> ${halaqaLabel}${
        startLabel ? `&nbsp;&nbsp;•&nbsp;&nbsp;<b>بداية الحفظ:</b> ${startLabel}` : ""
      }<br/>
      <b>عدد اللقاءات:</b> ${ar(schedule.length)}
    </div>
    <table>
      <thead><tr><th>اللقاء</th><th>التاريخ</th><th>الحفظ الجديد</th><th>المراجعة</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="foot">جمعية الماهر بالقرآن وعلومه</div>
  </div>
  <script>window.onload=function(){setTimeout(function(){window.print()},400)}</script>
</body></html>`);
  w.document.close();
}
