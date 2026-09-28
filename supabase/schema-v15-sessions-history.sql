-- ============================================================
--  الماهر v15 — 🗂️ أرشيف سجلات التسميع (حماية من الحذف والتعديل الخاطئ)
--  قبل أي حذف أو تعديل لسجلّ في almaher_sessions تُحفظ نسخته القديمة في
--  almaher_sessions_history مع: نوع العملية، ووقتها، ومن قام بها (الإدارة / اسم المعلّمة / الطالبة).
--  يعمل في قاعدة البيانات نفسها — مهما كانت الشاشة أو الجهاز. تقرؤه الإدارة فقط،
--  ومنه تسترجع السجل من صفحة «🗂️ أرشيف السجلات». آمن لإعادة التشغيل.
-- ============================================================

create table if not exists public.almaher_sessions_history (
  hid         bigserial primary key,
  op          text        not null,                 -- 'delete' | 'update'
  changed_at  timestamptz not null default now(),
  changed_by  uuid,                                  -- auth.uid() لمن قام بالعملية
  actor       text        not null default '',       -- «الإدارة» / اسم المعلّمة / «الطالبة»
  session_id  text        not null,
  student_id  text        not null,
  log_date    date        not null,
  attended    boolean     not null,
  parts       jsonb       not null default '{}'::jsonb,
  faces       jsonb       not null default '{}'::jsonb,
  note        text        not null default '',
  created_at  timestamptz                            -- وقت إنشاء السجل الأصلي
);
create index if not exists almaher_sessions_history_changed_idx
  on public.almaher_sessions_history (changed_at desc);
create index if not exists almaher_sessions_history_student_idx
  on public.almaher_sessions_history (student_id, log_date);

alter table public.almaher_sessions_history enable row level security;
drop policy if exists admin_read on public.almaher_sessions_history;
create policy admin_read on public.almaher_sessions_history for select to authenticated
  using (public.almaher_role() = 'admin');
-- لا كتابة مباشرة لأحد: يكتب فيه المشغّل (trigger) وحده
revoke insert, update, delete on public.almaher_sessions_history from anon, authenticated;
grant select on public.almaher_sessions_history to authenticated;

create or replace function public.almaher_sessions_archive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  who text;
begin
  -- تعديل لم يغيّر شيئاً (نفس المقطع والحضور والملاحظة) — لا نحفظه
  if tg_op = 'UPDATE'
     and new.log_date = old.log_date
     and new.attended = old.attended
     and new.parts = old.parts
     and new.note = old.note
     and coalesce(new.faces, '{}'::jsonb) = coalesce(old.faces, '{}'::jsonb) then
    return new;
  end if;

  select case
    when (auth.jwt() ->> 'email') = 'almaher@almahr.org' then 'الإدارة'
    when (auth.jwt() ->> 'email') = 'muallima@almahr.org' then 'حساب المعلّمات'
    else coalesce(
      (select 'المعلّمة ' || t.name
         from public.almaher_teacher_devices d
         join public.almaher_teachers t on t.id = d.teacher_id
        where d.uid = auth.uid() limit 1),
      (select 'الطالبة' from public.almaher_student_devices where uid = auth.uid() limit 1),
      case when auth.uid() is null then 'النظام' else 'غير معروف' end)
  end into who;

  insert into public.almaher_sessions_history
    (op, changed_by, actor, session_id, student_id, log_date, attended, parts, faces, note, created_at)
  values
    (lower(tg_op), auth.uid(), who, old.id, old.student_id, old.log_date, old.attended,
     old.parts, coalesce(old.faces, '{}'::jsonb), old.note, old.created_at);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists almaher_sessions_archive on public.almaher_sessions;
create trigger almaher_sessions_archive
  before update or delete on public.almaher_sessions
  for each row execute function public.almaher_sessions_archive();
