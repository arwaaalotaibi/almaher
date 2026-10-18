-- ============================================================
--  الماهر v23 — 📏 وحدات الخطة + 🗂️ تعديل الخطة خلال الفصل في نقاط السباق
--  - almaher_plan_at(plan, date): الخطة السارية في تاريخ اللقاء (من plan.history)
--  - المقرر لكل لقاء: المحفوظ مع السجلّ (faces.req_tasmi / req_muraja) وإلا أوجه الخطة السارية
--  - الإلغاء (off) من الخطة السارية في اللقاء نفسه
--  لا يغيّر أي بيانات — الطالبات بلا تعديل خطة ولا وحدة: النتيجة كما في v18 تماماً.
--  آمن لإعادة التشغيل.
-- ============================================================
begin;

-- 🗂️ الخطة السارية في تاريخ لقاء: أقدم نسخة في plan.history لم يحن «until» فيها، وإلا الحالية.
-- حقول النسخة تُستبدل كلها (الغائب منها = افتراضي)، كـ planAt في التطبيق
create or replace function public.almaher_plan_at(p jsonb, d date)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    (select (p - array['hifz','tathbit','murajaah','hifzUnit','murUnit','tathbitSessions','off',
                       'direction','murDirection','startSurah','startAyah','murStartSurah','murStartAyah'])
            || (v - 'until' - 'savedAt')
       from jsonb_array_elements(coalesce(p -> 'history', '[]'::jsonb)) v
      where d < (v ->> 'until')::date
      order by v ->> 'until'
      limit 1),
    p)
$$;

drop function if exists public.almaher_race(text, date);
drop function if exists public.almaher_race(text, date, text);
create function public.almaher_race(p_mosque text default null, p_since date default null, p_halaqa text default null)
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
    select s.id, s.name, s.plan, h.mosque, nullif(h.term_start, '')::date as term_start,
           h.mosque || case when h.day <> '' then ' — ' || h.day else '' end as halaqa_label
    from public.almaher_students s
    join public.almaher_halaqas h on h.id = s.halaqa_id
    where (p_mosque is null or h.mosque = p_mosque)
      and (p_halaqa is null or h.id = p_halaqa)  -- 🕌 حلقة واحدة (مسجد البحر الاثنين ≠ الأربعاء)
      and (s.plan ->> 'withdrawnAt') is null  -- 🚪 المنسحبات خارج السباق
  ),
  -- اللقاءات الحاضرة مع أوجه حفظ آخر ١–٣ لقاءات حاضرة قبلها (مقرر التثبيت بحسب الخطة)
  rows_att as (
    select r.student_id, r.log_date,
           public.almaher_plan_at(b.plan, r.log_date) as pa,  -- 🗂️ الخطة السارية في هذا اللقاء
           (r.faces ->> 'req_tasmi')::numeric  as req_t,      -- 📏 مطلوبه بالأوجه حين سُجّل
           (r.faces ->> 'req_muraja')::numeric as req_m,
           coalesce((r.faces ->> 'tasmi')::numeric, 0)   as f_tasmi,
           coalesce((r.faces ->> 'tathbit')::numeric, 0) as f_tathbit,
           coalesce((r.faces ->> 'muraja')::numeric, 0)  as f_muraja,
           coalesce(lag(coalesce((r.faces ->> 'tasmi')::numeric, 0), 1)
             over w, 0)
           + case when coalesce(b.plan ->> 'tathbitSessions', '1') in ('2', '3')
                  then coalesce(lag(coalesce((r.faces ->> 'tasmi')::numeric, 0), 2) over w, 0) else 0 end
           + case when coalesce(b.plan ->> 'tathbitSessions', '1') = '3'
                  then coalesce(lag(coalesce((r.faces ->> 'tasmi')::numeric, 0), 3) over w, 0) else 0 end
             as prev_tasmi,
           -- أول لقاء حاضر في الفصل (لا حفظ سابق يُثبَّت)
           r.log_date = min(case when r.log_date >= coalesce(b.term_start, date '1900-01-01') then r.log_date end)
             over (partition by r.student_id) as is_first
    from public.almaher_sessions r
    join base b on b.id = r.student_id
    where r.attended
    window w as (partition by r.student_id order by r.log_date, r.created_at)
  ),
  -- 🚫 الأقسام الملغاة والمقرر — من الخطة السارية في كل لقاء (تعديل الخطة خلال الفصل لا يغيّر ما مضى)
  rows_req as (
    select x.*,
           coalesce((x.pa -> 'off' ->> 'hifz')::boolean, false) as off_h,
           coalesce((x.pa -> 'off' ->> 'tathbit')::boolean, false)
             or coalesce((x.pa -> 'off' ->> 'hifz')::boolean, false) as off_t,
           coalesce((x.pa -> 'off' ->> 'murajaah')::boolean, false) as off_m,
           -- المقرر بالأوجه: المحفوظ مع السجلّ، وإلا أوجه الخطة (للوحدة «وجه» فقط)
           coalesce(x.req_t, case when coalesce(x.pa ->> 'hifzUnit', 'face') = 'face'
                                  then round(coalesce((x.pa ->> 'hifz')::numeric, 0) * 4) / 4 else 0 end) as q_h,
           coalesce(x.req_m, case when coalesce(x.pa ->> 'murUnit', 'face') = 'face'
                                  then round(coalesce((x.pa ->> 'murajaah')::numeric, 0) * 4) / 4 else 0 end) as q_m
    from rows_att x
  ),
  sess as (
    select x.student_id,
           count(*) as attends,
           sum(x.f_tasmi) as f_tasmi,
           sum(case when x.off_h
                     or (x.f_tasmi > 0 and x.f_tasmi >= x.q_h) then 1 else 0 end) as hifz_done,
           sum(case when not coalesce(x.is_first, false)
                     and (x.off_t
                          or (x.f_tathbit > 0
                              and x.f_tathbit >= x.prev_tasmi)) then 1 else 0 end) as tathbit_done,
           sum(case when x.off_m
                     or (x.f_muraja > 0 and x.f_muraja >= x.q_m) then 1 else 0 end) as mur_done,
           sum(case when not x.off_h
                     and x.q_h > 0
                     and x.f_tasmi > x.q_h then 1 else 0 end) as hifz_extra
    from rows_req x
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
revoke all on function public.almaher_race(text, date, text) from public;
grant execute on function public.almaher_race(text, date, text) to authenticated;
commit;
