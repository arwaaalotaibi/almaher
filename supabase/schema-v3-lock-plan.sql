-- ============================================================
--  الماهر — قفل خطة الطالبة: الإدارة/المعلّمات وحدهنّ يعدّلن الخطة والبيانات الأساسية
--  يُشغَّل بعد schema-v2-auth.sql. آمن لإعادة التشغيل.
--
--  الطالبة ما زالت تعدّل صفّها (إقرار اللائحة، آخر ظهور، الأهداف القديمة)،
--  لكن أي تغيير منها على الخطة أو الاسم أو الحلقة أو المعلّمة أو الملاحظة
--  أو الهاتف يُتجاهل بهدوء ويبقى ما أدخلته الإدارة.
-- ============================================================

create or replace function public.almaher_protect_student_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.almaher_role() = 'student' then
    new.plan       := old.plan;
    new.name       := old.name;
    new.halaqa_id  := old.halaqa_id;
    new.teacher_id := old.teacher_id;
    new.track      := old.track;
    new.note       := old.note;
    new.phone      := old.phone;
  end if;
  return new;
end $$;

drop trigger if exists almaher_protect_student_row on public.almaher_students;
create trigger almaher_protect_student_row
  before update on public.almaher_students
  for each row execute function public.almaher_protect_student_row();
