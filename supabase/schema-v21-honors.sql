-- ============================================================
--  الماهر v21 — 🏅 متميزة اللقاء + 🏆 لوحة الشرف الشهرية
--  المعلّمة تختار في كل لقاء طالبة واحدة «متميزة» من طالباتها، وفي كل شهر
--  طالبة أو أكثر للوحة الشرف. الإدارة تعرض الأسماء وتطبعها.
--  week : period = تاريخ اللقاء (yyyy-mm-dd) — واحدة لكل معلّمة في الحلقة واللقاء
--  month: period = الشهر (yyyy-mm) — طالبة أو أكثر
--  آمن لإعادة التشغيل.
-- ============================================================

create table if not exists public.almaher_honors (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('week', 'month')),
  period      text not null,
  halaqa_id   text not null,
  teacher_id  text,                 -- من اختارتها (null = الإدارة)
  student_id  text not null references public.almaher_students(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (kind, period, student_id)
);

-- متميزة اللقاء: واحدة فقط لكل معلّمة في كل حلقة وكل لقاء
create unique index if not exists almaher_honors_week_one
  on public.almaher_honors (period, halaqa_id, teacher_id)
  where kind = 'week';

alter table public.almaher_honors enable row level security;

-- الإدارة: كل شيء
drop policy if exists staff_all on public.almaher_honors;
create policy staff_all on public.almaher_honors for all to authenticated
  using (public.almaher_role() = 'admin') with check (public.almaher_role() = 'admin');

-- المعلّمة: تقرأ اختيارات حلقاتها، وتضيف/تحذف اختياراتها هي لطالبات حلقاتها
drop policy if exists teacher_read on public.almaher_honors;
create policy teacher_read on public.almaher_honors for select to authenticated
  using (public.almaher_role() = 'teacher' and halaqa_id in (select public.almaher_teacher_halaqas()));

drop policy if exists teacher_write on public.almaher_honors;
create policy teacher_write on public.almaher_honors for all to authenticated
  using (
    public.almaher_role() = 'teacher'
    and teacher_id is not distinct from public.almaher_my_teacher()
    and halaqa_id in (select public.almaher_teacher_halaqas())
  )
  with check (
    public.almaher_role() = 'teacher'
    and teacher_id is not distinct from public.almaher_my_teacher()
    and halaqa_id in (select public.almaher_teacher_halaqas())
    and student_id in (select id from public.almaher_students where halaqa_id = almaher_honors.halaqa_id)
  );
