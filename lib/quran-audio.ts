import { SURAH_AYAHS } from "./surahs";

/** القرّاء المتاحون (تلاوة آية-آية من cdn.islamic.network) */
export const RECITERS = [
  { id: "ar.alafasy", bitrate: 128, name: "مشاري العفاسي" },
  { id: "ar.husary", bitrate: 128, name: "محمود الحصري" },
  { id: "ar.abdulbasitmurattal", bitrate: 192, name: "عبد الباسط (مرتل)" },
  { id: "ar.minshawi", bitrate: 128, name: "محمد المنشاوي" },
  { id: "ar.hudhaify", bitrate: 128, name: "علي الحذيفي" },
] as const;
export type ReciterId = (typeof RECITERS)[number]["id"];

/** الرقم العالمي للآية (1..6236) من (سورة، آية) */
export function globalAyahNumber(surah: number, ayah: number): number {
  let n = 0;
  for (let s = 1; s < surah; s++) n += SURAH_AYAHS[s - 1];
  return n + ayah;
}

export function audioUrl(reciter: ReciterId, globalN: number): string {
  const r = RECITERS.find((x) => x.id === reciter) ?? RECITERS[0];
  return `https://cdn.islamic.network/quran/audio/${r.bitrate}/${r.id}/${globalN}.mp3`;
}

export interface WardAyah {
  surah: number; // رقم السورة
  ayah: number; // رقم الآية في سورتها
  n: number; // الرقم العالمي (للصوت)
  text: string;
}

/** جلب نصوص آيات الورد (من إلى) — سورة واحدة أو أكثر، بطلب واحد لكل سورة */
export async function fetchWardAyahs(
  from: { surah: number; ayah: number },
  to: { surah: number; ayah: number }
): Promise<WardAyah[]> {
  const out: WardAyah[] = [];
  for (let s = from.surah; s <= to.surah; s++) {
    const res = await fetch(
      `https://api.alquran.cloud/v1/surah/${s}/quran-uthmani`
    );
    if (!res.ok) throw new Error("audio-api");
    const json = (await res.json()) as {
      data?: { ayahs?: { numberInSurah: number; number: number; text: string }[] };
    };
    const ayahs = json.data?.ayahs ?? [];
    const first = s === from.surah ? from.ayah : 1;
    const last = s === to.surah ? to.ayah : SURAH_AYAHS[s - 1];
    for (const a of ayahs) {
      if (a.numberInSurah < first || a.numberInSurah > last) continue;
      out.push({ surah: s, ayah: a.numberInSurah, n: a.number, text: a.text });
    }
  }
  return out;
}
