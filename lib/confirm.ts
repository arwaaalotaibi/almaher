/** تأكيد الإجراءات الخطرة: لا يكفي «موافق» — يجب كتابة كلمة التأكيد بالضبط،
    حتى لا تُحذف بيانات بضغطة عابرة. */
export function confirmDanger(what: string, word = "حذف"): boolean {
  if (typeof window === "undefined") return false;
  const typed = window.prompt(
    `⚠️ ${what}\n\nهذا الإجراء لا يمكن التراجع عنه.\nللتأكيد اكتبي كلمة «${word}» ثم اضغطي موافق:`
  );
  if (typed === null) return false;
  // تسامح مع الفراغات والتشكيل والهمزات
  const norm = (s: string) =>
    s.replace(/[\sً-ْ]/g, "").replace(/[أإآ]/g, "ا");
  if (norm(typed) !== norm(word)) {
    window.alert("لم تُكتب كلمة التأكيد بشكل صحيح — لم يُنفَّذ أي شيء.");
    return false;
  }
  return true;
}
