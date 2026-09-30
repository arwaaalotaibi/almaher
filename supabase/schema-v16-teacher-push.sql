-- ============================================================
--  الماهر v16 — 🔔 إشعارات جوال المعلّمات
--  • almaher_push_subs.teacher_id: اشتراك مربوط بمعلّمة (student_id/halaqa_id فارغان)
--  • almaher_save_teacher_push_sub(): المعلّمة تحفظ اشتراك جهازها لنفسها فقط
--  • تذكير ٩ م (الكويت) — الحلقات تنتهي ٧–٨ م: يوم الحلقة إن لم يكتمل تسجيل لقاء اليوم،
--    واليوم التالي إن بقي لقاء أمس ناقصاً — دالة almaher-push بنوع teacher_reminders
--  آمن لإعادة التشغيل.
-- ============================================================

alter table public.almaher_push_subs add column if not exists teacher_id text not null default '';
create index if not exists almaher_push_subs_teacher_idx on public.almaher_push_subs (teacher_id);

create or replace function public.almaher_save_teacher_push_sub(
  p_endpoint text, p_p256dh text, p_auth text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tid text := public.almaher_my_teacher();
begin
  if tid is null then
    raise exception 'not a teacher device';
  end if;
  insert into public.almaher_push_subs (endpoint, p256dh, auth, student_id, halaqa_id, teacher_id)
  values (p_endpoint, p_p256dh, p_auth, '', '', tid)
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth,
        student_id = '', halaqa_id = '', teacher_id = excluded.teacher_id;
end $$;

revoke all on function public.almaher_save_teacher_push_sub(text, text, text) from public;
grant execute on function public.almaher_save_teacher_push_sub(text, text, text) to authenticated;

-- اشتراك طالبة على جهاز كان لمعلّمة (أو العكس): يُفرَّغ الطرف الآخر
create or replace function public.almaher_save_push_sub(
  p_endpoint text, p_p256dh text, p_auth text, p_sid text, p_halaqa text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.almaher_role() in ('admin','teacher') or p_sid = public.almaher_my_student()) then
    raise exception 'not allowed';
  end if;
  insert into public.almaher_push_subs (endpoint, p256dh, auth, student_id, halaqa_id, teacher_id)
  values (p_endpoint, p_p256dh, p_auth, p_sid, p_halaqa, '')
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth,
        student_id = excluded.student_id, halaqa_id = excluded.halaqa_id, teacher_id = '';
end $$;

-- ⏰ تذكير المعلّمات: كل يوم ٩ مساءً بتوقيت الكويت (١٨:٠٠ UTC) — لمن كان لها لقاء اليوم أو أمس ولم يكتمل تسجيله.
--    الجدولة في supabase/cron-reminders.sql (غير منشور لأنه يحمل CRON_SECRET) — مع تذكير الطالبات.
