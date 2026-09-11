-- ============================================================
--  الماهر — السباق: الطالبة لا ترى إلا العشر الأوائل (وترتيبها هي)
--  يُشغَّل بعد schema-v5-race-all.sql. آمن لإعادة التشغيل.
--
--  الترتيب يُحسب داخل قاعدة البيانات بدالة آمنة تعيد العشر الأوائل فقط
--  + صف الطالبة نفسها. لا تصل أي بيانات عن بقية الطالبات إلى جهازها.
-- ============================================================

-- ١) إلغاء ما كان يكشف قوائم الطالبات وسجلاتهن
drop view if exists public.almaher_race_sessions;
drop view if exists public.almaher_peers;
do $$
declare t text;
begin
  foreach t in array array['almaher_reading_progress','almaher_tajweed_results'] loop
    execute format('drop policy if exists student_all_read on public.%I', t);
  end loop;
end $$;

-- ٢) دالة السباق: نفس صيغة النقاط المعلنة في التطبيق
--    حضور ١٠ · وجه حفظ ٥ · وجه تثبيت ٢ · وجه مراجعة ١ · ورد قراءة تمّ ٥
--    · كل إجابة صحيحة ١ · العلامة الكاملة +٥
create or replace function public.almaher_race(p_mosque text default null, p_since date default null)
returns table (
  student_id   text,
  name         text,
  halaqa_label text,
  mosque       text,
  points       integer,
  faces        numeric,
  attends      integer,
  rank         integer
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select public.almaher_my_student() as id),
  base as (
    select s.id, s.name, h.mosque,
           h.mosque || case when h.day <> '' then ' — ' || h.day else '' end as halaqa_label
    from public.almaher_students s
    join public.almaher_halaqas h on h.id = s.halaqa_id
    where p_mosque is null or h.mosque = p_mosque
  ),
  sess as (
    select r.student_id,
           count(*) filter (where r.attended) as attends,
           coalesce(sum((r.faces ->> 'tasmi')::numeric), 0)   as f_tasmi,
           coalesce(sum((r.faces ->> 'tathbit')::numeric), 0) as f_tathbit,
           coalesce(sum((r.faces ->> 'muraja')::numeric), 0)  as f_muraja
    from public.almaher_sessions r
    where p_since is null or r.log_date >= p_since
    group by r.student_id
  ),
  rd as (
    select p.student_id,
           sum(case when p.done then 5 else 0 end
               + coalesce(p.score, 0)
               + case when p.total > 0 and p.score = p.total then 5 else 0 end) as pts
    from public.almaher_reading_progress p
    where p_since is null or p.updated_at::date >= p_since
    group by p.student_id
  ),
  tj as (
    select t.student_id,
           sum(t.score + case when t.total > 0 and t.score = t.total then 5 else 0 end) as pts
    from public.almaher_tajweed_results t
    where p_since is null or t.answered_at::date >= p_since
    group by t.student_id
  ),
  scored as (
    select b.id, b.name, b.halaqa_label, b.mosque,
           (coalesce(sess.attends, 0) * 10
            + coalesce(sess.f_tasmi, 0) * 5
            + coalesce(sess.f_tathbit, 0) * 2
            + coalesce(sess.f_muraja, 0) * 1
            + coalesce(rd.pts, 0) + coalesce(tj.pts, 0))::integer as points,
           coalesce(sess.f_tasmi, 0) as faces,
           coalesce(sess.attends, 0)::integer as attends
    from base b
    left join sess on sess.student_id = b.id
    left join rd on rd.student_id = b.id
    left join tj on tj.student_id = b.id
  ),
  ranked as (
    select *, rank() over (order by points desc) as rank
    from scored
  )
  select r.id, r.name, r.halaqa_label, r.mosque, r.points, r.faces, r.attends, r.rank::integer
  from ranked r, me
  where public.almaher_role() is not null
    and (r.rank <= 10 or r.id = me.id)
  order by r.rank, r.name
$$;
revoke all on function public.almaher_race(text, date) from public;
grant execute on function public.almaher_race(text, date) to authenticated;
