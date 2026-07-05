"use client";

import { useState } from "react";
import { actions, formatNotifDate, halaqaTitle, useApp } from "@/lib/store";
import {
  Field,
  inputCls,
  PageHeader,
  PrimaryBtn,
  useHydrated,
} from "@/components/ui";
import { RoleOnly } from "@/components/admin-only";

export default function AnnouncementsPage() {
  return (
    <RoleOnly roles={["admin"]}>
      <AnnouncementsInner />
    </RoleOnly>
  );
}

function AnnouncementsInner() {
  const { halaqas, announcements, students } = useApp();
  const hydrated = useHydrated();
  const [body, setBody] = useState("");
  const [target, setTarget] = useState(""); // "" = كل الطالبات

  if (!hydrated) return <main className="mx-auto max-w-2xl px-4 pt-10" />;

  const audience =
    target === ""
      ? students.length
      : students.filter((s) => s.halaqaId === target).length;

  const send = () => {
    if (!body.trim()) return;
    actions.addAnnouncement(body, target);
    setBody("");
    window.alert("تم إرسال الإشعار ✅");
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-8">
      <PageHeader title="إشعارات الطالبات" back="/" />
      <p className="mb-5 -mt-2 text-sm text-silver-600">
        اكتبي إشعاراً يظهر للطالبات في التطبيق فور فتحه 📲
      </p>

      <div className="card mb-6 rounded-2xl p-4">
        <Field label="نص الإشعار" icon="✍️">
          <textarea
            className={`${inputCls} min-h-24`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="مثال: غداً إجازة بمناسبة العيد، نلقاكنّ الأسبوع القادم بإذن الله 🌙"
          />
        </Field>
        <Field label="إلى مَن؟" icon="🎯">
          <select
            className={inputCls}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="">كل الطالبات في كل الحلقات</option>
            {halaqas.map((h) => (
              <option key={h.id} value={h.id}>
                طالبات {halaqaTitle(h)}
              </option>
            ))}
          </select>
        </Field>
        <p className="mb-3 text-center text-xs text-silver-600">
          سيصل إلى {audience.toLocaleString("ar-EG")} طالبة
        </p>
        <PrimaryBtn onClick={send}>📢 إرسال الإشعار</PrimaryBtn>
      </div>

      <h2 className="mb-2 font-kufi text-base font-bold text-plum-700">
        الإشعارات المُرسَلة
      </h2>
      {announcements.length === 0 ? (
        <p className="rounded-xl bg-cream-dark/40 px-4 py-6 text-center text-sm text-silver-600">
          لا إشعارات بعد
        </p>
      ) : (
        <div className="grid gap-2">
          {announcements.map((n) => {
            const h = halaqas.find((x) => x.id === n.halaqaId);
            return (
              <div key={n.id} className="card rounded-xl p-3">
                <p className="whitespace-pre-wrap text-sm text-ink">{n.body}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-silver-600">
                    {formatNotifDate(n.createdAt)}
                    {" · "}
                    {h ? halaqaTitle(h) : "كل الطالبات"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("حذف هذا الإشعار؟")) {
                        actions.removeAnnouncement(n.id);
                      }
                    }}
                    className="text-xs font-bold text-red-600"
                  >
                    حذف
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
