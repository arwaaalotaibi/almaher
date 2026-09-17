-- ============================================================
--  الماهر — الطالبة تقرأ سجلّ تسميعها دائماً
--  يُشغَّل بعد schema-v9-points-muqarrar.sql. آمن لإعادة التشغيل.
--
--  الخلل: سياسة student_own_write (v4) كانت «for all» مشروطة بخيار
--  «الطالبة تسجّل بنفسها»، فلمّا صار التسجيل للإدارة فقط صارت الطالبة
--  لا تقرأ حتى سجلاتها، فتظهر «رحلتي» فارغة رغم اعتماد اللقاء.
-- ============================================================

-- ١) القراءة: سجلاتها هي دائماً
drop policy if exists student_own_read on public.almaher_sessions;
create policy student_own_read on public.almaher_sessions for select to authenticated
  using (public.almaher_role() = 'student' and student_id = public.almaher_my_student());

-- ٢) الكتابة (إضافة/تعديل/حذف): سجلاتها هي، وفقط إن كان الخيار مفعّلاً
drop policy if exists student_own_write on public.almaher_sessions;
drop policy if exists student_own_insert on public.almaher_sessions;
create policy student_own_insert on public.almaher_sessions for insert to authenticated
  with check (public.almaher_role() = 'student' and student_id = public.almaher_my_student()
              and public.almaher_student_recite_enabled());
drop policy if exists student_own_update on public.almaher_sessions;
create policy student_own_update on public.almaher_sessions for update to authenticated
  using (public.almaher_role() = 'student' and student_id = public.almaher_my_student()
         and public.almaher_student_recite_enabled())
  with check (public.almaher_role() = 'student' and student_id = public.almaher_my_student()
              and public.almaher_student_recite_enabled());
drop policy if exists student_own_delete on public.almaher_sessions;
create policy student_own_delete on public.almaher_sessions for delete to authenticated
  using (public.almaher_role() = 'student' and student_id = public.almaher_my_student()
         and public.almaher_student_recite_enabled());

-- ٣) للتأكد
select policyname, cmd from pg_policies where tablename = 'almaher_sessions' order by policyname;
