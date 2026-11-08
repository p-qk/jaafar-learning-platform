"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  Play,
  RefreshCw,
  Square,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import styles from "./sessions.module.css";

type Profile = {
  id: string;
  full_name: string;
  role: "student" | "guardian" | "admin";
};

type Subject = {
  id: string;
  name: string;
  color: string;
};

type Chapter = {
  id: string;
  subject_id: string;
  title: string;
  chapter_number: number;
};

type StudySession = {
  id: string;
  student_id: string;
  subject_id: string | null;
  chapter_id: string | null;
  status: "active" | "completed" | "cancelled";
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  student_note: string | null;
};

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => value.toString().padStart(2, "0"))
    .join(":");
}

export default function SessionsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [studentId, setStudentId] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [now, setNow] = useState(Date.now());

  async function initialize() {
    const stored = localStorage.getItem("jaafar-learning-session");

    if (!stored) {
      window.location.href = "/";
      return;
    }

    const savedSession = JSON.parse(stored);

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: savedSession.accessToken,
      refresh_token: savedSession.refreshToken,
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

    const { data: student } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "student")
      .single();

    if (!student) {
      setLoading(false);
      return;
    }

    setStudentId(student.id);

    const [
      { data: subjectsData },
      { data: chaptersData },
      { data: sessionsData },
    ] = await Promise.all([
      supabase
        .from("subjects")
        .select("id, name, color")
        .eq("is_active", true)
        .order("sort_order"),

      supabase
        .from("chapters")
        .select("id, subject_id, title, chapter_number")
        .eq("is_active", true)
        .order("sort_order"),

      supabase
        .from("study_sessions")
        .select("*")
        .eq("student_id", student.id)
        .order("started_at", { ascending: false })
        .limit(15),
    ]);

    setSubjects(subjectsData ?? []);
    setChapters(chaptersData ?? []);
    setSessions(sessionsData ?? []);
    setLoading(false);
  }

  useEffect(() => {
    initialize();

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    const channel = supabase
      .channel("live-study-session")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "study_sessions",
        },
        initialize
      )
      .subscribe();

    return () => {
      window.clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, []);

  const activeSession = sessions.find(
    (session) => session.status === "active"
  );

  const completedSessions = sessions.filter(
    (session) => session.status === "completed"
  );

  const availableChapters = chapters.filter(
    (chapter) => chapter.subject_id === selectedSubject
  );

  const elapsedSeconds = activeSession
    ? Math.max(
        0,
        Math.floor(
          (now - new Date(activeSession.started_at).getTime()) / 1000
        )
      )
    : 0;

  const subjectById = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject])),
    [subjects]
  );

  const chapterById = useMemo(
    () => new Map(chapters.map((chapter) => [chapter.id, chapter])),
    [chapters]
  );

  async function startSession() {
    if (!profile || profile.role !== "student") return;

    if (!selectedSubject || !selectedChapter) {
      window.alert("اختر المادة والفصل أولًا.");
      return;
    }

    setWorking(true);

    const { error } = await supabase.from("study_sessions").insert({
      student_id: profile.id,
      subject_id: selectedSubject,
      chapter_id: selectedChapter,
      status: "active",
      started_at: new Date().toISOString(),
    });

    setWorking(false);

    if (error) {
      window.alert(error.message);
      return;
    }

    await initialize();
  }

  async function finishSession() {
    if (!profile || !activeSession) return;

    const note = window.prompt(
      "اكتب ملاحظة قصيرة عن الجلسة، أو اتركها فارغة:"
    );

    setWorking(true);

    const endedAt = new Date();
    const duration = Math.max(
      1,
      Math.floor(
        (endedAt.getTime() -
          new Date(activeSession.started_at).getTime()) /
          1000
      )
    );

    const { error } = await supabase
      .from("study_sessions")
      .update({
        status: "completed",
        ended_at: endedAt.toISOString(),
        duration_seconds: duration,
        student_note: note?.trim() || null,
      })
      .eq("id", activeSession.id);

    setWorking(false);

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
        <p>جارٍ تحميل جلسات الدراسة...</p>
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
          <h1>جلسات الدراسة</h1>
          <p>متابعة مباشرة لوقت الدراسة والمادة والفصل</p>
        </div>

        <span className={styles.account}>
          {profile?.full_name}
        </span>
      </header>

      <section className={styles.liveCard}>
        <div className={styles.liveHeading}>
          <span className={styles.clockIcon}>
            <Clock3 />
          </span>

          <div>
            <small>
              {activeSession ? "جلسة جارية الآن" : "لا توجد جلسة جارية"}
            </small>
            <h2>
              {activeSession
                ? subjectById.get(activeSession.subject_id ?? "")?.name
                : "ابدأ جلسة جديدة"}
            </h2>
          </div>

          {activeSession && (
            <span className={styles.liveBadge}>
              مباشر
            </span>
          )}
        </div>

        {activeSession ? (
          <>
            <div className={styles.timer}>
              {formatDuration(elapsedSeconds)}
            </div>

            <p className={styles.activeChapter}>
              <BookOpen size={17} />
              {chapterById.get(activeSession.chapter_id ?? "")?.title}
            </p>

            {profile?.role === "student" && (
              <button
                className={styles.stopButton}
                onClick={finishSession}
                disabled={working}
              >
                <Square size={17} fill="currentColor" />
                إنهاء الجلسة
              </button>
            )}

            {profile?.role !== "student" && (
              <p className={styles.guardianMessage}>
                جعفر يدرس الآن، وسيظهر وقت الجلسة هنا مباشرة.
              </p>
            )}
          </>
        ) : profile?.role === "student" ? (
          <div className={styles.startForm}>
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
                <option value="">اختر الفصل</option>
                {availableChapters.map((chapter) => (
                  <option value={chapter.id} key={chapter.id}>
                    الفصل {chapter.chapter_number}: {chapter.title}
                  </option>
                ))}
              </select>
            </label>

            <button
              className={styles.startButton}
              onClick={startSession}
              disabled={working}
            >
              <Play size={18} fill="currentColor" />
              بدء الجلسة
            </button>
          </div>
        ) : (
          <p className={styles.guardianMessage}>
            عندما يبدأ جعفر الدراسة ستظهر الجلسة والعداد هنا فورًا.
          </p>
        )}
      </section>

      <section className={styles.history}>
        <div className={styles.sectionTitle}>
          <div>
            <h2>الجلسات السابقة</h2>
            <p>آخر جلسات جعفر المكتملة</p>
          </div>
          <span>{completedSessions.length} جلسات</span>
        </div>

        <div className={styles.sessionList}>
          {completedSessions.length === 0 ? (
            <div className={styles.empty}>
              <Clock3 />
              <p>لا توجد جلسات مكتملة بعد.</p>
            </div>
          ) : (
            completedSessions.map((session) => (
              <article className={styles.sessionItem} key={session.id}>
                <span className={styles.doneIcon}>
                  <CheckCircle2 />
                </span>

                <div className={styles.sessionInfo}>
                  <strong>
                    {subjectById.get(session.subject_id ?? "")?.name}
                  </strong>
                  <small>
                    {chapterById.get(session.chapter_id ?? "")?.title}
                  </small>
                  {session.student_note && (
                    <p>{session.student_note}</p>
                  )}
                </div>

                <div className={styles.sessionTime}>
                  <strong>
                    {formatDuration(session.duration_seconds)}
                  </strong>
                  <small>
                    {new Intl.DateTimeFormat("ar-IQ", {
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    }).format(new Date(session.started_at))}
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