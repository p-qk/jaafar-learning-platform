"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Plus,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import styles from "./exams.module.css";

type Profile = {
  id: string;
  full_name: string;
  role: "student" | "guardian" | "admin";
};

type FamilyProfile = Profile & {
  relationship: "self" | "brother" | "father" | "mother" | "sister";
};

type Subject = {
  id: string;
  name: string;
  color: string;
};

type Chapter = {
  id: string;
  subject_id: string;
  chapter_number: number;
  title: string;
};

type Exam = {
  id: string;
  subject_id: string;
  chapter_id: string | null;
  title: string;
  description: string | null;
  scheduled_at: string;
  status: "scheduled" | "completed" | "cancelled";
  score: number | null;
  max_score: number | null;
  passed: boolean | null;
  result_note: string | null;
  created_by: string;
  evaluated_by: string | null;
  evaluated_at: string | null;
  created_at: string;
};

export default function ExamsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<FamilyProfile[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function initialize() {
    const stored = localStorage.getItem("jaafar-learning-session");

    if (!stored) {
      window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`;
      return;
    }

    const savedSession = JSON.parse(stored);

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: savedSession.accessToken,
      refresh_token: savedSession.refreshToken,
    });

    if (sessionError) {
      localStorage.removeItem("jaafar-learning-session");
      window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`;
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`;
      return;
    }

    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", user.id)
      .single();

    if (!currentProfile) {
      setLoading(false);
      return;
    }

    setProfile(currentProfile);

    const [
      { data: subjectsData },
      { data: chaptersData },
      { data: examsData },
      { data: profilesData },
    ] = await Promise.all([
      supabase
        .from("subjects")
        .select("id, name, color")
        .eq("is_active", true)
        .order("sort_order"),

      supabase
        .from("chapters")
        .select("id, subject_id, chapter_number, title")
        .eq("is_active", true)
        .order("sort_order"),

      supabase
        .from("exams")
        .select("*")
        .order("scheduled_at", { ascending: true }),

      supabase
        .from("profiles")
        .select("id, full_name, role, relationship")
        .eq("is_active", true),
    ]);

    setSubjects(subjectsData ?? []);
    setChapters(chaptersData ?? []);
    setExams(examsData ?? []);
    setProfiles((profilesData as FamilyProfile[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    initialize();

    const channel = supabase
      .channel("shared-exams")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "exams",
        },
        initialize
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const subjectById = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject])),
    [subjects]
  );

  const chapterById = useMemo(
    () => new Map(chapters.map((chapter) => [chapter.id, chapter])),
    [chapters]
  );

  const profileById = useMemo(
    () => new Map(profiles.map((item) => [item.id, item])),
    [profiles]
  );

  function creatorLabel(authorId: string) {
    const author = profileById.get(authorId);
    if (!author) return "أحد أفراد العائلة";
    const relation = {
      self: "",
      brother: "أخي",
      father: "أبي",
      mother: "أمي",
      sister: "أختي",
    }[author.relationship];
    return `${relation} ${author.full_name}`.trim();
  }

  const availableChapters = chapters.filter(
    (chapter) => chapter.subject_id === selectedSubject
  );

  const upcomingExams = exams.filter(
    (exam) => exam.status === "scheduled"
  );

  const completedExams = exams
    .filter((exam) => exam.status === "completed")
    .sort(
      (a, b) =>
        new Date(b.scheduled_at).getTime() -
        new Date(a.scheduled_at).getTime()
    );

  async function createExam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile || profile.role === "student") return;

    if (!selectedSubject || !title.trim() || !scheduledAt) {
      window.alert("اختر المادة واكتب عنوان الاختبار وحدد الموعد.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("exams").insert({
      subject_id: selectedSubject,
      chapter_id: selectedChapter || null,
      title: title.trim(),
      description: description.trim() || null,
      scheduled_at: new Date(scheduledAt).toISOString(),
      status: "scheduled",
      created_by: profile.id,
    });

    setSaving(false);

    if (error) {
      window.alert(error.message);
      return;
    }

    setSelectedSubject("");
    setSelectedChapter("");
    setTitle("");
    setDescription("");
    setScheduledAt("");

    await initialize();
  }

  async function recordResult(exam: Exam, passed: boolean) {
    if (!profile || profile.role === "student") return;

    const scoreText = window.prompt(
      "اكتب درجة جعفر، أو اتركها فارغة:"
    );

    if (scoreText === null) return;

    const maxScoreText = window.prompt(
      "اكتب الدرجة الكلية، أو اتركها فارغة:"
    );

    if (maxScoreText === null) return;

    const note = window.prompt(
      "اكتب ملاحظة عن النتيجة، أو اتركها فارغة:"
    );

    const score =
      scoreText.trim() === "" ? null : Number(scoreText);

    const maxScore =
      maxScoreText.trim() === "" ? null : Number(maxScoreText);

    if (
      (score !== null && Number.isNaN(score)) ||
      (maxScore !== null && Number.isNaN(maxScore))
    ) {
      window.alert("الدرجة يجب أن تكون رقمًا.");
      return;
    }

    const { error } = await supabase
      .from("exams")
      .update({
        status: "completed",
        score,
        max_score: maxScore,
        passed,
        result_note: note?.trim() || null,
        evaluated_by: profile.id,
        evaluated_at: new Date().toISOString(),
      })
      .eq("id", exam.id);

    if (error) {
      window.alert(error.message);
      return;
    }

    if (exam.chapter_id) {
      const { data: student } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "student")
        .single();

      if (student) {
        const { data: existingProgress } = await supabase
          .from("chapter_progress")
          .select("id")
          .eq("student_id", student.id)
          .eq("chapter_id", exam.chapter_id)
          .maybeSingle();

        if (existingProgress) {
          await supabase
            .from("chapter_progress")
            .update({
              status: passed ? "passed" : "needs_review",
              reviewed_by: profile.id,
              reviewed_at: new Date().toISOString(),
              guardian_note: note?.trim() || null,
            })
            .eq("id", existingProgress.id);
        } else {
          await supabase.from("chapter_progress").insert({
            student_id: student.id,
            chapter_id: exam.chapter_id,
            status: passed ? "passed" : "needs_review",
            reviewed_by: profile.id,
            reviewed_at: new Date().toISOString(),
            guardian_note: note?.trim() || null,
          });
        }
      }
    }

    await initialize();
  }

  async function cancelExam(exam: Exam) {
    if (!window.confirm(`إلغاء اختبار ${exam.title}؟`)) return;

    const { error } = await supabase
      .from("exams")
      .update({ status: "cancelled" })
      .eq("id", exam.id);

    if (error) {
      window.alert(error.message);
      return;
    }

    await initialize();
  }

  if (loading) {
    return (
      <main className={styles.loading}>
        <RefreshCw className={styles.spin} />
        <p>جارٍ تحميل الاختبارات...</p>
      </main>
    );
  }

  return (
    <main className={styles.page} dir="rtl">
      <header className={styles.header}>
        <div>
          <Link href="/" className={styles.back}>
            <ArrowRight size={18} />
            الرئيسية
          </Link>
          <h1>الاختبارات</h1>
          <p>مواعيد الاختبارات الورقية ونتائج جعفر</p>
        </div>

        <span className={styles.account}>
          {profile?.full_name}
        </span>
      </header>

      {profile?.role !== "student" && (
        <form className={styles.examForm} onSubmit={createExam}>
          <div className={styles.formTitle}>
            <span>
              <Plus />
            </span>
            <div>
              <h2>إضافة اختبار جديد</h2>
              <p>حدد المادة والفصل والموضوع والموعد</p>
            </div>
          </div>

          <div className={styles.formGrid}>
            <label>
              المادة
              <select
                value={selectedSubject}
                onChange={(event) => {
                  setSelectedSubject(event.target.value);
                  setSelectedChapter("");
                }}
              >
                <option value="">اختر المادة</option>
                {subjects.map((subject) => (
                  <option value={subject.id} key={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              الفصل
              <select
                value={selectedChapter}
                onChange={(event) =>
                  setSelectedChapter(event.target.value)
                }
                disabled={!selectedSubject}
              >
                <option value="">بدون فصل محدد</option>
                {availableChapters.map((chapter) => (
                  <option value={chapter.id} key={chapter.id}>
                    الفصل {chapter.chapter_number}: {chapter.title}
                  </option>
                ))}
              </select>
            </label>

            <label>
              عنوان الاختبار
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="مثال: اختبار الفصل الأول"
              />
            </label>

            <label>
              الموعد
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) =>
                  setScheduledAt(event.target.value)
                }
              />
            </label>

            <label className={styles.fullWidth}>
              الموضوع والملاحظات
              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                placeholder="الاختبار سيكون بخصوص..."
                rows={3}
              />
            </label>
          </div>

          <button
            className={styles.createButton}
            type="submit"
            disabled={saving}
          >
            <ClipboardCheck size={18} />
            {saving ? "جارٍ الحفظ..." : "إضافة الاختبار"}
          </button>
        </form>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <CalendarDays />
            <span>
              <h2>الاختبارات القادمة</h2>
              <p>تظهر لجميع الحسابات فور إضافتها</p>
            </span>
          </div>
          <strong>{upcomingExams.length}</strong>
        </div>

        <div className={styles.examList}>
          {upcomingExams.length === 0 ? (
            <div className={styles.empty}>
              <CalendarDays />
              <p>لا توجد اختبارات قادمة.</p>
            </div>
          ) : (
            upcomingExams.map((exam) => (
              <article className={styles.examCard} key={exam.id}>
                <span
                  className={styles.subjectColor}
                  style={{
                    backgroundColor:
                      subjectById.get(exam.subject_id)?.color,
                  }}
                />

                <div className={styles.examInfo}>
                  <small>
                    {subjectById.get(exam.subject_id)?.name}
                  </small>
                  <h3>{exam.title}</h3>
                  <small>أضافه {creatorLabel(exam.created_by)}</small>

                  {exam.chapter_id && (
                    <p>
                      {chapterById.get(exam.chapter_id)?.title}
                    </p>
                  )}

                  {exam.description && (
                    <p>{exam.description}</p>
                  )}
                </div>

                <div className={styles.examDate}>
                  <Clock3 />
                  <strong>
                    {new Intl.DateTimeFormat("ar-IQ", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    }).format(new Date(exam.scheduled_at))}
                  </strong>
                  <small>
                    {new Intl.DateTimeFormat("ar-IQ", {
                      hour: "numeric",
                      minute: "2-digit",
                    }).format(new Date(exam.scheduled_at))}
                  </small>
                </div>

                {profile?.role !== "student" && (
                  <div className={styles.resultActions}>
                    <button
                      className={styles.successButton}
                      onClick={() => recordResult(exam, true)}
                    >
                      <CheckCircle2 size={16} />
                      تسجيل نجاح
                    </button>

                    <button
                      className={styles.failButton}
                      onClick={() => recordResult(exam, false)}
                    >
                      <XCircle size={16} />
                      تسجيل رسوب
                    </button>

                    <button
                      className={styles.cancelButton}
                      onClick={() => cancelExam(exam)}
                    >
                      إلغاء
                    </button>
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <CheckCircle2 />
            <span>
              <h2>النتائج السابقة</h2>
              <p>سجل الاختبارات المكتملة</p>
            </span>
          </div>
          <strong>{completedExams.length}</strong>
        </div>

        <div className={styles.examList}>
          {completedExams.length === 0 ? (
            <div className={styles.empty}>
              <ClipboardCheck />
              <p>لا توجد نتائج مسجلة بعد.</p>
            </div>
          ) : (
            completedExams.map((exam) => (
              <article className={styles.resultCard} key={exam.id}>
                <span
                  className={
                    exam.passed
                      ? styles.passedIcon
                      : styles.failedIcon
                  }
                >
                  {exam.passed ? (
                    <CheckCircle2 />
                  ) : (
                    <XCircle />
                  )}
                </span>

                <div className={styles.examInfo}>
                  <small>
                    {subjectById.get(exam.subject_id)?.name}
                  </small>
                  <h3>{exam.title}</h3>

                  {exam.result_note && (
                    <p>{exam.result_note}</p>
                  )}
                </div>

                <div className={styles.score}>
                  <strong>
                    {exam.score ?? "-"}
                    {exam.max_score !== null
                      ? ` / ${exam.max_score}`
                      : ""}
                  </strong>
                  <small>
                    {exam.passed ? "ناجح" : "يحتاج مراجعة"}
                  </small>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
