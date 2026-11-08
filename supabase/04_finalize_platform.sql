begin;

-- إزالة العبارات الوصفية القديمة من جميع مواعيد الجدول.
update public.study_schedule
set description = null
where description is not null;

-- لا يستطيع التلميذ تغيير فصل اعتمدته العائلة على أنه مكتمل.
drop policy if exists "Student updates own progress" on public.chapter_progress;
create policy "Student updates own progress"
on public.chapter_progress for update to authenticated
using (
  student_id = auth.uid()
  and status in ('studying', 'ready_for_test', 'needs_review')
)
with check (
  student_id = auth.uid()
  and status in ('studying', 'ready_for_test')
);

-- يسمح لولي الأمر بإنشاء نتيجة فصل إذا سُجل الاختبار قبل طلب الجاهزية.
drop policy if exists "Guardians create progress reviews" on public.chapter_progress;
create policy "Guardians create progress reviews"
on public.chapter_progress for insert to authenticated
with check (
  public.is_guardian_or_admin()
  and status in ('passed', 'needs_review')
);

-- لا يُرسل طلب إنهاء المادة إلا بعد اعتماد جميع فصولها.
drop policy if exists "Student creates completion requests" on public.subject_completion_requests;
create policy "Student creates completion requests"
on public.subject_completion_requests for insert to authenticated
with check (
  student_id = auth.uid()
  and status = 'pending'
  and not exists (
    select 1
    from public.chapters c
    where c.subject_id = subject_completion_requests.subject_id
      and c.is_active = true
      and not exists (
        select 1
        from public.chapter_progress cp
        where cp.student_id = auth.uid()
          and cp.chapter_id = c.id
          and cp.status = 'passed'
      )
  )
);

commit;

select 'تم تطبيق تحديثات المنصة النهائية' as result;
