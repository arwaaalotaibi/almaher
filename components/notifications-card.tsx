"use client";

import { useEffect, useMemo, useState } from "react";
import {
  actions,
  Announcement,
  formatNotifDate,
  getReadIds,
  groupByDate,
  halaqaTitle,
  markNotifsRead,
  notifTypeMeta,
  pinnedAnnouncement,
  SmartNotif,
  useApp,
  visibleAnnouncements,
} from "@/lib/store";

const ar = (n: number) => n.toLocaleString("ar-EG");

/** بطاقة إشعار واحدة — بلون نوعها، وعلامة «جديد» إن كانت غير مقروءة */
function NotifItem({
  n,
  isNew,
  halaqaLabel,
}: {
  n: Announcement;
  isNew: boolean;
  halaqaLabel: string;
}) {
  const meta = notifTypeMeta(n.type);
  return (
    <div
      className={`rounded-xl border-s-4 px-3 py-2.5 ${
        isNew ? meta.cls : "border-cream-dark bg-cream/40"
      }`}
    >
      <div className="mb-0.5 flex items-center gap-1.5">
        <span className="text-sm">{meta.icon}</span>
        <span className="text-[11px] font-bold text-plum-700">{meta.label}</span>
        {isNew && (
          <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
            جديد
          </span>
        )}
      </div>
      <p className="whitespace-pre-wrap text-sm text-ink">{n.body}</p>
      <p className="mt-1 text-[11px] font-bold text-silver-600">
        {formatNotifDate(n.createdAt)} · {halaqaLabel}
      </p>
    </div>
  );
}

/** بانر الإشعار المثبّت على الواجهة (يحدّده الإداري) — يظهر واحد فقط */
export function PinnedNotice({
  halaqaIds,
  onOpen,
}: {
  halaqaIds: string[];
  onOpen?: () => void;
}) {
  const { announcements } = useApp();
  const pinned = useMemo(
    () => pinnedAnnouncement(announcements, halaqaIds),
    [announcements, halaqaIds]
  );
  if (!pinned) return null;
  const meta = notifTypeMeta(pinned.type);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`mb-5 block w-full rounded-2xl border-s-4 p-4 text-start transition active:scale-[0.99] ${meta.cls}`}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <span>📌</span>
        <span className="font-kufi text-sm font-bold text-plum-800">
          {meta.icon} {meta.label}
        </span>
      </div>
      <p className="whitespace-pre-wrap text-sm font-medium text-ink">
        {pinned.body}
      </p>
      <p className="mt-1.5 text-[11px] font-bold text-silver-600">
        {formatNotifDate(pinned.createdAt)}
      </p>
    </button>
  );
}

/** تذكير ذكي واحد */
function SmartItem({ s, isNew }: { s: SmartNotif; isNew: boolean }) {
  const meta = notifTypeMeta(s.type);
  return (
    <div
      className={`rounded-xl border-s-4 px-3 py-2.5 ${
        isNew ? meta.cls : "border-cream-dark bg-cream/40"
      }`}
    >
      <div className="mb-0.5 flex items-center gap-1.5">
        <span className="text-sm">{s.icon}</span>
        <span className="font-kufi text-sm font-bold text-plum-800">
          {s.title}
        </span>
      </div>
      <p className="whitespace-pre-wrap text-sm text-ink">{s.body}</p>
    </div>
  );
}

/** مركز الإشعارات — تذكيراتك الذكية + أرشيف إشعارات الإدارة بالتاريخ */
export function NotificationsCenter({
  halaqaIds,
  smart = [],
  studentId,
  onRead,
}: {
  halaqaIds: string[];
  smart?: SmartNotif[];
  studentId?: string;
  onRead?: () => void;
}) {
  const { announcements, halaqas } = useApp();
  const list = useMemo(
    () => visibleAnnouncements(announcements, halaqaIds),
    [announcements, halaqaIds]
  );

  // لقطة «المقروء» عند الفتح لتثبيت وسم «جديد»، ثم نعلّم الكل كمقروء
  const [readSnap, setReadSnap] = useState<Set<string>>(new Set());
  useEffect(() => {
    setReadSnap(getReadIds());
    const t = setTimeout(() => {
      markNotifsRead([...list.map((n) => n.id), ...smart.map((s) => s.id)]);
      // إيصال القراءة للإدارة (إشعارات الإدارة فقط)
      if (studentId) actions.recordNotifRead(studentId, list.map((n) => n.id));
      onRead?.();
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length, smart.length]);

  const groups = useMemo(() => groupByDate(list), [list]);

  if (list.length === 0 && smart.length === 0) {
    return (
      <div className="card rounded-2xl p-8 text-center">
        <p className="text-3xl">🔔</p>
        <p className="mt-2 font-kufi font-bold text-plum-800">لا إشعارات بعد</p>
        <p className="mt-1 text-sm text-silver-600">
          ستظهر هنا تذكيراتك وإشعارات الإدارة أولاً بأول
        </p>
      </div>
    );
  }

  const label = (n: Announcement) => {
    const h = halaqas.find((x) => x.id === n.halaqaId);
    return h ? halaqaTitle(h) : "للجميع";
  };

  return (
    <div className="grid gap-4">
      {smart.length > 0 && (
        <section>
          <h3 className="mb-2 font-kufi text-sm font-bold text-plum-600">
            🔔 تذكيراتك
          </h3>
          <div className="grid gap-2">
            {smart.map((s) => (
              <SmartItem key={s.id} s={s} isNew={!readSnap.has(s.id)} />
            ))}
          </div>
        </section>
      )}
      {groups.map((g) => (
        <section key={g.label}>
          <h3 className="mb-2 font-kufi text-sm font-bold text-plum-600">
            {g.label}
          </h3>
          <div className="grid gap-2">
            {g.items.map((n) => (
              <NotifItem
                key={n.id}
                n={n}
                isNew={!readSnap.has(n.id)}
                halaqaLabel={label(n)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** بطاقة مدمجة (للمعلّمة): المثبّت + أحدث الإشعارات */
export function NotificationsCard({ halaqaIds }: { halaqaIds: string[] }) {
  const { announcements, halaqas } = useApp();
  const list = useMemo(
    () => visibleAnnouncements(announcements, halaqaIds),
    [announcements, halaqaIds]
  );

  const [readSnap, setReadSnap] = useState<Set<string>>(new Set());
  useEffect(() => {
    setReadSnap(getReadIds());
    const t = setTimeout(() => markNotifsRead(list.map((n) => n.id)), 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length]);

  if (list.length === 0) return null;
  const unread = list.filter((n) => !readSnap.has(n.id)).length;

  return (
    <section className="card mb-5 rounded-2xl p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="font-kufi text-base font-bold text-plum-800">
          📢 إشعارات الإدارة
        </span>
        {unread > 0 && (
          <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
            {ar(unread)} جديد
          </span>
        )}
      </div>
      <div className="grid gap-2">
        {list.slice(0, 6).map((n) => {
          const h = halaqas.find((x) => x.id === n.halaqaId);
          return (
            <NotifItem
              key={n.id}
              n={n}
              isNew={!readSnap.has(n.id)}
              halaqaLabel={h ? halaqaTitle(h) : "للجميع"}
            />
          );
        })}
      </div>
    </section>
  );
}
