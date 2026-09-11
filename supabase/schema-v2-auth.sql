-- ============================================================
--  الماهر — دخول الطالبات بالرمز الخاص (بلا حساب مشترك) + حماية لكل طالبة
--  يُشغَّل بعد schema.sql في: SQL Editor → New query → Run
--  آمن لإعادة التشغيل.
--
--  الفكرة:
--   • جهاز الطالبة يدخل «مجهولاً» (Anonymous sign-in) فيحصل على هوية auth.uid().
--   • الطالبة تكتب رمزها → almaher_claim(code) تربط الهوية بالطالبة في
--     almaher_student_devices. بلا رمز صحيح لا ترى الهوية شيئاً.
--   • الرموز في almaher_student_codes ولا تقرؤها إلا الإدارة/المعلّمات.
--   • RLS يحصر الطالبة في صفّها هي، وزميلات مسجدها بالاسم فقط (للسباق).
-- ============================================================

-- ---------- ١) الرموز في جدول منفصل ----------
create table if not exists public.almaher_student_codes (
  student_id text primary key references public.almaher_students(id) on delete cascade,
  code       text not null unique,
  created_at timestamptz not null default now()
);

-- نقل الرموز القديمة (إن وُجد العمود) ثم حذف العمود من جدول الطالبات
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'almaher_students' and column_name = 'code'
  ) then
    insert into public.almaher_student_codes (student_id, code)
      select id, code from public.almaher_students where code <> ''
      on conflict (student_id) do nothing;
    alter table public.almaher_students drop column code;
  end if;
end $$;
drop index if exists public.almaher_students_code_idx;

-- ---------- ٢) أجهزة الطالبات: هوية مجهولة ← طالبة ----------
create table if not exists public.almaher_student_devices (
  uid        uuid primary key,
  student_id text not null references public.almaher_students(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);
create index if not exists almaher_student_devices_student_idx
  on public.almaher_student_devices (student_id);

-- ---------- ٣) الدوال ----------

-- الطالبة المرتبطة بالهوية الحالية (أو null)
create or replace function public.almaher_my_student()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select student_id from public.almaher_student_devices where uid = auth.uid()
$$;

-- الدور: إدارة/معلّمة من البريد، وطالبة إن كانت الهوية مربوطة برمز
create or replace function public.almaher_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when (auth.jwt() ->> 'email') = 'almaher@almahr.org'  then 'admin'
    when (auth.jwt() ->> 'email') = 'muallima@almahr.org' then 'teacher'
    when auth.uid() is not null
      and exists (select 1 from public.almaher_student_devices where uid = auth.uid())
      then 'student'
    else null
  end
$$;

-- مسجد الطالبة الحالية (لرؤية زميلات السباق)
create or replace function public.almaher_my_mosque()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select h.mosque
  from public.almaher_students s
  join public.almaher_halaqas h on h.id = s.halaqa_id
  where s.id = public.almaher_my_student()
$$;

-- ربط الجهاز بالطالبة برمزها — يعيد معرّف الطالبة أو null إن كان الرمز خطأ
create or replace function public.almaher_claim(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  sid text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select student_id into sid
  from public.almaher_student_codes
  where code = regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
  if sid is null then
    return null;
  end if;
  insert into public.almaher_student_devices (uid, student_id)
  values (auth.uid(), sid)
  on conflict (uid) do update
    set student_id = excluded.student_id, last_seen = now();
  update public.almaher_students set last_seen = now() where id = sid;
  return sid;
end $$;

-- الطالبة المربوطة بهذا الجهاز عند فتح التطبيق (يحدّث آخر ظهور)
create or replace function public.almaher_me()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  sid text;
begin
  update public.almaher_student_devices
    set last_seen = now()
    where uid = auth.uid()
    returning student_id into sid;
  if sid is not null then
    update public.almaher_students set last_seen = now() where id = sid;
  end if;
  return sid;
end $$;

-- فكّ ربط هذا الجهاز (تسجيل الخروج)
create or replace function public.almaher_unclaim()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.almaher_student_devices where uid = auth.uid();
$$;

-- «آخر ظهور»: الطالبة لنفسها فقط، والإدارة لأي طالبة
create or replace function public.almaher_touch_seen(p_sid text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.almaher_students set last_seen = now()
  where id = p_sid
    and (public.almaher_role() in ('admin','teacher') or p_sid = public.almaher_my_student());
$$;

-- اشتراك الإشعارات: الطالبة لنفسها فقط
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
  insert into public.almaher_push_subs (endpoint, p256dh, auth, student_id, halaqa_id)
  values (p_endpoint, p_p256dh, p_auth, p_sid, p_halaqa)
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth,
        student_id = excluded.student_id, halaqa_id = excluded.halaqa_id;
end $$;

revoke all on function public.almaher_my_student() from public;
revoke all on function public.almaher_my_mosque() from public;
revoke all on function public.almaher_claim(text) from public;
revoke all on function public.almaher_me() from public;
revoke all on function public.almaher_unclaim() from public;
grant execute on function public.almaher_my_student() to authenticated;
grant execute on function public.almaher_my_mosque() to authenticated;
grant execute on function public.almaher_claim(text) to authenticated;
grant execute on function public.almaher_me() to authenticated;
grant execute on function public.almaher_unclaim() to authenticated;
grant execute on function public.almaher_role() to authenticated, anon;

-- ---------- ٤) زميلات المسجد (للسباق): الاسم والحلقة فقط، بلا هاتف ولا خطة ----------
drop view if exists public.almaher_peers;
create view public.almaher_peers
with (security_invoker = false)
as
  select s.id, s.name, s.halaqa_id, s.teacher_id, s.track
  from public.almaher_students s
  join public.almaher_halaqas h on h.id = s.halaqa_id
  where public.almaher_role() = 'student'
    and h.mosque = public.almaher_my_mosque();
grant select on public.almaher_peers to authenticated;

-- ---------- ٥) الحماية (RLS) — تُعاد كتابتها كاملة ----------
do $$
declare
  t text;
  all_tables text[] := array[
    'almaher_halaqas','almaher_teachers','almaher_students','almaher_announcements',
    'almaher_notif_reads','almaher_sessions','almaher_books','almaher_reading_progress',
    'almaher_tajweed','almaher_tajweed_results','almaher_annotations','almaher_support',
    'almaher_terms','almaher_push_subs','almaher_student_codes','almaher_student_devices'
  ];
  -- جداول عامة تقرؤها كل طالبة مربوطة
  student_read_all text[] := array[
    'almaher_halaqas','almaher_teachers','almaher_announcements','almaher_books',
    'almaher_tajweed','almaher_terms'
  ];
  -- جداول تُقرأ على مستوى المسجد (نقاط السباق) وتُكتب للطالبة نفسها فقط
  mosque_read_own_write text[] := array[
    'almaher_sessions','almaher_reading_progress','almaher_tajweed_results'
  ];
  -- جداول خاصة بالطالبة قراءةً وكتابةً
  own_only text[] := array['almaher_notif_reads','almaher_annotations'];
begin
  foreach t in array all_tables loop
    execute format('alter table public.%I enable row level security', t);
    -- تنظيف السياسات القديمة
    execute format('drop policy if exists staff_all on public.%I', t);
    execute format('drop policy if exists student_read on public.%I', t);
    execute format('drop policy if exists student_write on public.%I', t);
    execute format('drop policy if exists student_update on public.%I', t);
    execute format('drop policy if exists student_insert on public.%I', t);
    execute format('drop policy if exists student_mosque_read on public.%I', t);
    execute format('drop policy if exists student_own_write on public.%I', t);

    -- الإدارة والمعلّمات: كل شيء
    execute format(
      'create policy staff_all on public.%I for all to authenticated
         using (public.almaher_role() in (''admin'',''teacher''))
         with check (public.almaher_role() in (''admin'',''teacher''))', t);

    if t = any(student_read_all) then
      execute format(
        'create policy student_read on public.%I for select to authenticated
           using (public.almaher_role() = ''student'')', t);
    end if;

    if t = any(mosque_read_own_write) then
      execute format(
        'create policy student_mosque_read on public.%I for select to authenticated
           using (public.almaher_role() = ''student''
                  and student_id in (select id from public.almaher_peers))', t);
      execute format(
        'create policy student_own_write on public.%I for all to authenticated
           using (public.almaher_role() = ''student'' and student_id = public.almaher_my_student())
           with check (public.almaher_role() = ''student'' and student_id = public.almaher_my_student())', t);
    end if;

    if t = any(own_only) then
      execute format(
        'create policy student_own_write on public.%I for all to authenticated
           using (public.almaher_role() = ''student'' and student_id = public.almaher_my_student())
           with check (public.almaher_role() = ''student'' and student_id = public.almaher_my_student())', t);
    end if;
  end loop;
end $$;

-- الطالبة: صفّها هي فقط — تقرؤه وتعدّله (خطتها، إقرار اللائحة) ولا تضيف ولا تحذف
create policy student_read on public.almaher_students for select to authenticated
  using (public.almaher_role() = 'student' and id = public.almaher_my_student());
create policy student_update on public.almaher_students for update to authenticated
  using (public.almaher_role() = 'student' and id = public.almaher_my_student())
  with check (public.almaher_role() = 'student' and id = public.almaher_my_student());

-- الدعم: الطالبة ترى رسائلها وترسل باسمها فقط
create policy student_read on public.almaher_support for select to authenticated
  using (public.almaher_role() = 'student' and student_id = public.almaher_my_student());
create policy student_insert on public.almaher_support for insert to authenticated
  with check (public.almaher_role() = 'student' and student_id = public.almaher_my_student());

-- ---------- ٦) التحديث اللحظي للجداول الجديدة ----------
do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.almaher_student_codes';
  exception when duplicate_object then null;
  end;
end $$;
