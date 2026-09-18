-- ============================================================
--  الماهر v11 — استثناء المنسحبات من سباق الحلقات (RPC almaher_race)
--  نفس دالة v9 مع شرط واحد إضافي: plan->>'withdrawnAt' فارغ. آمن لإعادة التشغيل.
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
    where (p_mosque is null or h.mosque = p_mosque)
      and (s.plan ->> 'withdrawnAt') is null  -- 🚪 المنسحبات خارج السباق
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
                     and x.f_muraja >= round(coalesce((b.plan ->> 'murajaah')::numeric, 0)) then 1 else 0 end) as mur_done,
           sum(case when round(coalesce((b.plan ->> 'hifz')::numeric, 0)) > 0
                     and x.f_tasmi > round(coalesce((b.plan ->> 'hifz')::numeric, 0)) then 1 else 0 end) as hifz_extra
    from rows_att x
    join base b on b.id = x.student_id
    where p_since is null or x.log_date >= p_since
    group by x.student_id
  ),
  scored as (
    select b.id, b.name, b.halaqa_label, b.mosque,
           (coalesce(sess.attends, 0) * 10
            + (coalesce(sess.hifz_done, 0) + coalesce(sess.tathbit_done, 0)
               + coalesce(sess.mur_done, 0) + coalesce(sess.hifz_extra, 0)) * 5)::integer as points,
           coalesce(sess.f_tasmi, 0) as faces,
           coalesce(sess.attends, 0)::integer as attends
    from base b
    left join sess on sess.student_id = b.id
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
