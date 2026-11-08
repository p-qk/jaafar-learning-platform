begin;

alter table public.chapters
add column if not exists is_active boolean not null default true;

insert into public.chapters
  (subject_id, chapter_number, title, sort_order)
select
  s.id, data.chapter_number, data.title, data.chapter_number
from (
  values
    ('islamic', 1, 'الوحدة الأولى'),
    ('islamic', 2, 'الوحدة الثانية'),
    ('islamic', 3, 'الوحدة الثالثة'),
    ('islamic', 4, 'الوحدة الرابعة'),
    ('islamic', 5, 'الوحدة الخامسة'),

    ('arabic', 1, 'القواعد - الاستفهام'),
    ('arabic', 2, 'القواعد - النفي'),
    ('arabic', 3, 'القواعد - التوكيد'),
    ('arabic', 4, 'القواعد - التقديم والتأخير'),
    ('arabic', 5, 'القواعد - النداء'),
    ('arabic', 6, 'القواعد - التعجب'),
    ('arabic', 7, 'القواعد - المدح والذم'),
    ('arabic', 8, 'القواعد - التمني والترجي'),
    ('arabic', 9, 'القواعد - العرض والتحضيض'),
    ('arabic', 10, 'الأدب والنصوص - الجزء الأول'),
    ('arabic', 11, 'الأدب والنصوص - الجزء الثاني'),
    ('arabic', 12, 'الإنشاء'),

    ('english', 1, 'Unit 1'),
    ('english', 2, 'Unit 2'),
    ('english', 3, 'Unit 3'),
    ('english', 4, 'Unit 4'),
    ('english', 5, 'Unit 5'),
    ('english', 6, 'Unit 6'),
    ('english', 7, 'Unit 7'),
    ('english', 8, 'Unit 8'),

    ('mathematics', 1, 'الأعداد المركبة'),
    ('mathematics', 2, 'القطوع المخروطية'),
    ('mathematics', 3, 'تطبيقات التفاضل'),
    ('mathematics', 4, 'التكامل'),
    ('mathematics', 5, 'المعادلات التفاضلية'),
    ('mathematics', 6, 'الهندسة الفضائية'),

    ('physics', 1, 'المتسعات'),
    ('physics', 2, 'الحث الكهرومغناطيسي'),
    ('physics', 3, 'التيار المتناوب'),
    ('physics', 4, 'الموجات الكهرومغناطيسية'),
    ('physics', 5, 'البصريات الفيزيائية'),
    ('physics', 6, 'الفيزياء الحديثة'),
    ('physics', 7, 'إلكترونيات الحالة الصلبة'),
    ('physics', 8, 'الأطياف الذرية والليزر'),
    ('physics', 9, 'الفيزياء النووية'),

    ('chemistry', 1, 'الثرموداينمك'),
    ('chemistry', 2, 'الاتزان الكيميائي'),
    ('chemistry', 3, 'الاتزان الأيوني'),
    ('chemistry', 4, 'تفاعلات التأكسد والاختزال والكيمياء الكهربائية'),
    ('chemistry', 5, 'الكيمياء التناسقية'),
    ('chemistry', 6, 'طرائق التحليل الكيميائي'),
    ('chemistry', 7, 'الكيمياء العضوية للهيدروكربونات المعوضة'),
    ('chemistry', 8, 'الكيمياء الحياتية'),

    ('biology', 1, 'الخلية'),
    ('biology', 2, 'الأنسجة'),
    ('biology', 3, 'التكاثر'),
    ('biology', 4, 'التكوين الجنيني'),
    ('biology', 5, 'علم الوراثة')
) as data(subject_code, chapter_number, title)
join public.subjects s on s.code = data.subject_code
on conflict (subject_id, chapter_number) do update set
  title = excluded.title,
  sort_order = excluded.sort_order,
  is_active = true;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'subjects',
    'chapters',
    'chapter_progress',
    'study_schedule',
    'schedule_changes',
    'study_sessions',
    'exams',
    'notes',
    'subject_completion_requests'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        table_name
      );
    end if;
  end loop;
end
$$;

commit;

select
  s.name as subject,
  count(c.id) as chapters
from public.subjects s
left join public.chapters c
  on c.subject_id = s.id
  and c.is_active = true
group by s.id, s.name, s.sort_order
order by s.sort_order;