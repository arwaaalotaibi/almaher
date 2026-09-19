-- ============================================================
--  الماهر v12 — حساب لكل معلّمة برمز/رابط خاص (مثل الطالبات)
--  يُشغَّل بعد schema-v11-withdrawn.sql. آمن لإعادة التشغيل.
--
--  • جدول رموز المعلّمات (تقرؤه الإدارة فقط) وجدول أجهزتهن (هوية مجهولة ← معلّمة).
--  • almaher_role(): الجهاز المربوط بمعلّمة = 'teacher' (ويبقى بريد muallima@ يعمل).
--  • صلاحيات المعلّمة: قراءة ما يلزم، وكتابة سجلّات التسميع لطالبات حلقاتها فقط،
--    وإعلانات حلقاتها. حساب الإدارة وحده يعدّل الطالبات والخطط والإعدادات.
-- ============================================================

-- ١) الجداول
create table if not exists public.almaher_teacher_codes (
  teacher_id text primary key references public.almaher_teachers(id) on delete cascade,
  code       text not null unique
);
create table if not exists public.almaher_teacher_devices (
  uid        uuid primary key,
  teacher_id text not null references public.almaher_teachers(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);
alter table public.almaher_teacher_codes   enable row level security;
alter table public.almaher_teacher_devices enable row level security;
drop policy if exists admin_all on public.almaher_teacher_codes;
create policy admin_all on public.almaher_teacher_codes for all to authenticated
  using (public.almaher_role() = 'admin') with check (public.almaher_role() = 'admin');
drop policy if exists admin_all on public.almaher_teacher_devices;
create policy admin_all on public.almaher_teacher_devices for all to authenticated
  using (public.almaher_role() = 'admin') with check (public.almaher_role() = 'admin');

-- ٢) الدوال
create or replace function public.almaher_my_teacher()
returns text language sql stable security definer set search_path = public as $$
  select teacher_id from public.almaher_teacher_devices where uid = auth.uid()
$$;

create or replace function public.almaher_role()
returns text language sql stable security definer set search_path = public as $$
  select case
    when (auth.jwt() ->> 'email') = 'almaher@almahr.org'  then 'admin'
    when (auth.jwt() ->> 'email') = 'muallima@almahr.org' then 'teacher'
    when auth.uid() is not null
      and exists (select 1 from public.almaher_teacher_devices where uid = auth.uid())
      then 'teacher'
    when auth.uid() is not null
      and exists (select 1 from public.almaher_student_devices where uid = auth.uid())
      then 'student'
    else null
  end
$$;

-- حلقات المعلّمة الحالية (الحساب المشترك القديم بلا معلّمة محددة = كل الحلقات)
create or replace function public.almaher_teacher_halaqas()
returns setof text language sql stable security definer set search_path = public as $$
  select case when public.almaher_my_teacher() is null then h.id else x.hid end
  from public.almaher_halaqas h
  left join lateral (
    select jsonb_array_elements_text(t.halaqa_ids) as hid
    from public.almaher_teachers t where t.id = public.almaher_my_teacher()
  ) x on x.hid = h.id
  where public.almaher_my_teacher() is null or x.hid is not null
$$;

create or replace function public.almaher_claim_teacher(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare tid text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select teacher_id into tid from public.almaher_teacher_codes
   where code = regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
  if tid is null then return null; end if;
  delete from public.almaher_student_devices where uid = auth.uid();
  insert into public.almaher_teacher_devices (uid, teacher_id) values (auth.uid(), tid)
    on conflict (uid) do update set teacher_id = excluded.teacher_id, last_seen = now();
  return tid;
end $$;

create or replace function public.almaher_me_teacher()
returns text language plpgsql security definer set search_path = public as $$
declare tid text;
begin
  update public.almaher_teacher_devices set last_seen = now()
    where uid = auth.uid() returning teacher_id into tid;
  return tid;
end $$;

create or replace function public.almaher_unclaim_teacher()
returns void language sql security definer set search_path = public as $$
  delete from public.almaher_teacher_devices where uid = auth.uid();
$$;

revoke all on function public.almaher_my_teacher() from public;
revoke all on function public.almaher_teacher_halaqas() from public;
revoke all on function public.almaher_claim_teacher(text) from public;
revoke all on function public.almaher_me_teacher() from public;
revoke all on function public.almaher_unclaim_teacher() from public;
grant execute on function public.almaher_my_teacher() to authenticated;
grant execute on function public.almaher_teacher_halaqas() to authenticated;
grant execute on function public.almaher_claim_teacher(text) to authenticated;
grant execute on function public.almaher_me_teacher() to authenticated;
grant execute on function public.almaher_unclaim_teacher() to authenticated;

-- ٣) الصلاحيات: الإدارة كل شيء؛ المعلّمة قراءة محدودة وكتابة سجلّات حلقاتها
do $$
declare
  t text;
  all_tables text[] := array[
    'almaher_halaqas','almaher_teachers','almaher_students','almaher_announcements',
    'almaher_notif_reads','almaher_sessions','almaher_books','almaher_reading_progress',
    'almaher_tajweed','almaher_tajweed_results','almaher_annotations','almaher_support',
    'almaher_terms','almaher_push_subs','almaher_student_codes','almaher_student_devices',
    'almaher_settings','almaher_quotes','almaher_quote_likes'
  ];
  teacher_read_all text[] := array[
    'almaher_halaqas','almaher_teachers','almaher_announcements','almaher_books',
    'almaher_tajweed','almaher_terms','almaher_settings','almaher_quotes','almaher_quote_likes'
  ];
  teacher_read_own text[] := array[
    'almaher_sessions','almaher_reading_progress','almaher_tajweed_results','almaher_support'
  ];
begin
  foreach t in array all_tables loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop policy if exists staff_all on public.%I', t);
    execute format(
      'create policy staff_all on public.%I for all to authenticated
         using (public.almaher_role() = ''admin'') with check (public.almaher_role() = ''admin'')', t);
    execute format('drop policy if exists teacher_read on public.%I', t);
    execute format('drop policy if exists teacher_write on public.%I', t);
    if t = any(teacher_read_all) then
      execute format(
        'create policy teacher_read on public.%I for select to authenticated
           using (public.almaher_role() = ''teacher'')', t);
    end if;
    if t = any(teacher_read_own) then
      execute format(
        'create policy teacher_read on public.%I for select to authenticated
           using (public.almaher_role() = ''teacher'' and student_id in
             (select id from public.almaher_students where halaqa_id in (select public.almaher_teacher_halaqas())))', t);
    end if;
  end loop;
end $$;

-- الطالبات: المعلّمة تقرأ طالبات حلقاتها (بلا تعديل)
drop policy if exists teacher_read on public.almaher_students;
create policy teacher_read on public.almaher_students for select to authenticated
  using (public.almaher_role() = 'teacher' and halaqa_id in (select public.almaher_teacher_halaqas()));

-- سجلّات التسميع: المعلّمة تضيف/تعدّل/تحذف لطالبات حلقاتها
create policy teacher_write on public.almaher_sessions for all to authenticated
  using (public.almaher_role() = 'teacher' and student_id in
    (select id from public.almaher_students where halaqa_id in (select public.almaher_teacher_halaqas())))
  with check (public.almaher_role() = 'teacher' and student_id in
    (select id from public.almaher_students where halaqa_id in (select public.almaher_teacher_halaqas())));

-- الإعلانات: المعلّمة تنشر لحلقاتها
create policy teacher_write on public.almaher_announcements for all to authenticated
  using (public.almaher_role() = 'teacher' and halaqa_id in (select public.almaher_teacher_halaqas()))
  with check (public.almaher_role() = 'teacher' and halaqa_id in (select public.almaher_teacher_halaqas()));

-- الدعم: المعلّمة تردّ على رسائل طالباتها
create policy teacher_write on public.almaher_support for update to authenticated
  using (public.almaher_role() = 'teacher' and student_id in
    (select id from public.almaher_students where halaqa_id in (select public.almaher_teacher_halaqas())))
  with check (public.almaher_role() = 'teacher' and student_id in
    (select id from public.almaher_students where halaqa_id in (select public.almaher_teacher_halaqas())));

-- ٤) للتأكد
select tablename, policyname, cmd from pg_policies
 where tablename in ('almaher_sessions','almaher_students','almaher_teacher_codes') order by 1,2;
