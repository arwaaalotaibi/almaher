-- ============================================================
--  الماهر — السباق على مستوى كل المساجد مع حفظ خصوصية الطالبات
--  يُشغَّل بعد schema-v4-settings.sql. آمن لإعادة التشغيل.
--
--  ما تراه الطالبة عن غيرها: الاسم والحلقة فقط + أرقام النقاط
--  (حضور وعدد أوجه مكتملة، درجات القراءة والتجويد).
--  لا خطط، لا مقاطع تسميع (سورة/آية)، لا هاتف، لا رموز.
-- ============================================================

-- ١) عدد الأوجه المكتملة يُحفظ رقماً مع كل سجلّ (تحسبه الإدارة عند التسجيل)
alter table public.almaher_sessions
  add column if not exists faces jsonb not null default '{}'::jsonb;

-- ٢) حذف السياسات القديمة المعتمدة على عرض زميلات المسجد
do $$
declare t text;
begin
  foreach t in array array['almaher_sessions','almaher_reading_progress','almaher_tajweed_results'] loop
    execute format('drop policy if exists student_mosque_read on public.%I', t);
    execute format('drop policy if exists student_all_read on public.%I', t);
  end loop;
end $$;

-- ٣) زميلات السباق: كل الطالبات — الاسم والحلقة والمعلّمة والمسار فقط
create or replace view public.almaher_peers
with (security_invoker = false)
as
  select s.id, s.name, s.halaqa_id, s.teacher_id, s.track
  from public.almaher_students s
  where public.almaher_role() = 'student';
grant select on public.almaher_peers to authenticated;

-- ٤) سجلات التسميع: الطالبة تقرأ سجلاتها هي فقط (سياسة student_own_write القائمة).
--    ولحساب السباق: عرض «خفيف» لكل السجلات بلا أي مقطع — حضور وأرقام أوجه فقط
create or replace view public.almaher_race_sessions
with (security_invoker = false)
as
  select r.id, r.student_id, r.log_date, r.attended, r.faces
  from public.almaher_sessions r
  where public.almaher_role() = 'student';
grant select on public.almaher_race_sessions to authenticated;

-- ٥) درجات القراءة والتجويد (أرقام فقط) تُقرأ للجميع لحساب النقاط
do $$
declare t text;
begin
  foreach t in array array['almaher_reading_progress','almaher_tajweed_results'] loop
    execute format(
      'create policy student_all_read on public.%I for select to authenticated
         using (public.almaher_role() = ''student'')', t);
  end loop;
end $$;
