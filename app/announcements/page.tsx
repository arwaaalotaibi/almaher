"use client";

import { useState } from "react";
import {
  actions,
  formatNotifDate,
  halaqaTitle,
  NOTIF_TYPES,
  notifTypeMeta,
  type NotifType,
  useApp,
} from "@/lib/store";
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
  const [type, setType] = useState<NotifType>("general");
  const [pinned, setPinned] = useState(false);

  if (!hydrated) return <main className="mx-auto max-w-2xl px-4 pt-10" />;

  const audience =
    target === ""
      ? students.length
      : students.filter((s) => s.halaqaId === target).length;

  const send = () => {
    if (!body.trim()) return;
    actions.addAnnouncement(body, target, { type, pinned });
    setBody("");
    setPinned(false);
    setType("general");
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
        <Field label="نوع الإشعار" icon="🏷️">
          <div className="grid grid-cols-3 gap-1.5">
            {NOTIF_TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setType(t.key)}
                className={`rounded-xl border-2 px-2 py-2 text-xs font-bold transition ${
                  type === t.key
                    ? "border-plum-600 bg-plum-50 text-plum-800"
                    : "border-cream-dark text-silver-600"
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
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
        <button
          type="button"
          onClick={() => setPinned((v) => !v)}
          className={`mb-3 flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start transition ${
            pinned ? "border-plum-600 bg-plum-50" : "border-cream-dark bg-white"
          }`}
        >
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 text-xs font-bold ${
              pinned
                ? "border-plum-600 bg-plum-600 text-white"
                : "border-silver-400 text-transparent"
            }`}
          >
            ✓
          </span>
          <span className="text-sm font-bold text-plum-700">
            📌 تثبيت على واجهة الطالبة (يظهر واحد فقط)
          </span>
        </button>
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
            const meta = notifTypeMeta(n.type);
            return (
              <div
                key={n.id}
                className={`card rounded-xl p-3 ${
                  n.pinned ? "border-plum-500 bg-plum-50" : ""
                }`}
              >
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-plum-700">
                    {meta.icon} {meta.label}
                  </span>
                  {n.pinned && (
                    <span className="rounded-full bg-plum-600 px-2 py-0.5 text-[10px] font-bold text-white">
                      📌 مثبّت على الواجهة
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm text-ink">{n.body}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-silver-600">
                    {formatNotifDate(n.createdAt)}
                    {" · "}
                    {h ? halaqaTitle(h) : "كل الطالبات"}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        actions.setAnnouncementPinned(n.id, !n.pinned)
                      }
                      className="text-xs font-bold text-plum-700"
                    >
                      {n.pinned ? "فكّ التثبيت" : "📌 تثبيت"}
                    </button>
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
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
