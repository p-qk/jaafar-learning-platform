-- إيقاف جلسات الدراسة مؤقتًا واستئنافها، مع صلاحيات للطالب والمدير.

alter table public.study_sessions
  add column if not exists paused_at timestamptz,
  add column if not exists pause_reason text,
  add column if not exists paused_by uuid references public.profiles(id) on delete set null,
  add column if not exists total_paused_seconds integer not null default 0;

alter table public.study_sessions
  drop constraint if exists study_sessions_pause_reason_length;

alter table public.study_sessions
  add constraint study_sessions_pause_reason_length
  check (pause_reason is null or char_length(pause_reason) between 1 and 500);

alter table public.study_sessions
  drop constraint if exists study_sessions_total_paused_seconds_check;

alter table public.study_sessions
  add constraint study_sessions_total_paused_seconds_check
  check (total_paused_seconds >= 0);

drop policy if exists "Admin updates study sessions" on public.study_sessions;
create policy "Admin updates study sessions"
on public.study_sessions
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create or replace function public.pause_study_session(
  target_session_id uuid,
  pause_reason_text text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_session public.study_sessions%rowtype;
  current_user_id uuid := (select auth.uid());
  clean_reason text := nullif(btrim(pause_reason_text), '');
begin
  if current_user_id is null then
    raise exception 'يجب تسجيل الدخول أولًا.';
  end if;

  if clean_reason is null then
    raise exception 'اكتب سبب التوقف المؤقت.';
  end if;

  if char_length(clean_reason) > 500 then
    raise exception 'سبب التوقف طويل جدًا.';
  end if;

  select *
  into current_session
  from public.study_sessions
  where id = target_session_id
  for update;

  if not found then
    raise exception 'لم يتم العثور على الجلسة.';
  end if;

  if current_session.status <> 'active' then
    raise exception 'هذه الجلسة منتهية بالفعل.';
  end if;

  if current_session.paused_at is not null then
    raise exception 'الجلسة متوقفة مؤقتًا بالفعل.';
  end if;

  if current_session.student_id <> current_user_id
     and not (select public.is_admin()) then
    raise exception 'ليست لديك صلاحية لإيقاف هذه الجلسة.';
  end if;

  update public.study_sessions
  set paused_at = clock_timestamp(),
      pause_reason = clean_reason,
      paused_by = current_user_id
  where id = target_session_id;
end;
$$;

create or replace function public.resume_study_session(target_session_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_session public.study_sessions%rowtype;
  current_user_id uuid := (select auth.uid());
  added_pause_seconds integer;
begin
  if current_user_id is null then
    raise exception 'يجب تسجيل الدخول أولًا.';
  end if;

  select *
  into current_session
  from public.study_sessions
  where id = target_session_id
  for update;

  if not found then
    raise exception 'لم يتم العثور على الجلسة.';
  end if;

  if current_session.status <> 'active' then
    raise exception 'هذه الجلسة منتهية بالفعل.';
  end if;

  if current_session.paused_at is null then
    raise exception 'الجلسة ليست متوقفة مؤقتًا.';
  end if;

  if current_session.student_id <> current_user_id
     and not (select public.is_admin()) then
    raise exception 'ليست لديك صلاحية لاستئناف هذه الجلسة.';
  end if;

  added_pause_seconds := greatest(
    0,
    floor(extract(epoch from (clock_timestamp() - current_session.paused_at)))::integer
  );

  update public.study_sessions
  set total_paused_seconds = total_paused_seconds + added_pause_seconds,
      paused_at = null,
      pause_reason = null,
      paused_by = null
  where id = target_session_id;
end;
$$;

create or replace function public.finish_study_session(
  target_session_id uuid,
  session_note_text text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_session public.study_sessions%rowtype;
  current_user_id uuid := (select auth.uid());
  finished_at timestamptz := clock_timestamp();
  current_pause_seconds integer := 0;
  final_duration integer;
begin
  if current_user_id is null then
    raise exception 'يجب تسجيل الدخول أولًا.';
  end if;

  select *
  into current_session
  from public.study_sessions
  where id = target_session_id
  for update;

  if not found then
    raise exception 'لم يتم العثور على الجلسة.';
  end if;

  if current_session.status <> 'active' then
    raise exception 'هذه الجلسة منتهية بالفعل.';
  end if;

  if current_session.student_id <> current_user_id
     and not (select public.is_admin()) then
    raise exception 'ليست لديك صلاحية لإنهاء هذه الجلسة.';
  end if;

  if current_session.paused_at is not null then
    current_pause_seconds := greatest(
      0,
      floor(extract(epoch from (finished_at - current_session.paused_at)))::integer
    );
  end if;

  final_duration := greatest(
    1,
    floor(extract(epoch from (finished_at - current_session.started_at)))::integer
      - current_session.total_paused_seconds
      - current_pause_seconds
  );

  update public.study_sessions
  set status = 'completed',
      ended_at = finished_at,
      duration_seconds = final_duration,
      student_note = coalesce(nullif(btrim(session_note_text), ''), student_note),
      total_paused_seconds = total_paused_seconds + current_pause_seconds,
      paused_at = null,
      pause_reason = null,
      paused_by = null
  where id = target_session_id;
end;
$$;

revoke all on function public.pause_study_session(uuid, text) from public, anon;
revoke all on function public.resume_study_session(uuid) from public, anon;
revoke all on function public.finish_study_session(uuid, text) from public, anon;

grant execute on function public.pause_study_session(uuid, text) to authenticated;
grant execute on function public.resume_study_session(uuid) to authenticated;
grant execute on function public.finish_study_session(uuid, text) to authenticated;
