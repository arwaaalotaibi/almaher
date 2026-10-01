-- ============================================================
--  الماهر v20 — 🌟 «الماهرات»: النجمة تُحسب من اللقاء الرابع فقط (قرار الإدارة)
--  الشرط: تاريخ اللقاء ≥ بداية الفصل + ٢١ يوماً — اللقاء الثالث لا يتجاوز البداية + ٢٠،
--  والرابع لا يسبق البداية + ٢١. بقية v19 كما هي. آمن لإعادة التشغيل.
-- ============================================================

create or replace function public.almaher_stars(p_halaqa text default null, p_since date default null)
returns table (
  student_id   text,
  name         text,
  halaqa_label text,
  stars        integer
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.name,
         h.mosque || case when h.day <> '' then ' — ' || h.day else '' end,
         count(*)::integer
  from public.almaher_sessions r
  join public.almaher_students s on s.id = r.student_id
  join public.almaher_halaqas h on h.id = s.halaqa_id
  where public.almaher_role() is not null
    and r.attended
    and (r.parts ->> 'star') = 'true'
    and (s.plan ->> 'withdrawnAt') is null
    and (p_halaqa is null or h.id = p_halaqa)
    and (p_since is null or r.log_date >= p_since)
    and r.log_date >= nullif(h.term_start, '')::date + 21  -- ⭐ من اللقاء الرابع
  group by s.id, s.name, h.mosque, h.day
  order by count(*) desc, s.name
$$;
revoke all on function public.almaher_stars(text, date) from public;
grant execute on function public.almaher_stars(text, date) to authenticated;
