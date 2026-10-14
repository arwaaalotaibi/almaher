import { PAGE_STARTS } from "./mushaf-data";

/** 📖 صفحات المصحف المعروض في مسمّعي (خطوط مجمع الملك فهد QPC V2، طبعة ١٤٤١) —
    تختلف بداية ٢٥ صفحة فيه عن جدول الصفحات PAGE_STARTS الذي تُحسب به الخطط والأوجه،
    فتُستعمل هذه للعرض فقط (أي صفحة تُفتح لآية) حتى تظهر الآية الحالية في صفحتها.
    مستخرجة من page_number لكل كلمة في api.quran.com ومتحقَّق منها على الصفحات ٦٠٤. */
const OVERRIDES: Record<number, [number, number]> = {
  121: [5, 78],
  122: [5, 84],
  123: [5, 91],
  145: [6, 131],
  532: [55, 19],
  533: [55, 42],
  534: [55, 70],
  565: [68, 17],
  568: [69, 36],
  570: [70, 41],
  576: [74, 19],
  584: [79, 17],
  586: [80, 41],
  588: [83, 5],
  589: [83, 34],
  590: [84, 25],
  592: [87, 11],
  593: [88, 23],
  594: [89, 23],
  595: [90, 19],
  596: [92, 10],
  597: [94, 3],
  598: [96, 13],
  599: [98, 6],
  600: [100, 6],
};

const STARTS: [number, number][] = PAGE_STARTS.map((s, i) => OVERRIDES[i + 1] ?? [s[0], s[1]]);

/** الصفحة المعروضة التي تبدأ فيها الآية */
export function displayPageOf(surah: number, ayah: number): number {
  if (surah < 1) return 1;
  let p = 1;
  for (let i = 0; i < STARTS.length; i++) {
    const [s, a] = STARTS[i];
    if (s < surah || (s === surah && a <= ayah)) p = i + 1;
    else break;
  }
  return p;
}

/** أول آية تبدأ في الصفحة المعروضة */
export function displayPageStart(page: number): { surah: number; ayah: number } {
  const p = Math.min(Math.max(1, Math.floor(Number.isFinite(page) ? page : 1)), STARTS.length);
  const [surah, ayah] = STARTS[p - 1];
  return { surah, ayah };
}
