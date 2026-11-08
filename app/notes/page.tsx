"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  LockKeyhole,
  MessageSquarePlus,
  Pencil,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import styles from "./notes.module.css";

type Profile = {
  id: string;
  full_name: string;
  role: "student" | "guardian" | "admin";
  relationship: string;
};

type Note = {
  id: string;
  author_id: string;
  content: string;
  visibility: "shared" | "private";
  created_at: string;
  updated_at: string;
};

export default function NotesPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [content, setContent] = useState("");
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

    const [
      { data: currentProfile },
      { data: profilesData },
      { data: notesData },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, role, relationship")
        .eq("id", user.id)
        .single(),

      supabase
        .from("profiles")
        .select("id, full_name, role, relationship")
        .eq("is_active", true),

      supabase
        .from("notes")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    setProfile(currentProfile ?? null);
    setProfiles(profilesData ?? []);
    setNotes(notesData ?? []);
    setLoading(false);
  }

  useEffect(() => {
    initialize();

    const channel = supabase
      .channel("shared-family-notes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notes",
        },
        initialize
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const profileById = useMemo(
    () =>
      new Map(
        profiles.map((familyProfile) => [
          familyProfile.id,
          familyProfile,
        ])
      ),
    [profiles]
  );

  const sharedNotes = notes.filter(
    (note) => note.visibility === "shared"
  );

  const privateNotes = notes.filter(
    (note) =>
      note.visibility === "private" &&
      note.author_id === profile?.id
  );

  function getAuthorLabel(authorId: string) {
    const author = profileById.get(authorId);

    if (!author) return "أحد أفراد العائلة";

    if (author.id === profile?.id && author.role === "student") {
      return "ملاحظتي الخاصة";
    }

    switch (author.relationship) {
      case "brother":
        return `أخي ${author.full_name}`;

      case "father":
        return `أبي ${author.full_name}`;

      case "mother":
        return `أمي ${author.full_name}`;

      case "sister":
        return `أختي ${author.full_name}`;

      case "self":
        return author.full_name;

      default:
        return author.full_name;
    }
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile || !content.trim()) {
      window.alert("اكتب الملاحظة أولًا.");
      return;
    }

    setSaving(true);

    const visibility =
      profile.role === "student" ? "private" : "shared";

    const { error } = await supabase.from("notes").insert({
      author_id: profile.id,
      content: content.trim(),
      visibility,
    });

    setSaving(false);

    if (error) {
      window.alert(error.message);
      return;
    }

    setContent("");
    await initialize();
  }

  async function editNote(note: Note) {
    if (note.author_id !== profile?.id) return;

    const newContent = window.prompt(
      "عدّل نص الملاحظة:",
      note.content
    );

    if (newContent === null) return;

    if (!newContent.trim()) {
      window.alert("لا يمكن حفظ ملاحظة فارغة.");
      return;
    }

    const { error } = await supabase
      .from("notes")
      .update({
        content: newContent.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", note.id);

    if (error) {
      window.alert(error.message);
      return;
    }

    await initialize();
  }

  async function deleteNote(note: Note) {
    if (note.author_id !== profile?.id) return;

    const confirmed = window.confirm(
      "هل تريد حذف هذه الملاحظة؟"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("notes")
      .delete()
      .eq("id", note.id);

    if (error) {
      window.alert(error.message);
      return;
    }

    await initialize();
  }

  function formatDate(date: string) {
    return new Intl.DateTimeFormat("ar-IQ", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(date));
  }

  function NoteCard({ note }: { note: Note }) {
    const isOwner = note.author_id === profile?.id;
    const wasEdited = note.updated_at !== note.created_at;

    return (
      <article className={styles.noteCard}>
        <div
          className={
            note.visibility === "private"
              ? styles.privateIcon
              : styles.sharedIcon
          }
        >
          {note.visibility === "private" ? (
            <LockKeyhole size={20} />
          ) : (
            <Bell size={20} />
          )}
        </div>

        <div className={styles.noteContent}>
          <div className={styles.noteHeading}>
            <div>
              <strong>
                {note.visibility === "private"
                  ? "ملاحظة خاصة"
                  : `ملاحظة من ${getAuthorLabel(
                      note.author_id
                    )}`}
              </strong>

              <span>{formatDate(note.created_at)}</span>
            </div>

            {isOwner && (
              <div className={styles.actions}>
                <button
                  type="button"
                  onClick={() => editNote(note)}
                  title="تعديل الملاحظة"
                >
                  <Pencil size={16} />
                </button>

                <button
                  type="button"
                  className={styles.deleteButton}
                  onClick={() => deleteNote(note)}
                  title="حذف الملاحظة"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>

          <p>{note.content}</p>

          {wasEdited && (
            <small className={styles.edited}>تم التعديل</small>
          )}
        </div>
      </article>
    );
  }

  if (loading) {
    return (
      <main className={styles.loading}>
        <RefreshCw className={styles.spin} />
        <p>جارٍ تحميل الملاحظات...</p>
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

          <h1>الملاحظات</h1>

          <p>
            {profile?.role === "student"
              ? "ملاحظات العائلة وملاحظاتك الدراسية الخاصة"
              : "أضف ملاحظات وتعليمات تظهر لجعفر والعائلة"}
          </p>
        </div>

        <span className={styles.account}>
          {profile?.full_name}
        </span>
      </header>

      <form className={styles.noteForm} onSubmit={addNote}>
        <div className={styles.formHeading}>
          <span>
            <MessageSquarePlus size={23} />
          </span>

          <div>
            <h2>
              {profile?.role === "student"
                ? "إضافة ملاحظة خاصة"
                : "إضافة ملاحظة لجعفر"}
            </h2>

            <p>
              {profile?.role === "student"
                ? "هذه الملاحظة لن يراها أحد غيرك"
                : "ستظهر هذه الملاحظة لجعفر وجميع أولياء الأمور"}
            </p>
          </div>
        </div>

        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={
            profile?.role === "student"
              ? "اكتب ملاحظة تساعدك في الدراسة..."
              : "اكتب الملاحظة أو التوجيه..."
          }
          rows={5}
          maxLength={3000}
        />

        <div className={styles.formFooter}>
          <small>{content.length} / 3000</small>

          <button type="submit" disabled={saving}>
            <MessageSquarePlus size={18} />
            {saving ? "جارٍ الحفظ..." : "حفظ الملاحظة"}
          </button>
        </div>
      </form>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <Users size={22} />
            <span>
              <h2>ملاحظات العائلة</h2>
              <p>تظهر لجميع الحسابات</p>
            </span>
          </div>

          <strong>{sharedNotes.length}</strong>
        </div>

        <div className={styles.notesList}>
          {sharedNotes.length === 0 ? (
            <div className={styles.empty}>
              <Bell size={30} />
              <p>لا توجد ملاحظات عائلية حتى الآن.</p>
            </div>
          ) : (
            sharedNotes.map((note) => (
              <NoteCard note={note} key={note.id} />
            ))
          )}
        </div>
      </section>

      {profile?.role === "student" && (
        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <div>
              <LockKeyhole size={22} />
              <span>
                <h2>ملاحظاتي الخاصة</h2>
                <p>لا يستطيع أي شخص آخر رؤيتها</p>
              </span>
            </div>

            <strong>{privateNotes.length}</strong>
          </div>

          <div className={styles.notesList}>
            {privateNotes.length === 0 ? (
              <div className={styles.empty}>
                <LockKeyhole size={30} />
                <p>لم تضف ملاحظات خاصة بعد.</p>
              </div>
            ) : (
              privateNotes.map((note) => (
                <NoteCard note={note} key={note.id} />
              ))
            )}
          </div>
        </section>
      )}
    </main>
  );
}
