-- ============================================================
--  الماهر — اقتباسات الكتب: الطالبة تنشر اقتباساً من كتاب وتُعجب
--  الزميلات به (نظام منتدى مصغّر). يُشغَّل بعد schema-v6-race-top10.sql.
--  آمن لإعادة التشغيل.
--
--  - النشر فوري باسم الطالبة، والإدارة/المعلّمة تحذف أي اقتباس.
--  - الطالبة تحذف اقتباسها هي فقط، وتُعجب مرة واحدة بكل اقتباس.
--  - الأسماء تصل عبر دالة آمنة (almaher_quotes) لا عبر جدول الطالبات.
-- ============================================================

-- ١) الجداول
create table if not exists public.almaher_quotes (
  id         text primary key,
  book_id    text not null,
  student_id text not null,
  body       text not null default '',
  page       integer,
  created_at timestamptz not null default now()
);
create index if not exists almaher_quotes_book_idx on public.almaher_quotes (book_id, created_at desc);

create table if not exists public.almaher_quote_likes (
  quote_id   text not null references public.almaher_quotes (id) on delete cascade,
  student_id text not null,
  created_at timestamptz not null default now(),
  primary key (quote_id, student_id)
);

alter table public.almaher_quotes enable row level security;
alter table public.almaher_quote_likes enable row level security;

-- ٢) السياسات
-- الإدارة والمعلّمات: كل شيء
drop policy if exists staff_all on public.almaher_quotes;
create policy staff_all on public.almaher_quotes for all to authenticated
  using (public.almaher_role() in ('admin', 'teacher'))
  with check (public.almaher_role() in ('admin', 'teacher'));
drop policy if exists staff_all on public.almaher_quote_likes;
create policy staff_all on public.almaher_quote_likes for all to authenticated
  using (public.almaher_role() in ('admin', 'teacher'))
  with check (public.almaher_role() in ('admin', 'teacher'));

-- الطالبة: تقرأ كل الاقتباسات (بلا أسماء — الأسماء من الدالة)، تنشر باسمها، تحذف اقتباسها فقط
drop policy if exists student_read on public.almaher_quotes;
create policy student_read on public.almaher_quotes for select to authenticated
  using (public.almaher_role() = 'student');
drop policy if exists student_insert on public.almaher_quotes;
create policy student_insert on public.almaher_quotes for insert to authenticated
  with check (public.almaher_role() = 'student' and student_id = public.almaher_my_student()
              and length(btrim(body)) between 3 and 600);
drop policy if exists student_delete on public.almaher_quotes;
create policy student_delete on public.almaher_quotes for delete to authenticated
  using (public.almaher_role() = 'student' and student_id = public.almaher_my_student());

-- الإعجابات: تقرأ الكل، وتضيف/تحذف إعجابها هي فقط
drop policy if exists student_read on public.almaher_quote_likes;
create policy student_read on public.almaher_quote_likes for select to authenticated
  using (public.almaher_role() = 'student');
drop policy if exists student_own_write on public.almaher_quote_likes;
create policy student_own_write on public.almaher_quote_likes for all to authenticated
  using (public.almaher_role() = 'student' and student_id = public.almaher_my_student())
  with check (public.almaher_role() = 'student' and student_id = public.almaher_my_student());

-- ٣) الدالة: الاقتباسات مع اسم صاحبتها وحلقتها وعدد الإعجابات وهل أعجبتني
create or replace function public.almaher_quotes(p_book text default null)
returns table (
  id           text,
  book_id      text,
  book_title   text,
  student_id   text,
  name         text,
  halaqa_label text,
  body         text,
  page         integer,
  created_at   timestamptz,
  likes        integer,
  liked        boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select public.almaher_my_student() as id)
  select q.id, q.book_id, coalesce(b.title, '') as book_title,
         q.student_id, coalesce(s.name, 'طالبة') as name,
         coalesce(h.mosque || case when h.day <> '' then ' — ' || h.day else '' end, '') as halaqa_label,
         q.body, q.page, q.created_at,
         (select count(*) from public.almaher_quote_likes l where l.quote_id = q.id)::integer as likes,
         exists (select 1 from public.almaher_quote_likes l, me where l.quote_id = q.id and l.student_id = me.id) as liked
  from public.almaher_quotes q
  left join public.almaher_books b on b.id = q.book_id
  left join public.almaher_students s on s.id = q.student_id
  left join public.almaher_halaqas h on h.id = s.halaqa_id
  where public.almaher_role() is not null
    and (p_book is null or q.book_id = p_book)
  order by q.created_at desc
  limit 300
$$;
revoke all on function public.almaher_quotes(text) from public;
grant execute on function public.almaher_quotes(text) to authenticated;

-- ٤) التحديث اللحظي
do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.almaher_quotes';
  exception when duplicate_object then null; end;
  begin
    execute 'alter publication supabase_realtime add table public.almaher_quote_likes';
  exception when duplicate_object then null; end;
end $$;
