-- ============================================================
--  الماهر — تأكيد خطة الفصل من الطالبة (مرة كل فصل) مع تعديل واحد فقط
--  يُشغَّل بعد schema-v7-quotes.sql. آمن لإعادة التشغيل.
--
--  - الخطة ما زالت مقفلة على الطالبات (schema-v3)، والسماح الوحيد عبر
--    الدالة الآمنة almaher_confirm_plan التي ترفع علماً مؤقتاً للجلسة.
--  - «الخطة صحيحة»: تُسجَّل confirmedTerm/confirmedAt داخل plan.
--  - «تعديل الخطة»: مرة واحدة لكل فصل (studentEditedTerm)، وتُحفظ الخطة
--    القديمة في planBeforeEdit حتى تراها الإدارة.
-- ============================================================

-- ١) القفل يتجاهل التعديل القادم من الدالة الآمنة فقط
create or replace function public.almaher_protect_student_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.almaher_role() = 'student'
     and coalesce(current_setting('almaher.allow_plan', true), '') <> '1' then
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

-- ٢) تأكيد الخطة (p_edit = null) أو تعديلها مرة واحدة (p_edit = الحقول الجديدة)
create or replace function public.almaher_confirm_plan(p_edit jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sid  text;
  term text;
  cur  jsonb;
  nxt  jsonb;
  allowed text[] := array['hifz','murajaah','direction','murDirection',
                          'startSurah','startAyah','murStartSurah','murStartAyah'];
begin
  sid := public.almaher_my_student();
  if sid is null or public.almaher_role() <> 'student' then
    raise exception 'not a student';
  end if;

  select coalesce(h.term_start::text, ''), coalesce(s.plan, '{}'::jsonb)
    into term, cur
  from public.almaher_students s
  left join public.almaher_halaqas h on h.id = s.halaqa_id
  where s.id = sid;

  if term = '' then
    raise exception 'no term';
  end if;

  nxt := cur;
  if p_edit is not null then
    if cur ->> 'studentEditedTerm' = term then
      raise exception 'already edited';
    end if;
    nxt := nxt || coalesce(
      (select jsonb_object_agg(key, value) from jsonb_each(p_edit) where key = any(allowed)),
      '{}'::jsonb
    );
    nxt := nxt || jsonb_build_object(
      'studentEditedTerm', term,
      'studentEditedAt', now(),
      'planBeforeEdit', cur - 'planBeforeEdit'
    );
  end if;
  nxt := nxt || jsonb_build_object('confirmedTerm', term, 'confirmedAt', now());

  perform set_config('almaher.allow_plan', '1', true);
  update public.almaher_students set plan = nxt, updated_at = now() where id = sid;
  perform set_config('almaher.allow_plan', '', true);
  return nxt;
end $$;
revoke all on function public.almaher_confirm_plan(jsonb) from public;
grant execute on function public.almaher_confirm_plan(jsonb) to authenticated;
