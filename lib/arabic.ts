const ar = (n: number) => n.toLocaleString("ar-EG");

/** صيغة عربية سليمة للمعدود: مفرد / مثنى / جمع (٣–١٠) / تمييز مفرد (١١+) */
export function countLabel(
  n: number,
  forms: { one: string; two: string; few: string; many: string }
): string {
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  if (n >= 3 && n <= 10) return `${ar(n)} ${forms.few}`;
  return `${ar(n)} ${forms.many}`;
}

/** أوجه: «وجه واحد، وجهين، ٣ أوجه، ١١ وجهاً» */
export const facesLabel = (n: number) =>
  countLabel(n, { one: "وجه واحد", two: "وجهين", few: "أوجه", many: "وجهاً" });

/** أوجه بعد فعل (نصب): «زدتِ وجهاً، وجهين، ٣ أوجه…» */
export const facesAcc = (n: number) =>
  countLabel(n, { one: "وجهاً", two: "وجهين", few: "أوجه", many: "وجهاً" });

/** أوجه بعد «ناقص/باقي»: «ناقص وجه، وجهين، ٣ أوجه…» */
export const facesPlain = (n: number) =>
  countLabel(n, { one: "وجه", two: "وجهين", few: "أوجه", many: "وجهاً" });

/** لقاءات: «لقاء واحد، لقاءين، ٣ لقاءات، ١١ لقاءً» */
export const meetingsLabel = (n: number) =>
  countLabel(n, { one: "لقاء واحد", two: "لقاءين", few: "لقاءات", many: "لقاءً" });

/** صفحات مجرورة بالباء: «بصفحة واحدة، بصفحتين، بـ٣ صفحات، بـ١١ صفحة» */
export const byPages = (n: number) =>
  n === 1
    ? "بصفحة واحدة"
    : n === 2
      ? "بصفحتين"
      : n <= 10
        ? `بـ${ar(n)} صفحات`
        : `بـ${ar(n)} صفحة`;
