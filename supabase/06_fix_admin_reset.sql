begin;

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

  delete from public.subject_completion_requests where id is not null;
  delete from public.exams where id is not null;
  delete from public.study_sessions where id is not null;
  delete from public.schedule_changes where id is not null;
  delete from public.notes where id is not null;
  delete from public.chapter_progress where id is not null;
end;
$$;

revoke all on function public.admin_reset_all_learning_data() from public;
grant execute on function public.admin_reset_all_learning_data() to authenticated;

commit;

select 'تم إصلاح التصفير الشامل' as result;
