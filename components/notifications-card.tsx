"use client";

import { useEffect, useMemo, useState } from "react";
import {
  announcementsFor,
  countUnseen,
  formatNotifDate,
  getNotifSeen,
  halaqaTitle,
  markNotifSeen,
  useApp,
} from "@/lib/store";

/** بطاقة إشعارات الإدارة — تظهر للطالبة/المعلّمة حسب حلقاتها */
export function NotificationsCard({ halaqaIds }: { halaqaIds: string[] }) {
  const { announcements, halaqas } = useApp();
  const list = useMemo(
    () => announcementsFor(announcements, halaqaIds),
    [announcements, halaqaIds]
  );

  // نلتقط «آخر مشاهدة» عند الدخول، ثم نعلّمها كمقروءة بعد لحظات
  const [seen, setSeen] = useState<number | null>(null);
  useEffect(() => {
    setSeen(getNotifSeen());
    const t = setTimeout(() => markNotifSeen(), 2000);
    return () => clearTimeout(t);
  }, []);

  if (list.length === 0) return null;
  const seenAt = seen ?? 0;
  const unseen = countUnseen(list, seenAt);

  return (
    <section className="card mb-5 rounded-2xl p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="font-kufi text-base font-bold text-plum-800">
          📢 إشعارات الإدارة
        </span>
        {unseen > 0 && (
          <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
            {unseen.toLocaleString("ar-EG")} جديد
          </span>
        )}
      </div>
      <div className="grid gap-2">
        {list.map((n) => {
          const h = halaqas.find((x) => x.id === n.halaqaId);
          const isNew = new Date(n.createdAt).getTime() > seenAt;
          return (
            <div
              key={n.id}
              className={`rounded-xl border-r-4 px-3 py-2.5 ${
                isNew
                  ? "border-plum-600 bg-plum-50"
                  : "border-cream-dark bg-cream/40"
              }`}
            >
              <p className="whitespace-pre-wrap text-sm text-ink">{n.body}</p>
              <p className="mt-1 text-[11px] font-bold text-silver-600">
                {formatNotifDate(n.createdAt)}
                {" · "}
                {h ? halaqaTitle(h) : "للجميع"}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
