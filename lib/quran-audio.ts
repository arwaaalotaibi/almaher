import { SURAH_AYAHS } from "./surahs";

/** القرّاء المتاحون — تلاوة آية-آية. المصدر الأساسي مرآة everyayah السريعة (تسمح بالتحميل
    المسبق)، والاحتياطي cdn.islamic.network */
export const RECITERS = [
  { id: "ar.alafasy", bitrate: 128, folder: "Alafasy_128kbps", name: "مشاري العفاسي" },
  { id: "ar.husary", bitrate: 128, folder: "Husary_128kbps", name: "محمود الحصري" },
  { id: "ar.abdulbasitmurattal", bitrate: 192, folder: "Abdul_Basit_Murattal_192kbps", name: "عبد الباسط (مرتل)" },
  { id: "ar.minshawi", bitrate: 128, folder: "Minshawy_Murattal_128kbps", name: "محمد المنشاوي" },
  { id: "ar.hudhaify", bitrate: 128, folder: "Hudhaify_128kbps", name: "علي الحذيفي" },
] as const;
export type ReciterId = (typeof RECITERS)[number]["id"];

/** الرقم العالمي للآية (1..6236) من (سورة، آية) */
export function globalAyahNumber(surah: number, ayah: number): number {
  let n = 0;
  for (let s = 1; s < surah; s++) n += SURAH_AYAHS[s - 1];
  return n + ayah;
}

const pad3 = (n: number) => String(n).padStart(3, "0");
const reciterOf = (id: ReciterId) => RECITERS.find((x) => x.id === id) ?? RECITERS[0];

/** رابط صوت الآية — المرآة السريعة */
export function audioUrl(reciter: ReciterId, surah: number, ayah: number): string {
  return `https://mirrors.quranicaudio.com/everyayah/${reciterOf(reciter).folder}/${pad3(surah)}${pad3(ayah)}.mp3`;
}

/** رابط احتياطي إن تعذّرت المرآة */
export function audioUrlFallback(reciter: ReciterId, globalN: number): string {
  const r = reciterOf(reciter);
  return `https://cdn.islamic.network/quran/audio/${r.bitrate}/${r.id}/${globalN}.mp3`;
}

export interface WardAyah {
  surah: number; // رقم السورة
  ayah: number; // رقم الآية في سورتها
  n: number; // الرقم العالمي (للصوت)
  text: string;
}

type ApiAyah = { numberInSurah: number; number: number; text: string };

const surahCache = new Map<number, Promise<ApiAyah[]>>();
function fetchSurah(s: number): Promise<ApiAyah[]> {
  let p = surahCache.get(s);
  if (!p) {
    p = fetch(`https://api.alquran.cloud/v1/surah/${s}/quran-uthmani`)
      .then((res) => {
        if (!res.ok) throw new Error("audio-api");
        return res.json() as Promise<{ data?: { ayahs?: ApiAyah[] } }>;
      })
      .then((json) => json.data?.ayahs ?? []);
    p.catch(() => surahCache.delete(s));
    surahCache.set(s, p);
  }
  return p;
}

/** المصحف كاملاً بطلب واحد (~٤٠٠ ك.ب مضغوطاً) — للمقاطع الطويلة بدل عشرات الطلبات */
let wholeQuran: Promise<ApiAyah[][]> | null = null;
function fetchWholeQuran(): Promise<ApiAyah[][]> {
  if (!wholeQuran) {
    wholeQuran = fetch("https://api.alquran.cloud/v1/quran/quran-uthmani")
      .then((res) => {
        if (!res.ok) throw new Error("audio-api");
        return res.json() as Promise<{ data?: { surahs?: { number: number; ayahs: ApiAyah[] }[] } }>;
      })
      .then((json) => {
        const out: ApiAyah[][] = [];
        for (const su of json.data?.surahs ?? []) out[su.number - 1] = su.ayahs;
        return out;
      });
    wholeQuran.catch(() => {
      wholeQuran = null;
    });
  }
  return wholeQuran;
}

/** جلب نصوص آيات الورد (من إلى) — سورة أو بضع سور بطلب لكل سورة، وما زاد بطلب المصحف كاملاً */
export async function fetchWardAyahs(
  from: { surah: number; ayah: number },
  to: { surah: number; ayah: number }
): Promise<WardAyah[]> {
  const out: WardAyah[] = [];
  const many = to.surah - from.surah + 1 > 3;
  const all = many ? await fetchWholeQuran() : null;
  for (let s = from.surah; s <= to.surah; s++) {
    const ayahs = all ? (all[s - 1] ?? []) : await fetchSurah(s);
    const first = s === from.surah ? from.ayah : 1;
    const last = s === to.surah ? to.ayah : SURAH_AYAHS[s - 1];
    for (const a of ayahs) {
      if (a.numberInSurah < first || a.numberInSurah > last) continue;
      out.push({ surah: s, ayah: a.numberInSurah, n: a.number, text: a.text });
    }
  }
  return out;
}

/* ================== 📖 صفحة المصحف (مصحف المدينة) ==================
   الكلمات بخطوط مجمع الملك فهد (QPC V2) — لكل صفحة خطّها، وكل كلمة برقم سطرها،
   فتظهر الصفحة بسطورها الخمسة عشر كما في المصحف المطبوع. */

export interface MushafWord {
  code: string; // رمز الكلمة في خط الصفحة
  key: string; // «سورة:آية»
  end: boolean; // علامة رقم الآية
}
export interface MushafLine {
  n: number; // رقم السطر (١..١٥)
  kind: "words" | "header" | "basmala";
  surah?: number; // للعنوان والبسملة
  words: MushafWord[];
}

export const mushafFontFamily = (page: number) => `qpc-v2-p${page}`;
const fontUrl = (page: number) => `https://static.qurancdn.com/fonts/quran/hafs/v2/woff2/p${page}.woff2`;

const fontLoads = new Map<number, Promise<void>>();
/** تحميل خط الصفحة مرة واحدة */
export function loadMushafFont(page: number): Promise<void> {
  let p = fontLoads.get(page);
  if (!p) {
    const face = new FontFace(mushafFontFamily(page), `url(${fontUrl(page)})`, { display: "block" });
    p = face.load().then((f) => {
      document.fonts.add(f);
    });
    p.catch(() => fontLoads.delete(page));
    fontLoads.set(page, p);
  }
  return p;
}

const pageCache = new Map<number, Promise<MushafLine[]>>();
/** سطور صفحة المصحف (مع سطور عناوين السور والبسملة) */
export function fetchMushafPage(page: number): Promise<MushafLine[]> {
  let p = pageCache.get(page);
  if (!p) {
    p = (async () => {
      const res = await fetch(
        `https://api.quran.com/api/v4/verses/by_page/${page}?words=true&word_fields=code_v2,line_number,page_number&per_page=50`
      );
      if (!res.ok) throw new Error("mushaf-api");
      const json = (await res.json()) as {
        verses?: { verse_key: string; words: { code_v2: string; line_number: number; page_number: number; char_type_name: string }[] }[];
      };
      const byLine = new Map<number, MushafWord[]>();
      for (const v of json.verses ?? []) {
        for (const w of v.words) {
          if (w.page_number !== page) continue; // الواجهة قد تُلحق آيات من الصفحة التالية
          if (!byLine.has(w.line_number)) byLine.set(w.line_number, []);
          byLine.get(w.line_number)!.push({ code: w.code_v2, key: v.verse_key, end: w.char_type_name === "end" });
        }
      }
      const nums = [...byLine.keys()].sort((a, b) => a - b);
      if (!nums.length) return [];
      const maxLine = page <= 2 ? Math.max(...nums) : 15;
      const lines: MushafLine[] = [];
      // السطور الخالية = عنوان سورة (+ بسملة) قبل أول آية فيها
      const fillGap = (from: number, to: number, surah: number) => {
        const gap = to - from + 1;
        if (gap <= 0 || surah < 1 || surah > 114) return;
        // سطر واحد في أعلى الصفحة = بسملة سورة جاء عنوانها آخر الصفحة السابقة
        if (from === 1 && gap === 1 && page > 2 && surah !== 9) {
          lines.push({ n: 1, kind: "basmala", surah, words: [] });
          return;
        }
        const withBasmala = gap >= 2 && surah !== 1 && surah !== 9;
        for (let n = from; n <= to; n++) {
          const isHeader = n === (withBasmala ? to - 1 : to);
          if (n < (withBasmala ? to - 1 : to)) continue; // سطور زائدة نادرة: تُترك فارغة
          lines.push({ n, kind: isHeader ? "header" : "basmala", surah, words: [] });
        }
      };
      let prev = 0;
      for (const n of nums) {
        const words = byLine.get(n)!;
        if (n > prev + 1) {
          const [s, a] = words[0].key.split(":").map(Number);
          fillGap(prev + 1, n - 1, a === 1 ? s : 0);
        }
        lines.push({ n, kind: "words", words });
        prev = n;
      }
      if (prev < maxLine) {
        const last = byLine.get(prev)!;
        const [s] = last[last.length - 1].key.split(":").map(Number);
        fillGap(prev + 1, maxLine, s + 1);
      }
      return lines.sort((a, b) => a.n - b.n);
    })();
    p.catch(() => pageCache.delete(page));
    pageCache.set(page, p);
  }
  return p;
}

/* ================== 🔍 البحث في القرآن ==================
   نص إملائي بلا تشكيل (quran-simple-clean) يُجلب مرة عند أول بحث، ويُطبَّع
   مع كلمة البحث (الهمزات والألف المقصورة والتاء المربوطة) ليطابق ما تكتبه الطالبة. */

export interface SearchHit {
  surah: number;
  ayah: number;
  text: string;
}

export function normalizeArabic(s: string): string {
  return s
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, "") // تشكيل وعلامات وقف وتطويل
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

let searchIndex: Promise<{ surah: number; ayah: number; text: string; norm: string }[]> | null = null;
function loadSearchIndex() {
  if (!searchIndex) {
    searchIndex = fetch("https://api.alquran.cloud/v1/quran/quran-simple-clean")
      .then((res) => {
        if (!res.ok) throw new Error("search-api");
        return res.json() as Promise<{ data?: { surahs?: { number: number; ayahs: ApiAyah[] }[] } }>;
      })
      .then((json) => {
        const out: { surah: number; ayah: number; text: string; norm: string }[] = [];
        for (const su of json.data?.surahs ?? [])
          for (const a of su.ayahs) out.push({ surah: su.number, ayah: a.numberInSurah, text: a.text, norm: normalizeArabic(a.text) });
        return out;
      });
    searchIndex.catch(() => {
      searchIndex = null;
    });
  }
  return searchIndex;
}

/** آيات فيها الكلمة/العبارة (أول limit نتيجة) والعدد الكلي */
export async function searchQuran(q: string, limit = 40): Promise<{ hits: SearchHit[]; total: number }> {
  const nq = normalizeArabic(q);
  if (nq.length < 2) return { hits: [], total: 0 };
  const idx = await loadSearchIndex();
  const hits: SearchHit[] = [];
  let total = 0;
  for (const a of idx) {
    if (!a.norm.includes(nq)) continue;
    total++;
    if (hits.length < limit) hits.push({ surah: a.surah, ayah: a.ayah, text: a.text });
  }
  return { hits, total };
}
