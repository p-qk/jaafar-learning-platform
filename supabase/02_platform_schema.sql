begin;

do $$ begin
  create type public.progress_status as enum
    ('studying', 'ready_for_test', 'passed', 'needs_review');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.session_status as enum
    ('active', 'completed', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.exam_status as enum
    ('scheduled', 'completed', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.note_visibility as enum
    ('shared', 'private');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.request_status as enum
    ('pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

create or replace function public.is_guardian_or_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('guardian', 'admin')
      and is_active = true
  );
$$;

grant execute on function public.is_guardian_or_admin() to authenticated;

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  color text not null default '#1f5b4e',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  chapter_number integer not null,
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (subject_id, chapter_number)
);

create table if not exists public.chapter_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  status public.progress_status not null default 'studying',
  marked_ready_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  guardian_note text,
  updated_at timestamptz not null default now(),
  unique (student_id, chapter_id)
);

create table if not exists public.study_schedule (
  id uuid primary key default gen_random_uuid(),
  day_of_week integer not null check (day_of_week between 0 and 6),
  title text not null,
  description text,
  start_time time not null,
  end_time time not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  unique (day_of_week, title, start_time)
);

create table if not exists public.schedule_changes (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.study_schedule(id) on delete cascade,
  schedule_date date not null,
  new_start_time time not null,
  new_end_time time not null,
  reason text,
  changed_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid references public.subjects(id),
  chapter_id uuid references public.chapters(id),
  schedule_id uuid references public.study_schedule(id),
  status public.session_status not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer not null default 0,
  student_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id),
  chapter_id uuid references public.chapters(id),
  title text not null,
  description text,
  scheduled_at timestamptz not null,
  status public.exam_status not null default 'scheduled',
  score numeric,
  max_score numeric,
  passed boolean,
  result_note text,
  created_by uuid not null references public.profiles(id),
  evaluated_by uuid references public.profiles(id),
  evaluated_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 3000),
  visibility public.note_visibility not null default 'shared',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subject_completion_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id),
  subject_id uuid not null references public.subjects(id),
  status public.request_status not null default 'pending',
  requested_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  decision_note text
);

alter table public.subjects enable row level security;
alter table public.chapters enable row level security;
alter table public.chapter_progress enable row level security;
alter table public.study_schedule enable row level security;
alter table public.schedule_changes enable row level security;
alter table public.study_sessions enable row level security;
alter table public.exams enable row level security;
alter table public.notes enable row level security;
alter table public.subject_completion_requests enable row level security;

create policy "Users view subjects"
on public.subjects for select to authenticated
using (true);

create policy "Admin manages subjects"
on public.subjects for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Users view chapters"
on public.chapters for select to authenticated
using (true);

create policy "Admin manages chapters"
on public.chapters for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Family views progress"
on public.chapter_progress for select to authenticated
using (true);

create policy "Student creates progress"
on public.chapter_progress for insert to authenticated
with check (
  student_id = auth.uid()
  and status in ('studying', 'ready_for_test')
);

create policy "Student updates own progress"
on public.chapter_progress for update to authenticated
using (student_id = auth.uid())
with check (
  student_id = auth.uid()
  and status in ('studying', 'ready_for_test')
);

create policy "Guardians review progress"
on public.chapter_progress for update to authenticated
using (public.is_guardian_or_admin())
with check (public.is_guardian_or_admin());

create policy "Family views schedule"
on public.study_schedule for select to authenticated
using (true);

create policy "Admin manages schedule"
on public.study_schedule for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Family views schedule changes"
on public.schedule_changes for select to authenticated
using (true);

create policy "Student changes schedule"
on public.schedule_changes for insert to authenticated
with check (
  changed_by = auth.uid()
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'student'
  )
);

create policy "Family views study sessions"
on public.study_sessions for select to authenticated
using (true);

create policy "Student creates sessions"
on public.study_sessions for insert to authenticated
with check (student_id = auth.uid());

create policy "Student updates sessions"
on public.study_sessions for update to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());

create policy "Family views exams"
on public.exams for select to authenticated
using (true);

create policy "Guardians create exams"
on public.exams for insert to authenticated
with check (
  public.is_guardian_or_admin()
  and created_by = auth.uid()
);

create policy "Guardians update exams"
on public.exams for update to authenticated
using (public.is_guardian_or_admin())
with check (public.is_guardian_or_admin());

create policy "Users view allowed notes"
on public.notes for select to authenticated
using (
  visibility = 'shared'
  or author_id = auth.uid()
);

create policy "Users create notes"
on public.notes for insert to authenticated
with check (
  author_id = auth.uid()
  and (
    visibility = 'shared'
    or (
      visibility = 'private'
      and exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'student'
      )
    )
  )
);

create policy "Authors update notes"
on public.notes for update to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

create policy "Authors delete notes"
on public.notes for delete to authenticated
using (author_id = auth.uid());

create policy "Family views completion requests"
on public.subject_completion_requests for select to authenticated
using (true);

create policy "Student creates completion requests"
on public.subject_completion_requests for insert to authenticated
with check (
  student_id = auth.uid()
  and status = 'pending'
);

create policy "Guardians decide requests"
on public.subject_completion_requests for update to authenticated
using (public.is_guardian_or_admin())
with check (public.is_guardian_or_admin());

insert into public.subjects (code, name, color, sort_order)
values
  ('islamic', 'التربية الإسلامية', '#748c67', 1),
  ('arabic', 'اللغة العربية', '#b56f53', 2),
  ('english', 'اللغة الإنجليزية', '#527ca3', 3),
  ('mathematics', 'الرياضيات', '#735f9b', 4),
  ('physics', 'الفيزياء', '#3b7d8c', 5),
  ('chemistry', 'الكيمياء', '#b4813f', 6),
  ('biology', 'الأحياء', '#4f8a61', 7)
on conflict (code) do update set
  name = excluded.name,
  color = excluded.color,
  sort_order = excluded.sort_order;

insert into public.study_schedule
  (day_of_week, title, description, start_time, end_time, sort_order)
values
  (0, 'الجلسة الأولى', 'المواد الثقيلة', '14:00', '16:00', 1),
  (0, 'الجلسة الثانية', 'مراجعة وحفظ', '19:00', '21:00', 2),
  (1, 'الجلسة الأولى', 'المواد الثقيلة', '14:00', '16:00', 1),
  (1, 'الجلسة الثانية', 'مراجعة وحفظ', '19:00', '21:00', 2),

  (2, 'الجلسة الأولى', 'المواد الثقيلة', '09:00', '11:00', 1),
  (2, 'الجلسة الثانية', 'مراجعة وحفظ', '19:00', '21:00', 2),
  (3, 'الجلسة الأولى', 'المواد الثقيلة', '09:00', '11:00', 1),
  (3, 'الجلسة الثانية', 'مراجعة وحفظ', '19:00', '21:00', 2),
  (4, 'الجلسة الأولى', 'المواد الثقيلة', '09:00', '11:00', 1),
  (4, 'الجلسة الثانية', 'مراجعة وحفظ', '19:00', '21:00', 2),

  (5, 'الجلسة الأولى', 'دراسة مركزة', '09:00', '11:00', 1),
  (5, 'الجلسة الثانية', 'دراسة مركزة', '14:00', '16:00', 2),
  (5, 'الجلسة الثالثة', 'المراجعة الأسبوعية', '19:00', '21:00', 3),
  (6, 'الجلسة الأولى', 'دراسة مركزة', '09:00', '11:00', 1),
  (6, 'الجلسة الثانية', 'دراسة مركزة', '14:00', '16:00', 2),
  (6, 'الجلسة الثالثة', 'المراجعة الأسبوعية', '19:00', '21:00', 3)
on conflict (day_of_week, title, start_time) do nothing;

commit;

select
  (select count(*) from public.subjects) as subjects,
  (select count(*) from public.study_schedule) as schedule_items;