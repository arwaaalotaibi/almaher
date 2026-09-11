-- ============================================================
--  الماهر — إعدادات عامة + خيار «من يسجّل التسميع»
--  يُشغَّل بعد schema-v3-lock-plan.sql. آمن لإعادة التشغيل.
--
--  almaher_settings: جدول مفتاح/قيمة تكتبه الإدارة ويقرؤه الجميع.
--  المفتاح student_recite → {"enabled": true|false}
--    true  : الطالبة تسجّل تسميعها بنفسها (والإدارة أيضاً)
--    false : الإدارة/المعلّمات فقط — وقاعدة البيانات ترفض كتابة الطالبة
-- ============================================================

create table if not exists public.almaher_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.almaher_settings (key, value)
  values ('student_recite', '{"enabled": true}'::jsonb)
  on conflict (key) do nothing;

alter table public.almaher_settings enable row level security;
drop policy if exists staff_all on public.almaher_settings;
create policy staff_all on public.almaher_settings for all to authenticated
  using (public.almaher_role() in ('admin','teacher'))
  with check (public.almaher_role() in ('admin','teacher'));
drop policy if exists student_read on public.almaher_settings;
create policy student_read on public.almaher_settings for select to authenticated
  using (public.almaher_role() = 'student');

-- هل يُسمح للطالبة بتسجيل التسميع؟ (الافتراضي نعم)
create or replace function public.almaher_student_recite_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (value ->> 'enabled')::boolean from public.almaher_settings where key = 'student_recite'),
    true
  )
$$;
revoke all on function public.almaher_student_recite_enabled() from public;
grant execute on function public.almaher_student_recite_enabled() to authenticated;

-- سجلّ التسميع: كتابة الطالبة لنفسها فقط، وفقط إن كان الخيار مفعّلاً
drop policy if exists student_own_write on public.almaher_sessions;
create policy student_own_write on public.almaher_sessions for all to authenticated
  using (
    public.almaher_role() = 'student'
    and student_id = public.almaher_my_student()
    and public.almaher_student_recite_enabled()
  )
  with check (
    public.almaher_role() = 'student'
    and student_id = public.almaher_my_student()
    and public.almaher_student_recite_enabled()
  );

-- التحديث اللحظي: تبديل الخيار يصل لكل الأجهزة فوراً
do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.almaher_settings';
  exception when duplicate_object then null;
  end;
end $$;
