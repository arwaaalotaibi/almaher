-- ============================================================
--  الماهر — مخطط قاعدة البيانات الكامل لمشروع Supabase جديد
--  يُشغَّل مرة واحدة في: SQL Editor → New query → Run
--  آمن لإعادة التشغيل (if not exists / or replace / drop policy if exists)
-- ============================================================

-- ---------- الدور من بريد حساب الدخول (ثلاثة حسابات ثابتة) ----------
create or replace function public.almaher_role()
returns text
language sql
stable
as $$
  select case (auth.jwt() ->> 'email')
    when 'almaher@almahr.org'  then 'admin'
    when 'muallima@almahr.org' then 'teacher'
    when 'taliba@almahr.org'   then 'student'
    else null
  end
$$;

-- ============================ الجداول ============================

-- الحلقات
create table if not exists public.almaher_halaqas (
  id            text primary key,
  mosque        text not null default '',
  day           text not null default '',
  term_start    text not null default '',   -- yyyy-mm-dd
  term_sessions integer not null default 0,
  sard_date     text not null default '',   -- 🎙️ يوم السرد القرآني
  exam_date     text not null default '',   -- 🏁 يوم الاختبار
  created_at    timestamptz not null default now()
);

-- المعلّمات
create table if not exists public.almaher_teachers (
  id         text primary key,
  name       text not null default '',
  halaqa_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- الطالبات
create table if not exists public.almaher_students (
  id             text primary key,
  name           text not null default '',
  halaqa_id      text not null default '',
  teacher_id     text not null default '',
  code           text not null default '',   -- رمز الدخول (٦ أرقام)
  track          text not null default 'hifz',
  plan           jsonb not null default '{}'::jsonb,
  sessions       jsonb not null default '[]'::jsonb,
  goals          jsonb not null default '{}'::jsonb,
  done           jsonb not null default '{}'::jsonb,
  note           text not null default '',
  phone          text not null default '',
  updated_at     timestamptz not null default now(),
  agreed_at      timestamptz,
  agreed_version text not null default '',
  last_seen      timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists almaher_students_code_idx on public.almaher_students (code);
create index if not exists almaher_students_halaqa_idx on public.almaher_students (halaqa_id);

-- الإشعارات
create table if not exists public.almaher_announcements (
  id         text primary key,
  body       text not null default '',
  halaqa_id  text not null default '',       -- '' = لكل الحلقات
  created_at timestamptz not null default now(),
  pinned     boolean not null default false,
  type       text not null default 'general',
  show_at    timestamptz,
  expires_at timestamptz
);

-- قراءة الإشعارات
create table if not exists public.almaher_notif_reads (
  announcement_id text not null,
  student_id      text not null,
  read_at         timestamptz not null default now(),
  primary key (announcement_id, student_id)
);

-- سجلّ التسميع (لقاء واحد لكل صف)
create table if not exists public.almaher_sessions (
  id         text primary key,
  student_id text not null,
  log_date   date not null,
  attended   boolean not null default true,
  parts      jsonb not null default '{}'::jsonb,   -- {tasmi, muraja, tathbit}
  note       text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists almaher_sessions_student_idx on public.almaher_sessions (student_id, log_date desc);

-- كتب القراءة
create table if not exists public.almaher_books (
  id           text primary key,
  title        text not null default '',
  url          text not null default '',
  pages        integer not null default 0,
  img_base     text not null default '',
  reading_plan jsonb,
  created_at   timestamptz not null default now()
);

-- تقدّم أوراد القراءة
create table if not exists public.almaher_reading_progress (
  book_id    text not null,
  segment_id text not null,
  student_id text not null,
  done       boolean not null default false,
  score      integer,
  total      integer,
  updated_at timestamptz not null default now(),
  primary key (book_id, segment_id, student_id)
);

-- دروس التجويد
create table if not exists public.almaher_tajweed (
  id         text primary key,
  title      text not null default '',
  kind       text not null default 'video',
  url        text not null default '',
  questions  jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- نتائج أسئلة التجويد
create table if not exists public.almaher_tajweed_results (
  lesson_id   text not null,
  student_id  text not null,
  score       integer not null default 0,
  total       integer not null default 0,
  answered_at timestamptz not null default now(),
  primary key (lesson_id, student_id)
);

-- تعليقات وخطوط الطالبة على صفحات الكتب
create table if not exists public.almaher_annotations (
  id         text primary key,                 -- studentId:bookId
  student_id text not null,
  book_id    text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- الدعم والاقتراحات
create table if not exists public.almaher_support (
  id         text primary key,
  student_id text not null,
  kind       text not null default 'issue',
  body       text not null default '',
  reply      text not null default '',
  status     text not null default 'new',
  created_at timestamptz not null default now(),
  replied_at timestamptz
);

-- أرشيف الفصول المنتهية
create table if not exists public.almaher_terms (
  id            text primary key,
  halaqa_id     text not null,
  day           text not null default '',
  term_start    text not null default '',
  term_sessions integer not null default 0,
  students      jsonb not null default '[]'::jsonb,
  closed_at     timestamptz not null default now()
);

-- اشتراكات إشعارات الجوال (Web Push) — تُكتب عبر الدوال الآمنة فقط
create table if not exists public.almaher_push_subs (
  endpoint   text primary key,
  p256dh     text not null default '',
  auth       text not null default '',
  student_id text not null default '',
  halaqa_id  text not null default '',
  created_at timestamptz not null default now()
);

-- ============================ الدوال الآمنة ============================

create or replace function public.almaher_save_push_sub(
  p_endpoint text, p_p256dh text, p_auth text, p_sid text, p_halaqa text
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.almaher_push_subs (endpoint, p256dh, auth, student_id, halaqa_id)
  values (p_endpoint, p_p256dh, p_auth, p_sid, p_halaqa)
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth,
        student_id = excluded.student_id, halaqa_id = excluded.halaqa_id;
$$;

create or replace function public.almaher_delete_push_sub(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.almaher_push_subs where endpoint = p_endpoint;
$$;

create or replace function public.almaher_touch_seen(p_sid text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.almaher_students set last_seen = now() where id = p_sid;
$$;

revoke all on function public.almaher_save_push_sub(text, text, text, text, text) from public;
revoke all on function public.almaher_delete_push_sub(text) from public;
revoke all on function public.almaher_touch_seen(text) from public;
grant execute on function public.almaher_save_push_sub(text, text, text, text, text) to authenticated;
grant execute on function public.almaher_delete_push_sub(text) to authenticated;
grant execute on function public.almaher_touch_seen(text) to authenticated;
grant execute on function public.almaher_role() to authenticated, anon;

-- ============================ الحماية (RLS) ============================
-- الإدارة والمعلّمات: كل شيء. الطالبات: قراءة كل الجداول، وكتابة ما يخصّهن فقط.

do $$
declare
  t text;
  all_tables text[] := array[
    'almaher_halaqas','almaher_teachers','almaher_students','almaher_announcements',
    'almaher_notif_reads','almaher_sessions','almaher_books','almaher_reading_progress',
    'almaher_tajweed','almaher_tajweed_results','almaher_annotations','almaher_support',
    'almaher_terms','almaher_push_subs'
  ];
  -- جداول تكتب فيها الطالبة (إضافة/تعديل/حذف)
  student_write text[] := array[
    'almaher_sessions','almaher_notif_reads','almaher_reading_progress',
    'almaher_tajweed_results','almaher_annotations'
  ];
begin
  foreach t in array all_tables loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists staff_all on public.%I', t);
    execute format(
      'create policy staff_all on public.%I for all to authenticated
         using (public.almaher_role() in (''admin'',''teacher''))
         with check (public.almaher_role() in (''admin'',''teacher''))', t);

    -- الطالبة تقرأ كل شيء عدا اشتراكات الإشعارات
    execute format('drop policy if exists student_read on public.%I', t);
    if t <> 'almaher_push_subs' then
      execute format(
        'create policy student_read on public.%I for select to authenticated
           using (public.almaher_role() = ''student'')', t);
    end if;

    execute format('drop policy if exists student_write on public.%I', t);
    if t = any(student_write) then
      execute format(
        'create policy student_write on public.%I for all to authenticated
           using (public.almaher_role() = ''student'')
           with check (public.almaher_role() = ''student'')', t);
    end if;
  end loop;
end $$;

-- الطالبة تعدّل بياناتها (خطتها، إقرار اللائحة) ولا تضيف ولا تحذف
drop policy if exists student_update on public.almaher_students;
create policy student_update on public.almaher_students for update to authenticated
  using (public.almaher_role() = 'student')
  with check (public.almaher_role() = 'student');

-- الطالبة ترسل رسالة دعم ولا تعدّل الردود
drop policy if exists student_insert on public.almaher_support;
create policy student_insert on public.almaher_support for insert to authenticated
  with check (public.almaher_role() = 'student');

-- ============================ التحديث اللحظي ============================
do $$
declare t text;
begin
  foreach t in array array[
    'almaher_halaqas','almaher_teachers','almaher_students','almaher_announcements',
    'almaher_books','almaher_notif_reads','almaher_sessions'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
