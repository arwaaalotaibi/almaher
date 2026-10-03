/* ================== 🔗 تلاوة متصلة في ملف واحد ==================
   الآيفون يوقف التطبيق عن بدء ملف صوت جديد والشاشة مقفلة، فكانت التلاوة تقف بعد
   الآية الحالية. الحل: نجمع آيات الورد (بتكرارها وربطها وصمت «ردّدي بعدي») في ملف
   MP3 واحد متصل يُشغَّل دون تدخّل، ونعرف الآية الجارية من موضع التشغيل.

   ملفات القرّاء كلها MPEG-1 Layer III بتردد 44.1kHz وبمعدّل ثابت، فيكفي ضمّ
   «إطاراتها» بعد إزالة وسوم ID3 وإطار Xing/Info (الذي يُفسد حساب المدة). */

import { audioUrl, type ReciterId, type WardAyah } from "./quran-audio";

const SAMPLES_PER_FRAME = 1152;
const BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const RATES = [44100, 48000, 32000];

export interface Seg {
  frames: Uint8Array; // إطارات الصوت فقط
  dur: number; // بالثواني
  header: Uint8Array; // ترويسة أول إطار (لصنع إطارات صمت مطابقة)
}

function frameLen(b: Uint8Array, i: number): number {
  if (b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) return 0;
  const ver = (b[i + 1] >> 3) & 3;
  const layer = (b[i + 1] >> 1) & 3;
  if (ver !== 3 || layer !== 1) return 0; // MPEG-1 Layer III فقط
  const br = BITRATES[b[i + 2] >> 4];
  const sr = RATES[(b[i + 2] >> 2) & 3];
  if (!br || !sr) return 0;
  const pad = (b[i + 2] >> 1) & 1;
  return Math.floor((144000 * br) / sr) + pad;
}

/** إطارات MP3 ومدّتها من ملف كامل */
export function parseMp3(buf: ArrayBuffer): Seg {
  const b = new Uint8Array(buf);
  let i = 0;
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) {
    i = 10 + ((b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9]);
  }
  let end = b.length;
  if (end > 128 && b[end - 128] === 0x54 && b[end - 127] === 0x41 && b[end - 126] === 0x47) end -= 128; // TAG
  while (i < end - 4 && !frameLen(b, i)) i++;
  const start = i;
  const header = b.slice(start, start + 4);
  // إطار Xing/Info/VBRI في البداية لا صوت فيه — نتخطّاه
  const firstLen = frameLen(b, start);
  const probe = String.fromCharCode(...b.slice(start + 4, Math.min(start + firstLen, start + 60)));
  let from = start;
  if (/Xing|Info|VBRI/.test(probe)) from = start + firstLen;
  let n = 0;
  let j = from;
  while (j < end - 4) {
    const L = frameLen(b, j);
    if (!L || j + L > end) break;
    n++;
    j += L;
  }
  const sr = RATES[(header[2] >> 2) & 3] || 44100;
  return { frames: b.slice(from, j), dur: (n * SAMPLES_PER_FRAME) / sr, header };
}

/** صمت بمدة معيّنة: إطارات بترويسة القارئ نفسها ومحتوى صفري (يُفكّ صمتاً) */
export function silence(header: Uint8Array, seconds: number): Seg {
  const h = header.slice();
  h[2] &= ~0x02; // بلا حشو
  h[1] |= 0x01; // بلا CRC
  const L = frameLen(h, 0);
  const sr = RATES[(h[2] >> 2) & 3] || 44100;
  const count = Math.max(1, Math.ceil((seconds * sr) / SAMPLES_PER_FRAME));
  const out = new Uint8Array(L * count);
  for (let k = 0; k < count; k++) out.set(h, k * L);
  return { frames: out, dur: (count * SAMPLES_PER_FRAME) / sr, header };
}

const segCache = new Map<string, Promise<Seg>>();
/** صوت آية مُحلَّلاً (يُخزَّن) */
export function loadSeg(reciter: ReciterId, a: WardAyah): Promise<Seg> {
  const k = `${reciter}:${a.n}`;
  let p = segCache.get(k);
  if (!p) {
    p = fetch(audioUrl(reciter, a.surah, a.ayah))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("audio"))))
      .then(parseMp3);
    p.catch(() => segCache.delete(k));
    segCache.set(k, p);
  }
  return p;
}

/* ---------- خطة التلاوة ---------- */

export type StepKind = "new" | "link" | "silence";
export interface Step {
  i: number; // فهرس الآية في الورد (للصمت: الآية التي قبله)
  kind: StepKind;
  link: boolean; // ضمن مرحلة الربط (للصمت أيضاً)
  head: number; // الآية الجديدة الجارية
  rep: number; // رقم التكرار (للجديدة)
  loop: number; // دورة الورد
  t0: number;
  t1: number;
}

export interface PlanOpts {
  len: number; // عدد آيات الورد
  head: number; // نبدأ من هذه الآية (جديدة، التكرار الأول)
  loopNo: number; // الدورة الحالية
  perAyah: number;
  mode: "each" | "link";
  linkMax: number;
  echo: boolean;
  loops: number; // 0 = بلا توقف
}

export const FIT_ALL = 30; // ورد بهذا الطول أو أقل يُجهَّز كاملاً (مع دوراته)
const WINDOW_EACH = 30;
const WINDOW_LINK = 12;
const ENDLESS_PASSES = 3; // «بلا توقف»: دورات تُجهَّز مسبقاً، ثم يُعاد التجهيز

/** تسلسل خطوات (بلا أزمنة) من head، ونهاية النافذة، وهل هي آخر الورد */
export function planSteps(o: PlanOpts): { steps: Omit<Step, "t0" | "t1">[]; lastHead: number; complete: boolean } {
  const fits = o.len <= FIT_ALL;
  const win = o.mode === "link" ? WINDOW_LINK : WINDOW_EACH;
  const steps: Omit<Step, "t0" | "t1">[] = [];
  const pass = (from: number, to: number, loop: number) => {
    for (let h = from; h <= to; h++) {
      for (let r = 0; r < o.perAyah; r++) {
        steps.push({ i: h, kind: "new", link: false, head: h, rep: r, loop });
        if (o.echo) steps.push({ i: h, kind: "silence", link: false, head: h, rep: r, loop });
      }
      if (o.mode === "link") {
        const base = Math.max(0, h - (o.linkMax - 1));
        if (h > base)
          for (let j = base; j <= h; j++) {
            steps.push({ i: j, kind: "link", link: true, head: h, rep: 0, loop });
            if (o.echo) steps.push({ i: j, kind: "silence", link: true, head: h, rep: 0, loop });
          }
      }
    }
  };
  if (fits) {
    pass(o.head, o.len - 1, o.loopNo);
    const extra = o.loops === 0 ? ENDLESS_PASSES : Math.max(0, o.loops - o.loopNo - 1);
    for (let l = 1; l <= extra; l++) pass(0, o.len - 1, o.loopNo + l);
    return { steps, lastHead: o.len - 1, complete: o.loops !== 0 };
  }
  const to = Math.min(o.len - 1, o.head + win - 1);
  pass(o.head, to, o.loopNo);
  return { steps, lastHead: to, complete: to >= o.len - 1 && o.loops !== 0 && o.loopNo + 1 >= o.loops };
}

/** يجهّز ملف التلاوة المتصل: يجلب أصوات الآيات اللازمة ويضمّها مع الصمت */
export async function buildTrack(
  reciter: ReciterId,
  ayahs: WardAyah[],
  o: PlanOpts
): Promise<{ url: string; steps: Step[]; lastHead: number; complete: boolean; total: number }> {
  const plan = planSteps(o);
  const need = [...new Set(plan.steps.map((s) => s.i))];
  const segs = new Map<number, Seg>();
  // جلب متوازٍ محدود
  let k = 0;
  await Promise.all(
    Array.from({ length: Math.min(6, need.length) }, async () => {
      while (k < need.length) {
        const i = need[k++];
        segs.set(i, await loadSeg(reciter, ayahs[i]));
      }
    })
  );
  const parts: Uint8Array[] = [];
  const steps: Step[] = [];
  let t = 0;
  for (const s of plan.steps) {
    const seg = segs.get(s.i)!;
    const piece = s.kind === "silence" ? silence(seg.header, Math.max(1.5, seg.dur)) : seg;
    parts.push(piece.frames);
    steps.push({ ...s, t0: t, t1: t + piece.dur });
    t += piece.dur;
  }
  const url = URL.createObjectURL(new Blob(parts as BlobPart[], { type: "audio/mpeg" }));
  return { url, steps, lastHead: plan.lastHead, complete: plan.complete, total: t };
}

/** الخطوة الجارية عند زمن معيّن */
export function stepAt(steps: Step[], t: number): number {
  let lo = 0;
  let hi = steps.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (steps[mid].t0 <= t + 0.01) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
