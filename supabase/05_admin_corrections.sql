begin;

create or replace function public.admin_delete_study_session(target_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  ) then
    raise exception 'هذه العملية متاحة للمدير فقط';
  end if;

  delete from public.study_sessions where id = target_session_id;
end;
$$;

create or replace function public.admin_delete_exam(target_exam_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  ) then
    raise exception 'هذه العملية متاحة للمدير فقط';
  end if;

  delete from public.exams where id = target_exam_id;
end;
$$;

create or replace function public.admin_reset_chapter_progress(target_chapter_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_subject_id uuid;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  ) then
    raise exception 'هذه العملية متاحة للمدير فقط';
  end if;

  select subject_id into target_subject_id
  from public.chapters
  where id = target_chapter_id;

  delete from public.subject_completion_requests
  where subject_id = target_subject_id;

  delete from public.chapter_progress
  where chapter_id = target_chapter_id;
end;
$$;

create or replace function public.admin_reset_all_learning_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  ) then
    raise exception 'هذه العملية متاحة للمدير فقط';
  end if;

  delete from public.subject_completion_requests;
  delete from public.exams;
  delete from public.study_sessions;
  delete from public.schedule_changes;
  delete from public.notes;
  delete from public.chapter_progress;
end;
$$;

revoke all on function public.admin_delete_study_session(uuid) from public;
revoke all on function public.admin_delete_exam(uuid) from public;
revoke all on function public.admin_reset_chapter_progress(uuid) from public;
revoke all on function public.admin_reset_all_learning_data() from public;

grant execute on function public.admin_delete_study_session(uuid) to authenticated;
grant execute on function public.admin_delete_exam(uuid) to authenticated;
grant execute on function public.admin_reset_chapter_progress(uuid) to authenticated;
grant execute on function public.admin_reset_all_learning_data() to authenticated;

commit;

select 'تمت إضافة أدوات تصحيح المدير' as result;
