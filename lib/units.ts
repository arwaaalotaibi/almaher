/** 📏 وحدات خطة الطالبة: وجه (الافتراضي) · سطر · ربع حزب · حزب.
    السجلات تُخزَّن دائماً من آية إلى آية، والوحدة طريقة قياس فقط:
    - الوجه: كما هو (lib/faces) دون أي تغيير.
    - السطر: أسطر الآيات في مصحف المدينة (بلا عناوين السور والبسملة).
    - الربع: نصيب المقطع من كل ربع حزب بأسطره (ربع كامل = ١)، والحزب = ٤ أرباع.
    والمطلوب يُبنى بالطريقة نفسها: نمشي آيةً آية على المسار حتى يكتمل المقدار. */

import { advanceByFaces, facesText, roundQuarter, stepPos, type PathMode, type Pos } from "./faces";
import { AYAH_LINE_END_HEX } from "./quran-lines";
import { facesLabel } from "./arabic";
import { RUB_STARTS } from "./quran-rub";
import { SURAH_AYAHS } from "./surahs";

export type PlanUnit = "face" | "line" | "rub" | "hizb";
export const PLAN_UNITS: { key: PlanUnit; label: string }[] = [
  { key: "face", label: "وجه" },
  { key: "line", label: "سطر" },
  { key: "rub", label: "ربع" },
  { key: "hizb", label: "حزب" },
];
export const unitOf = (u?: string): PlanUnit => (u === "line" || u === "rub" || u === "hizb" ? u : "face");

/* ===== جداول (تُبنى مرة واحدة عند أول استعمال) ===== */
const SURAH_OFFSET: number[] = []; // رقم أول آية في كل سورة (عالمياً، 0-based)
{
  let n = 0;
  for (const c of SURAH_AYAHS) {
    SURAH_OFFSET.push(n);
    n += c;
  }
}
const gIndex = (p: Pos) => SURAH_OFFSET[p.surah - 1] + p.ayah - 1; // 0..6235

let rubMark: Uint8Array | null = null; // ١ = الآية تبدأ ربعاً (علامة ۞)
let lineCost: Float64Array | null = null; // أسطر كل آية = سطر نهايتها − سطر نهاية ما قبلها
let rubCost: Float64Array | null = null; // نصيب كل آية من ربعها (مجموع الربع = ١)
function tables() {
  if (lineCost && rubCost && rubMark) return { lineCost, rubCost, rubMark };
  const ends = AYAH_LINE_END_HEX.split(",").map((h) => parseInt(h, 16));
  lineCost = new Float64Array(ends.length);
  for (let i = 0; i < ends.length; i++) lineCost[i] = i === 0 ? ends[0] : ends[i] - ends[i - 1];
  // الأرباع: حدود كل ربع بالفهرس العالمي
  const starts = RUB_STARTS.map(([s, a]) => gIndex({ surah: s, ayah: a }));
  rubCost = new Float64Array(ends.length);
  rubMark = new Uint8Array(ends.length);
  for (const i of starts) rubMark[i] = 1;
  for (let r = 0; r < starts.length; r++) {
    const a = starts[r];
    const b = r + 1 < starts.length ? starts[r + 1] : ends.length;
    let total = 0;
    for (let i = a; i < b; i++) total += lineCost[i];
    for (let i = a; i < b; i++) rubCost[i] = total > 0 ? lineCost[i] / total : 1 / (b - a);
  }
  return { lineCost, rubCost, rubMark };
}

/** مقدار آية واحدة بالوحدة (غير الوجه) */
function ayahCost(p: Pos, unit: Exclude<PlanUnit, "face">): number {
  const t = tables();
  const i = gIndex(p);
  if (unit === "line") return t.lineCost[i];
  if (unit === "rub") return t.rubCost[i];
  return t.rubCost[i] / 4;
}

/** الموضع الذي يكتمل عنده مقدار qty بالوحدة ابتداءً من موضع على المسار — كـ advanceByFaces.
    وفي السطر: تُضمّ الآيات القصيرة التي تنتهي في السطر الأخير نفسه */
export function advanceByUnit(
  from: Pos,
  qty: number,
  unit: PlanUnit,
  mode: PathMode
): { end: Pos; next: Pos | null; qty: number } {
  if (unit === "face") {
    const r = advanceByFaces(from, qty, mode);
    return { end: r.end, next: r.next, qty: r.faces };
  }
  if (unit === "rub") return advanceByMarks(from, qty, mode);
  if (unit === "hizb") {
    const r = advanceByMarks(from, qty * 4, mode);
    return { ...r, qty: roundQuarter(r.qty / 4) };
  }
  const target = Math.max(0, qty) - 1e-6;
  let cur: Pos | null = from;
  let acc = 0;
  let end: Pos = from;
  let guard = 0;
  while (cur && guard++ < 7000) {
    acc += ayahCost(cur, unit);
    end = cur;
    if (acc >= target) break;
    cur = stepPos(cur, mode);
  }
  // آيات تنتهي في السطر نفسه (كلفتها صفر) تُكمل السطر
  let nx = stepPos(end, mode);
  while (nx && ayahCost(nx, unit) === 0 && guard++ < 7000) {
    end = nx;
    nx = stepPos(end, mode);
  }
  return { end, next: nx, qty: roundQuarter(acc) };
}

/** الأرباع كما تعدّها المعلّمة في المصحف: «ربعان» = حتى علامة الربع الثانية ۞ بعد موضعها
    (وإن بدأت من وسط ربع فالأول حتى أول علامة). وكسر الربع (نصف ربع…) بنصيبه من الأسطر */
function advanceByMarks(from: Pos, rubs: number, mode: PathMode): { end: Pos; next: Pos | null; qty: number } {
  const t = tables();
  const whole = Math.floor(rubs + 1e-9);
  const frac = rubs - whole;
  let end = from;
  let cur: Pos | null = from;
  let marks = 0;
  let acc = 0; // للكسر بعد آخر علامة
  let guard = 0;
  // المرور على العلامات الكاملة
  if (whole > 0) {
    let nx = stepPos(cur, mode);
    while (nx && guard++ < 7000) {
      if (t.rubMark[gIndex(nx)]) {
        marks++;
        if (marks >= whole) break;
      }
      end = nx;
      nx = stepPos(nx, mode);
    }
    if (frac <= 1e-9) return { end, next: nx, qty: whole };
    cur = nx;
    if (!cur) return { end, next: null, qty: whole };
  }
  // كسر الربع المتبقي
  while (cur && guard++ < 7000) {
    acc += t.rubCost[gIndex(cur)];
    end = cur;
    if (acc >= frac - 1e-6) break;
    cur = stepPos(cur, mode);
  }
  return { end, next: stepPos(end, mode), qty: roundQuarter(whole + acc) };
}

/** مقدار مقطع (من آية إلى آية على المسار) بالوحدة */
export function measureRange(from: Pos, to: Pos, unit: Exclude<PlanUnit, "face">, mode: PathMode): number {
  let cur: Pos | null = from;
  let acc = 0;
  let guard = 0;
  while (cur && guard++ < 7000) {
    acc += ayahCost(cur, unit);
    if (cur.surah === to.surah && cur.ayah === to.ayah) break;
    cur = stepPos(cur, mode);
  }
  return roundQuarter(acc);
}

/* ===== الصياغة ===== */
const arNum = (n: number) => n.toLocaleString("ar-EG");
const FORMS: Record<Exclude<PlanUnit, "face">, { one: string; two: string; few: string; many: string }> = {
  line: { one: "سطر", two: "سطران", few: "أسطر", many: "سطراً" },
  rub: { one: "ربع", two: "ربعان", few: "أرباع", many: "ربعاً" },
  hizb: { one: "حزب", two: "حزبان", few: "أحزاب", many: "حزباً" },
};

/** «٥ أسطر»، «ربعان»، «حزب ونصف»، «وجهان» … */
export function unitText(qty: number, unit: PlanUnit): string {
  if (unit === "face") return facesText(qty);
  const f = FORMS[unit];
  const q = roundQuarter(Math.max(0, qty));
  const whole = Math.floor(q);
  const frac = { "0.25": "ربع", "0.5": "نصف", "0.75": "ثلاثة أرباع" }[String(q - whole)] ?? "";
  if (whole === 0) return frac ? `${frac} ${f.one}` : `٠ ${f.one}`;
  const base = whole === 1 ? f.one : whole === 2 ? f.two : whole <= 10 ? `${arNum(whole)} ${f.few}` : `${arNum(whole)} ${f.many}`;
  return frac ? `${base} و${frac}` : base;
}

/** مقدار للعرض: الأوجه بصيغتها المعتادة («وجهين»)، وغيرها بوحدتها («٥ أسطر») */
export function amountLabel(qty: number, unit: PlanUnit = "face"): string {
  return unit === "face" ? facesLabel(qty) : unitText(qty, unit);
}
