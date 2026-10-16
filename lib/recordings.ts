/** 🎙️ تسجيلات الطالبة في مسمّعي — تُحفظ في جهازها فقط (IndexedDB) ولا تُرسل لأحد */

export interface Recording {
  id: string;
  owner: string; // الطالبة على هذا الجهاز
  label: string; // المقطع: «البقرة ٣٠ ← البقرة ٤٨»
  createdAt: number;
  duration: number; // ثوانٍ
  type: string; // نوع الملف الصوتي
  blob: Blob;
}

const DB = "almaher-recordings";
const STORE = "recs";
const KEEP = 30; // أقصى عدد تسجيلات لكل طالبة — يُحذف الأقدم

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const s = req.result.createObjectStore(STORE, { keyPath: "id" });
      s.createIndex("owner", "owner");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function recordingOwner(): string {
  try {
    return window.localStorage.getItem("almaher-my-student-id") || "me";
  } catch {
    return "me";
  }
}

export async function listRecordings(owner: string): Promise<Recording[]> {
  const db = await open();
  const all = await done(db.transaction(STORE).objectStore(STORE).index("owner").getAll(owner) as IDBRequest<Recording[]>);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function addRecording(rec: Recording): Promise<void> {
  const db = await open();
  await done(db.transaction(STORE, "readwrite").objectStore(STORE).put(rec));
  // الأقدم فوق الحدّ يُحذف حتى لا يمتلئ الجهاز
  const all = await listRecordings(rec.owner);
  for (const old of all.slice(KEEP)) await deleteRecording(old.id);
}

export async function deleteRecording(id: string): Promise<void> {
  const db = await open();
  await done(db.transaction(STORE, "readwrite").objectStore(STORE).delete(id));
}
