"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  CircleAlert,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  RefreshCw,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import styles from "./subjects.module.css";

type Profile = {
  id: string;
  full_name: string;
  role: "student" | "guardian" | "admin";
};

type Subject = {
  id: string;
  code: string;
  name: string;
  color: string;
  sort_order: number;
  is_active: boolean;
};

type Chapter = {
  id: string;
  subject_id: string;
  chapter_number: number;
  title: string;
  sort_order: number;
  is_active: boolean;
};

type Progress = {
  id: string;
  student_id: string;
  chapter_id: string;
  status: "studying" | "ready_for_test" | "passed" | "needs_review";
};

const statusLabels = {
  studying: "قيد الدراسة",
  ready_for_test: "جاهز للاختبار",
  passed: "مكتمل ومعتمد",
  needs_review: "يحتاج مراجعة",
};

export default function SubjectsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [studentId, setStudentId] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function initialize() {
    const stored = localStorage.getItem("jaafar-learning-session");

    if (!stored) {
      window.location.href = "/";
      return;
    }

    const session = JSON.parse(stored);

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
    });

    if (sessionError) {
      localStorage.removeItem("jaafar-learning-session");
      window.location.href = "/";
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/";
      return;
    }

    const { data: currentProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", user.id)
      .single();

    if (profileError || !currentProfile) {
      setMessage("تعذر قراءة الحساب.");
      setLoading(false);
      return;
    }

    setProfile(currentProfile);

    const { data: student } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "student")
      .single();

    if (!student) {
      setMessage("لم يتم العثور على حساب جعفر.");
      setLoading(false);
      return;
    }

    setStudentId(student.id);

    let subjectsQuery = supabase
      .from("subjects")
      .select("*")
      .order("sort_order");

    let chaptersQuery = supabase
      .from("chapters")
      .select("*")
      .order("sort_order");

    if (currentProfile.role !== "admin") {
      subjectsQuery = subjectsQuery.eq("is_active", true);
      chaptersQuery = chaptersQuery.eq("is_active", true);
    }

    const [
      { data: subjectsData },
      { data: chaptersData },
      { data: progressData },
    ] = await Promise.all([
      subjectsQuery,
      chaptersQuery,
      supabase
        .from("chapter_progress")
        .select("*")
        .eq("student_id", student.id),
    ]);

    setSubjects(subjectsData ?? []);
    setChapters(chaptersData ?? []);
    setProgress(progressData ?? []);
    setLoading(false);
  }

  useEffect(() => {
    initialize();

    const channel = supabase
      .channel("shared-curriculum")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subjects" },
        initialize
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chapters" },
        initialize
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chapter_progress" },
        initialize
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const progressByChapter = useMemo(
    () => new Map(progress.map((item) => [item.chapter_id, item])),
    [progress]
  );

  async function addSubject() {
    const name = window.prompt("اكتب اسم المادة الجديدة:");
    if (!name?.trim()) return;

    const { error } = await supabase.from("subjects").insert({
      code: `custom_${Date.now()}`,
      name: name.trim(),
      color: "#1f5b4e",
      sort_order: subjects.length + 1,
    });

    if (error) window.alert(error.message);
  }

  async function editSubject(subject: Subject) {
    const name = window.prompt("غيّر اسم المادة:", subject.name);
    if (!name?.trim() || name.trim() === subject.name) return;

    const { error } = await supabase
      .from("subjects")
      .update({ name: name.trim() })
      .eq("id", subject.id);

    if (error) window.alert(error.message);
  }

  async function toggleSubject(subject: Subject) {
    const action = subject.is_active ? "إخفاء" : "إظهار";

    if (!window.confirm(`${action} مادة ${subject.name}؟`)) return;

    const { error } = await supabase
      .from("subjects")
      .update({ is_active: !subject.is_active })
      .eq("id", subject.id);

    if (error) window.alert(error.message);
  }

  async function addChapter(subject: Subject) {
    const title = window.prompt(`اسم الفصل الجديد في ${subject.name}:`);
    if (!title?.trim()) return;

    const subjectChapters = chapters.filter(
      (chapter) => chapter.subject_id === subject.id
    );

    const nextNumber =
      Math.max(0, ...subjectChapters.map((chapter) => chapter.chapter_number)) +
      1;

    const { error } = await supabase.from("chapters").insert({
      subject_id: subject.id,
      chapter_number: nextNumber,
      title: title.trim(),
      sort_order: nextNumber,
    });

    if (error) window.alert(error.message);
  }

  async function editChapter(chapter: Chapter) {
    const title = window.prompt("غيّر اسم الفصل:", chapter.title);
    if (!title?.trim() || title.trim() === chapter.title) return;

    const { error } = await supabase
      .from("chapters")
      .update({ title: title.trim() })
      .eq("id", chapter.id);

    if (error) window.alert(error.message);
  }

  async function toggleChapter(chapter: Chapter) {
    const action = chapter.is_active ? "إخفاء" : "إظهار";

    if (!window.confirm(`${action} فصل ${chapter.title}؟`)) return;

    const { error } = await supabase
      .from("chapters")
      .update({ is_active: !chapter.is_active })
      .eq("id", chapter.id);

    if (error) window.alert(error.message);
  }

  async function markReady(chapter: Chapter) {
    if (!profile || !studentId) return;

    const existing = progressByChapter.get(chapter.id);

    if (existing?.status === "passed") return;

    const { error } = await supabase.from("chapter_progress").upsert(
      {
        student_id: studentId,
        chapter_id: chapter.id,
        status: "ready_for_test",
        marked_ready_at: new Date().toISOString(),
      },
      { onConflict: "student_id,chapter_id" }
    );

    if (error) window.alert(error.message);
  }

  async function reviewChapter(
    chapter: Chapter,
    passed: boolean
  ) {
    if (!profile) return;

    const existing = progressByChapter.get(chapter.id);

    if (!existing) {
      window.alert("يجب أن يرسل جعفر الفصل للاختبار أولًا.");
      return;
    }

    const { error } = await supabase
      .from("chapter_progress")
      .update({
        status: passed ? "passed" : "needs_review",
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) window.alert(error.message);
  }

  if (loading) {
    return (
      <main className={styles.loading}>
        <RefreshCw className={styles.spin} />
        <p>جارٍ تحميل المواد والفصول...</p>
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
          <h1>المواد والفصول</h1>
          <p>تقدم جعفر المشترك بين جميع أفراد العائلة</p>
        </div>

        {profile?.role === "admin" && (
          <button className={styles.primary} onClick={addSubject}>
            <Plus size={18} />
            إضافة مادة
          </button>
        )}
      </header>

      {message && (
        <div className={styles.error}>
          <CircleAlert />
          {message}
        </div>
      )}

      <section className={styles.grid}>
        {subjects.map((subject) => {
          const subjectChapters = chapters.filter(
            (chapter) => chapter.subject_id === subject.id
          );

          const passedCount = subjectChapters.filter(
            (chapter) =>
              progressByChapter.get(chapter.id)?.status === "passed"
          ).length;

          const percentage = subjectChapters.length
            ? Math.round((passedCount / subjectChapters.length) * 100)
            : 0;

          return (
            <article
              className={`${styles.card} ${
                !subject.is_active ? styles.inactive : ""
              }`}
              key={subject.id}
            >
              <div className={styles.subjectHeader}>
                <span
                  className={styles.subjectIcon}
                  style={{ backgroundColor: subject.color }}
                >
                  <BookOpen />
                </span>

                <div className={styles.subjectName}>
                  <h2>{subject.name}</h2>
                  <p>
                    {passedCount} من {subjectChapters.length} فصول مكتملة
                  </p>
                </div>

                {profile?.role === "admin" && (
                  <div className={styles.actions}>
                    <button onClick={() => editSubject(subject)}>
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => toggleSubject(subject)}>
                      {subject.is_active ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div className={styles.progressBar}>
                <span style={{ width: `${percentage}%` }} />
              </div>
              <small className={styles.percentage}>{percentage}%</small>

              <div className={styles.chapters}>
                {subjectChapters.map((chapter) => {
                  const chapterProgress = progressByChapter.get(chapter.id);
                  const status = chapterProgress?.status ?? "studying";

                  return (
                    <div
                      className={`${styles.chapter} ${
                        !chapter.is_active ? styles.inactiveChapter : ""
                      }`}
                      key={chapter.id}
                    >
                      <span className={styles.chapterNumber}>
                        {chapter.chapter_number}
                      </span>

                      <div className={styles.chapterInfo}>
                        <strong>{chapter.title}</strong>
                        <small className={styles[status]}>
                          {statusLabels[status]}
                        </small>
                      </div>

                      <div className={styles.chapterActions}>
                        {profile?.role === "student" &&
                          status !== "passed" &&
                          status !== "ready_for_test" && (
                            <button
                              className={styles.readyButton}
                              onClick={() => markReady(chapter)}
                            >
                              جاهز للاختبار
                            </button>
                          )}

                        {profile?.role !== "student" &&
                          status === "ready_for_test" && (
                            <>
                              <button
                                className={styles.passButton}
                                onClick={() => reviewChapter(chapter, true)}
                              >
                                <Check size={15} />
                                ناجح
                              </button>
                              <button
                                className={styles.reviewButton}
                                onClick={() => reviewChapter(chapter, false)}
                              >
                                مراجعة
                              </button>
                            </>
                          )}

                        {profile?.role === "admin" && (
                          <>
                            <button onClick={() => editChapter(chapter)}>
                              <Pencil size={15} />
                            </button>
                            <button onClick={() => toggleChapter(chapter)}>
                              {chapter.is_active ? (
                                <EyeOff size={15} />
                              ) : (
                                <Eye size={15} />
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

                {profile?.role === "admin" && (
                  <button
                    className={styles.addChapter}
                    onClick={() => addChapter(subject)}
                  >
                    <Plus size={16} />
                    إضافة فصل
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}