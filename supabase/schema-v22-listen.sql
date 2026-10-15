-- ============================================================
--  الماهر v22 — 🎧 متابعة استخدام مسمّعي
--  عمودان في جدول الطالبات: آخر مرة شغّلت فيها الطالبة التلاوة في مسمّعي،
--  وعدد الأيام التي استمعت فيها. (آخر دخول للتطبيق موجود من قبل: last_seen)
--  الطالبة لا تكتب في جدولها مباشرة — دالة آمنة تحدّث صفّها هي فقط.
--  آمن لإعادة التشغيل.
-- ============================================================

alter table public.almaher_students
  add column if not exists last_listen timestamptz,
  add column if not exists listen_days integer not null default 0;

-- 🎧 تُستدعى من جهاز الطالبة عند تشغيل التلاوة في مسمّعي
create or replace function public.almaher_listened()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sid text;
begin
  select student_id into sid from public.almaher_student_devices where uid = auth.uid();
  if sid is null then
    return;
  end if;
  update public.almaher_students
    set listen_days = listen_days
          + case
              when last_listen is null
                or (last_listen at time zone 'Asia/Kuwait')::date < (now() at time zone 'Asia/Kuwait')::date
              then 1 else 0
            end,
        last_listen = now()
    where id = sid;
end $$;

revoke all on function public.almaher_listened() from public;
grant execute on function public.almaher_listened() to authenticated;
