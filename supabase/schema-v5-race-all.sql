-- ============================================================
--  الماهر — السباق على مستوى كل المساجد (إضافة إلى مستوى المسجد)
--  يُشغَّل بعد schema-v4-settings.sql. آمن لإعادة التشغيل.
--
--  الطالبة ترى أسماء كل الطالبات (اسم وحلقة فقط — بلا هاتف ولا خطة ولا رمز)
--  وسجلات التسميع والقراءة والتجويد للجميع للقراءة فقط (لحساب النقاط).
--  الكتابة تبقى محصورة في صفّها هي.
-- ============================================================

-- زميلات السباق: كل الطالبات (الاسم والحلقة والمعلّمة والمسار فقط)
drop view if exists public.almaher_peers;
create view public.almaher_peers
with (security_invoker = false)
as
  select s.id, s.name, s.halaqa_id, s.teacher_id, s.track
  from public.almaher_students s
  where public.almaher_role() = 'student';
grant select on public.almaher_peers to authenticated;

-- قراءة سجلات النقاط للجميع (الكتابة للطالبة نفسها فقط — كما هي)
do $$
declare t text;
begin
  foreach t in array array['almaher_sessions','almaher_reading_progress','almaher_tajweed_results'] loop
    execute format('drop policy if exists student_mosque_read on public.%I', t);
    execute format('drop policy if exists student_all_read on public.%I', t);
    execute format(
      'create policy student_all_read on public.%I for select to authenticated
         using (public.almaher_role() = ''student'')', t);
  end loop;
end $$;
