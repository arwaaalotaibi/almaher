-- ============================================================
--  الماهر — نقاط السباق بنظام «المقرر المكتمل» بدل النقاط لكل وجه
--  يُشغَّل بعد schema-v8-plan-confirm.sql. آمن لإعادة التشغيل.
--
--  حضور لقاء ١٠ · إتمام مقرر الحفظ ٥ · إتمام مقرر التثبيت ٥ · إتمام مقرر المراجعة ٥
--  · ورد قراءة تمّ ٥ · كل إجابة صحيحة ١ · العلامة الكاملة +٥
--
--  «المقرر» = أوجه الخطة لكل لقاء (plan.hifz / plan.murajaah)،
--  ومقرر التثبيت = أوجه حفظ اللقاء السابق (الحاضر) للطالبة نفسها.
--  يُعدّ القسم مكتملاً إذا سُمّع منه وجه على الأقل وبلغ مقرره.
-- ============================================================

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
    select s.id, s.name, s.plan, h.mosque,
           h.mosque || case when h.day <> '' then ' — ' || h.day else '' end as halaqa_label
    from public.almaher_students s
    join public.almaher_halaqas h on h.id = s.halaqa_id
    where p_mosque is null or h.mosque = p_mosque
  ),
  -- اللقاءات الحاضرة مع أوجه حفظ اللقاء السابق (مقرر التثبيت)
  rows_att as (
    select r.student_id, r.log_date,
           coalesce((r.faces ->> 'tasmi')::numeric, 0)   as f_tasmi,
           coalesce((r.faces ->> 'tathbit')::numeric, 0) as f_tathbit,
           coalesce((r.faces ->> 'muraja')::numeric, 0)  as f_muraja,
           coalesce(lag(coalesce((r.faces ->> 'tasmi')::numeric, 0))
             over (partition by r.student_id order by r.log_date, r.created_at), 0) as prev_tasmi
    from public.almaher_sessions r
    where r.attended
  ),
  sess as (
    select x.student_id,
           count(*) as attends,
           sum(x.f_tasmi) as f_tasmi,
           sum(case when x.f_tasmi > 0
                     and x.f_tasmi >= round(coalesce((b.plan ->> 'hifz')::numeric, 0)) then 1 else 0 end) as hifz_done,
           sum(case when x.f_tathbit > 0
                     and x.f_tathbit >= x.prev_tasmi then 1 else 0 end) as tathbit_done,
           sum(case when x.f_muraja > 0
                     and x.f_muraja >= round(coalesce((b.plan ->> 'murajaah')::numeric, 0)) then 1 else 0 end) as mur_done
    from rows_att x
    join base b on b.id = x.student_id
    where p_since is null or x.log_date >= p_since
    group by x.student_id
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
            + (coalesce(sess.hifz_done, 0) + coalesce(sess.tathbit_done, 0) + coalesce(sess.mur_done, 0)) * 5
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
