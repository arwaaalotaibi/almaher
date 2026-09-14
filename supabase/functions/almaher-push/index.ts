// الماهر — إرسال إشعارات الجهاز (Web Push) من الخادم
//
// ثلاثة أنواع من الطلبات (POST بجسم JSON):
//   { kind: "announce", id }  إعلان جديد من الإدارة → لطالبات الحلقة المستهدفة (أو الكل)
//                             — يتطلب جلسة إدارة/معلّمة (Authorization: Bearer <jwt>)
//   { kind: "test" }          إشعار تجريبي لأجهزة الطالبة صاحبة الجلسة نفسها
//   { kind: "direct", student_id, body }  رسالة خاصة من الإدارة لطالبة واحدة (جلسة إدارة/معلّمة)
//   { kind: "reminders" }     تذكير «لقاؤكِ غداً» لطالبات حلقات الغد — يُستدعى من
//                             المجدول (pg_cron) مع الترويسة x-cron-secret
//
// الأسرار (supabase secrets set): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET
// SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY تُوفَّر تلقائياً.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type Sub = { endpoint: string; p256dh: string; auth: string; student_id: string; halaqa_id: string };
type Payload = { title: string; body: string; url?: string; tag?: string };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:almaher@almahr.org";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const WEEK_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const ar = (n: number) => n.toLocaleString("ar-EG");

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...cors },
  });
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "access-control-allow-methods": "POST, OPTIONS",
};

/** إرسال حمولة إلى مجموعة اشتراكات، مع حذف الاشتراكات الميتة (410/404) */
async function sendTo(subs: Sub[], payload: Payload): Promise<{ sent: number; removed: number }> {
  let sent = 0;
  let removed = 0;
  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          { TTL: 60 * 60 * 12 }
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await admin.from("almaher_push_subs").delete().eq("endpoint", s.endpoint);
          removed++;
        }
      }
    })
  );
  return { sent, removed };
}

/** دور صاحبة الجلسة (admin / teacher / student / null) ومعرّف الطالبة إن وُجد */
async function whoIs(req: Request): Promise<{ role: string | null; studentId: string | null }> {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return { role: null, studentId: null };
  const user = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? SERVICE_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const [{ data: role }, { data: sid }] = await Promise.all([
    user.rpc("almaher_role"),
    user.rpc("almaher_my_student"),
  ]);
  return {
    role: typeof role === "string" ? role : null,
    studentId: typeof sid === "string" && sid ? sid : null,
  };
}

/** يوم الغد بتوقيت الكويت (UTC+3) */
function tomorrowKuwait(): { iso: string; weekday: number } {
  const now = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const t = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return { iso: t.toISOString().slice(0, 10), weekday: t.getUTCDay() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ error: "VAPID keys missing" }, 500);

  let body: { kind?: string; id?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* جسم فارغ */
  }

  // ---------- تذكير الغد (من المجدول) ----------
  if (body.kind === "reminders") {
    if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
      return json({ error: "forbidden" }, 403);
    }
    const { iso, weekday } = tomorrowKuwait();
    // لا نكرّر تذكير اليوم نفسه
    const { data: last } = await admin.from("almaher_settings").select("value").eq("key", "push_reminder_last").maybeSingle();
    if (last?.value?.day === iso) return json({ ok: true, skipped: "already sent", day: iso });

    const dayName = WEEK_DAYS[weekday];
    const { data: halaqas } = await admin
      .from("almaher_halaqas")
      .select("id, mosque, day, term_start, term_sessions")
      .eq("day", dayName);
    const active = (halaqas ?? []).filter((h) => {
      if (!h.term_start) return false;
      const start = new Date(h.term_start + "T00:00:00Z").getTime();
      const t = new Date(iso + "T00:00:00Z").getTime();
      if (t < start) return false;
      const weeks = Math.round((t - start) / (7 * 24 * 60 * 60 * 1000));
      return !h.term_sessions || weeks < h.term_sessions;
    });
    if (active.length === 0) return json({ ok: true, halaqas: 0, day: iso });

    const ids = active.map((h) => h.id);
    const [{ data: subs }, { data: students }] = await Promise.all([
      admin.from("almaher_push_subs").select("endpoint,p256dh,auth,student_id,halaqa_id").in("halaqa_id", ids),
      admin.from("almaher_students").select("id, name, plan").in("halaqa_id", ids),
    ]);
    const planOf = new Map((students ?? []).map((s) => [s.id, s.plan ?? {}]));
    let sent = 0;
    let removed = 0;
    for (const s of subs ?? []) {
      const p = planOf.get(s.student_id) as { hifz?: number; murajaah?: number } | undefined;
      const parts: string[] = [];
      if (p?.hifz) parts.push(`📖 حفظ ${ar(p.hifz)}`);
      if (p?.murajaah) parts.push(`🔁 مراجعة ${ar(p.murajaah)}`);
      const r = await sendTo([s], {
        title: `لقاؤكِ غداً ${dayName} 🌙`,
        body: parts.length ? `المطلوب: ${parts.join(" · ")} — راجعي وردكِ في التطبيق` : "راجعي وردكِ في التطبيق واستعدّي للتسميع",
        url: "/",
        tag: `reminder-${iso}`,
      });
      sent += r.sent;
      removed += r.removed;
    }
    await admin.from("almaher_settings").upsert({ key: "push_reminder_last", value: { day: iso, sent }, updated_at: new Date().toISOString() });
    return json({ ok: true, day: iso, halaqas: ids.length, sent, removed });
  }

  // ---------- بقية الأنواع تحتاج جلسة ----------
  const who = await whoIs(req);

  if (body.kind === "test") {
    if (!who.studentId) return json({ error: "not a student" }, 403);
    const { data: subs } = await admin
      .from("almaher_push_subs")
      .select("endpoint,p256dh,auth,student_id,halaqa_id")
      .eq("student_id", who.studentId);
    const r = await sendTo(subs ?? [], {
      title: "الماهر 🌸",
      body: "إشعاراتكِ تعمل بنجاح — ستصلكِ التذكيرات والإعلانات هنا",
      url: "/",
      tag: "test",
    });
    return json({ ok: true, ...r });
  }

  if (body.kind === "announce") {
    if (who.role !== "admin" && who.role !== "teacher") return json({ error: "forbidden" }, 403);
    if (!body.id) return json({ error: "id required" }, 400);
    const { data: a } = await admin
      .from("almaher_announcements")
      .select("id, body, halaqa_id, type, show_at")
      .eq("id", body.id)
      .maybeSingle();
    if (!a) return json({ error: "not found" }, 404);
    if (a.show_at && new Date(a.show_at).getTime() > Date.now() + 60_000) {
      return json({ ok: true, skipped: "scheduled for later" });
    }
    let q = admin.from("almaher_push_subs").select("endpoint,p256dh,auth,student_id,halaqa_id");
    if (a.halaqa_id) q = q.eq("halaqa_id", a.halaqa_id);
    const { data: subs } = await q;
    const title = a.type === "important" ? "⚠️ إعلان مهم من الماهر" : a.type === "reminder" ? "⏰ تذكير من الماهر" : "📢 إعلان من الماهر";
    const text = String(a.body ?? "");
    const r = await sendTo(subs ?? [], {
      title,
      body: text.length > 140 ? text.slice(0, 137) + "…" : text,
      url: "/",
      tag: `announce-${a.id}`,
    });
    return json({ ok: true, ...r });
  }

  if (body.kind === "direct") {
    if (who.role !== "admin" && who.role !== "teacher") return json({ error: "forbidden" }, 403);
    const b = body as { student_id?: string; body?: string };
    if (!b.student_id || !b.body) return json({ error: "student_id and body required" }, 400);
    const { data: subs } = await admin
      .from("almaher_push_subs")
      .select("endpoint,p256dh,auth,student_id,halaqa_id")
      .eq("student_id", b.student_id);
    const text = String(b.body);
    const r = await sendTo(subs ?? [], {
      title: "✉️ رسالة خاصة من الإدارة",
      body: text.length > 140 ? text.slice(0, 137) + "…" : text,
      url: "/",
      tag: `direct-${Date.now()}`,
    });
    return json({ ok: true, ...r });
  }

  return json({ error: "unknown kind" }, 400);
});
