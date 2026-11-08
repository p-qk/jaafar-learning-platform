"use client";

import {
  Bell, BookOpen, CalendarDays, CheckCircle2, ChevronLeft, ClipboardCheck,
  Clock3, GraduationCap, LogOut, Menu, MessageSquareText, Play, ShieldCheck,
  Sparkles, Users, X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const INTERNAL_DOMAIN = "jaafar-learning.local";
const STORAGE_KEY = "jaafar-learning-session";

type Profile = { id: string; login_id: string; full_name: string; role: "student" | "guardian" | "admin"; relationship: "self" | "brother" | "father" | "mother" | "sister" };
type StoredSession = { accessToken: string; refreshToken: string; userId: string };
type Subject = { id: string; name: string; color: string };
type Chapter = { id: string; subject_id: string; title: string };
type Progress = { chapter_id: string; status: "studying" | "ready_for_test" | "passed" | "needs_review" };
type Schedule = { id: string; title: string; start_time: string; end_time: string; sort_order: number };
type ScheduleChange = { schedule_id: string; new_start_time: string; new_end_time: string; created_at: string };
type StudySession = { id: string; subject_id: string | null; chapter_id: string | null; status: "active" | "completed" | "cancelled"; started_at: string; duration_seconds: number };
type Exam = { id: string; subject_id: string; title: string; scheduled_at: string; status: "scheduled" | "completed" | "cancelled" };
type Note = { id: string; author_id: string; content: string; created_at: string };

const roleLabels: Record<Profile["role"], string> = { student: "حساب التلميذ", guardian: "حساب ولي أمر", admin: "المدير" };
const relationshipLabels: Record<Profile["relationship"], string> = { self: "", brother: "أخي", father: "أبي", mother: "أمي", sister: "أختي" };
const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("ar-IQ", { hour: "numeric", minute: "2-digit" }).format(new Date(2000, 0, 1, hours, minutes));
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours} س ${minutes} د` : `${minutes} د`;
}

async function loadProfile(accessToken: string, userId: string): Promise<Profile> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,login_id,full_name,role,relationship&id=eq.${encodeURIComponent(userId)}&limit=1`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("PROFILE_REQUEST_FAILED");
  const rows = (await response.json()) as Profile[];
  if (!rows[0]) throw new Error("PROFILE_NOT_FOUND");
  return rows[0];
}

function BrandMark() {
  return <div className="brand-lockup"><span className="brand-mark"><GraduationCap /></span><span><strong>المنصة التعليمية</strong><small>رحلة جعفر نحو التفوق</small></span></div>;
}

function LoginScreen({ onLogin }: { onLogin: (profile: Profile) => void }) {
  const [loginId, setLoginId] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const normalizedId = loginId.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(normalizedId)) return setError("اكتب المعرّف بحروف إنجليزية، مثل jaafar");
    if (!/^\d{6}$/.test(pin)) return setError("رمز PIN يجب أن يتكون من 6 أرقام");
    setLoading(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST", headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email: `${normalizedId}@${INTERNAL_DOMAIN}`, password: pin }),
      });
      if (!response.ok) throw new Error("INVALID_CREDENTIALS");
      const data = await response.json();
      const session: StoredSession = { accessToken: data.access_token, refreshToken: data.refresh_token, userId: data.user.id };
      const nextProfile = await loadProfile(session.accessToken, session.userId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      onLogin(nextProfile);
    } catch { setError("المعرّف أو رمز PIN غير صحيح. حاول مرة أخرى."); }
    finally { setLoading(false); }
  }

  return <main className="login-page" dir="rtl">
    <div className="login-orb login-orb-one" /><div className="login-orb login-orb-two" />
    <section className="login-intro"><BrandMark /><div className="intro-copy"><span className="eyebrow"><Sparkles size={16} /> تنظيم، متابعة، إنجاز</span><h1>كل خطوة دراسية<br />تصنع فرقًا.</h1><p>مكان واحد يجمع جلسات جعفر، اختبارات العائلة، الملاحظات، وتقدم المواد والفصول.</p></div><div className="feature-row"><span><Clock3 /> جلسات مباشرة</span><span><ClipboardCheck /> اختبارات ومتابعة</span><span><ShieldCheck /> عائلي وآمن</span></div></section>
    <section className="login-panel-wrap"><form className="login-card" onSubmit={submit}><div className="mobile-brand"><BrandMark /></div><div className="login-card-head"><span className="login-icon"><BookOpen /></span><div><p>مرحبًا بك</p><h2>سجّل الدخول إلى المنصة</h2></div></div><label htmlFor="login-id">المعرّف الشخصي</label><div className="input-shell" dir="ltr"><input id="login-id" value={loginId} onChange={(event) => setLoginId(event.target.value)} placeholder="jaafar" autoComplete="username" spellCheck={false} /></div><label htmlFor="pin">رمز PIN</label><div className="input-shell" dir="ltr"><input id="pin" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="••••••" autoComplete="current-password" /></div>{error && <p className="form-error">{error}</p>}<button className="primary-button" type="submit" disabled={loading}>{loading ? <span className="spinner" /> : <>دخول إلى المنصة <ChevronLeft size={19} /></>}</button></form></section>
  </main>;
}

function Dashboard({ profile, onLogout }: { profile: Profile; onLogout: () => void }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [schedule, setSchedule] = useState<Schedule[]>([]);
  const [scheduleChanges, setScheduleChanges] = useState<ScheduleChange[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const todayKey = localDateKey(now);

  async function initializeDashboard() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as StoredSession;
    await supabase.auth.setSession({ access_token: saved.accessToken, refresh_token: saved.refreshToken });
    const { data: student } = await supabase.from("profiles").select("id").eq("role", "student").single();
    if (!student) return setLoading(false);
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const results = await Promise.all([
      supabase.from("profiles").select("id, login_id, full_name, role, relationship").eq("is_active", true),
      supabase.from("subjects").select("id, name, color").eq("is_active", true).order("sort_order"),
      supabase.from("chapters").select("id, subject_id, title").eq("is_active", true).order("sort_order"),
      supabase.from("chapter_progress").select("chapter_id, status").eq("student_id", student.id),
      supabase.from("study_schedule").select("id, title, start_time, end_time, sort_order").eq("is_active", true).eq("day_of_week", now.getDay()).order("sort_order"),
      supabase.from("schedule_changes").select("schedule_id, new_start_time, new_end_time, created_at").eq("schedule_date", todayKey).order("created_at", { ascending: false }),
      supabase.from("study_sessions").select("id, subject_id, chapter_id, status, started_at, duration_seconds").eq("student_id", student.id).gte("started_at", weekAgo.toISOString()).order("started_at", { ascending: false }),
      supabase.from("exams").select("id, subject_id, title, scheduled_at, status").eq("status", "scheduled").order("scheduled_at").limit(10),
      supabase.from("notes").select("id, author_id, content, created_at").eq("visibility", "shared").order("created_at", { ascending: false }).limit(4),
    ]);
    setProfiles((results[0].data as Profile[]) ?? []); setSubjects(results[1].data ?? []); setChapters(results[2].data ?? []);
    setProgress(results[3].data ?? []); setSchedule(results[4].data ?? []); setScheduleChanges(results[5].data ?? []);
    setSessions(results[6].data ?? []); setExams(results[7].data ?? []); setNotes(results[8].data ?? []); setLoading(false);
  }

  useEffect(() => {
    initializeDashboard();
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    const channel = supabase.channel("dashboard-live-data")
      .on("postgres_changes", { event: "*", schema: "public", table: "chapter_progress" }, initializeDashboard)
      .on("postgres_changes", { event: "*", schema: "public", table: "schedule_changes" }, initializeDashboard)
      .on("postgres_changes", { event: "*", schema: "public", table: "study_sessions" }, initializeDashboard)
      .on("postgres_changes", { event: "*", schema: "public", table: "exams" }, initializeDashboard)
      .on("postgres_changes", { event: "*", schema: "public", table: "notes" }, initializeDashboard).subscribe();
    return () => { window.clearInterval(timer); supabase.removeChannel(channel); };
  }, []);

  const profileById = useMemo(() => new Map(profiles.map((item) => [item.id, item])), [profiles]);
  const subjectById = useMemo(() => new Map(subjects.map((item) => [item.id, item])), [subjects]);
  const chapterById = useMemo(() => new Map(chapters.map((item) => [item.id, item])), [chapters]);
  const changeBySchedule = useMemo(() => { const map = new Map<string, ScheduleChange>(); scheduleChanges.forEach((item) => { if (!map.has(item.schedule_id)) map.set(item.schedule_id, item); }); return map; }, [scheduleChanges]);
  const activeSession = sessions.find((item) => item.status === "active");
  const elapsed = activeSession ? Math.max(0, Math.floor((now.getTime() - new Date(activeSession.started_at).getTime()) / 1000)) : 0;
  const studiedSeconds = sessions.filter((item) => item.status === "completed").reduce((sum, item) => sum + item.duration_seconds, 0);
  const passedCount = progress.filter((item) => item.status === "passed").length;
  const readyCount = progress.filter((item) => item.status === "ready_for_test").length;
  const percentage = chapters.length ? Math.round((passedCount / chapters.length) * 100) : 0;
  const nextExam = exams[0];
  const notifications = [
    ...(activeSession ? [{ id: activeSession.id, text: `جعفر يدرس الآن: ${subjectById.get(activeSession.subject_id ?? "")?.name ?? "جلسة دراسة"}`, route: "/sessions" }] : []),
    ...(nextExam ? [{ id: nextExam.id, text: `اختبار قادم: ${nextExam.title}`, route: "/exams" }] : []),
    ...(readyCount ? [{ id: "ready", text: `${readyCount} فصل بانتظار الاختبار`, route: "/subjects" }] : []),
    ...notes.slice(0, 2).map((note) => ({ id: note.id, text: `ملاحظة من ${profileById.get(note.author_id)?.full_name ?? "العائلة"}`, route: "/notes" })),
  ];
  const navItems = [
    ["الرئيسية", Sparkles, "/"], ["المواد والفصول", BookOpen, "/subjects"], ["جلسات الدراسة", Clock3, "/sessions"],
    ["الجدول الدراسي", CalendarDays, "/schedule"], ["الاختبارات", ClipboardCheck, "/exams"], ["الملاحظات", MessageSquareText, "/notes"],
    ...(profile.role === "admin" ? [["إدارة الحسابات", Users, "/accounts"]] : []),
  ] as [string, typeof Sparkles, string][];
  const dateLabel = new Intl.DateTimeFormat("ar-IQ", { weekday: "long", day: "numeric", month: "long" }).format(now);

  return <main className="app-shell" dir="rtl">
    <aside className={menuOpen ? "sidebar sidebar-open" : "sidebar"}><div className="sidebar-brand"><BrandMark /></div><button className="sidebar-close" onClick={() => setMenuOpen(false)}><X /></button><nav>{navItems.map(([label, Icon, route]) => <button key={label} className={route === "/" ? "nav-item nav-active" : "nav-item"} onClick={() => router.push(route)}><Icon size={20} />{label}</button>)}</nav><div className="sidebar-user"><span className="avatar">{profile.full_name.charAt(0)}</span><div><strong>{profile.full_name}</strong><small>{roleLabels[profile.role]}</small></div><button onClick={onLogout}><LogOut size={18} /></button></div></aside>
    {menuOpen && <button className="menu-backdrop" onClick={() => setMenuOpen(false)} />}
    <section className="main-area"><header className="topbar"><button className="menu-button" onClick={() => setMenuOpen(true)}><Menu /></button><div><p>{dateLabel}</p><h1>أهلًا، {profile.full_name.split(" ")[0]} 👋</h1></div><div className="notifications-wrap"><button className="notification-button" onClick={() => setNotificationsOpen((value) => !value)}><Bell />{notifications.length > 0 && <span />}</button>{notificationsOpen && <div className="notifications-panel"><strong>الإشعارات</strong>{notifications.length === 0 ? <p>لا توجد إشعارات جديدة.</p> : notifications.map((item) => <button key={item.id} onClick={() => router.push(item.route)}>{item.text}<ChevronLeft size={15} /></button>)}</div>}</div></header>
      <div className="content-grid">
        <section className="hero-card"><div><span className="hero-kicker">{activeSession ? "جلسة جارية الآن" : nextExam ? "الاختبار القادم" : "متابعة جعفر اليوم"}</span><h2>{activeSession ? `${subjectById.get(activeSession.subject_id ?? "")?.name ?? "جلسة دراسة"} — ${formatDuration(elapsed)}` : nextExam ? nextExam.title : "لا توجد اختبارات قريبة"}</h2><p>{activeSession ? chapterById.get(activeSession.chapter_id ?? "")?.title : nextExam ? `${subjectById.get(nextExam.subject_id)?.name ?? ""} • ${new Intl.DateTimeFormat("ar-IQ", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }).format(new Date(nextExam.scheduled_at))}` : "يمكن بدء جلسة جديدة أو متابعة الجدول والمواد."}</p><button onClick={() => router.push(activeSession ? "/sessions" : nextExam ? "/exams" : "/sessions")}><Play size={18} fill="currentColor" />{activeSession ? "عرض الجلسة المباشرة" : nextExam ? "عرض الاختبارات" : "بدء جلسة الدراسة"}</button></div><div className="hero-visual"><span className="book book-one" /><span className="book book-two" /><span className="hero-clock"><Clock3 /></span></div></section>
        <section className="stats-row"><article><span className="stat-icon green"><CheckCircle2 /></span><div><strong>{passedCount}</strong><small>فصول مكتملة</small></div></article><article><span className="stat-icon gold"><Clock3 /></span><div><strong>{formatDuration(studiedSeconds)}</strong><small>دراسة آخر 7 أيام</small></div></article><article><span className="stat-icon blue"><ClipboardCheck /></span><div><strong>{exams.length}</strong><small>اختبارات قادمة</small></div></article></section>
        <section className="panel schedule-panel"><div className="panel-heading"><div><span className="section-icon"><CalendarDays /></span><div><h3>جدول اليوم</h3><p>{dayNames[now.getDay()]}</p></div></div><button onClick={() => router.push("/schedule")}>عرض الجدول كاملًا</button></div><div className="timeline">{schedule.length === 0 ? <p className="panel-empty">لا توجد جلسات اليوم.</p> : schedule.map((item) => { const change = changeBySchedule.get(item.id); return <article className="timeline-item" key={item.id}><span className="timeline-dot study" /><div className="timeline-copy"><strong>{item.title}</strong>{change && <small>تم تغيير الموعد</small>}</div><time>{formatTime(change?.new_start_time ?? item.start_time)} - {formatTime(change?.new_end_time ?? item.end_time)}</time></article>; })}</div></section>
        <section className="panel notes-panel"><div className="panel-heading"><div><span className="section-icon lavender"><MessageSquareText /></span><div><h3>آخر الملاحظات</h3><p>من العائلة</p></div></div><button onClick={() => router.push("/notes")}>كل الملاحظات</button></div>{notes.length === 0 ? <div className="empty-state"><span><MessageSquareText /></span><h4>لا توجد ملاحظات بعد</h4><button onClick={() => router.push("/notes")}>إضافة ملاحظة</button></div> : <div className="dashboard-notes">{notes.slice(0, 3).map((note) => <button key={note.id} onClick={() => router.push("/notes")}><strong>{profileById.get(note.author_id)?.full_name ?? "العائلة"}</strong><p>{note.content}</p></button>)}</div>}</section>
        <section className="panel progress-panel"><div className="panel-heading"><div><span className="section-icon peach"><BookOpen /></span><div><h3>تقدم المواد</h3><p>السادس العلمي</p></div></div><button onClick={() => router.push("/subjects")}>كل المواد</button></div><div className="subject-placeholder"><div className="subject-ring" style={{ background: `conic-gradient(#d8af5a ${percentage * 3.6}deg, #e9ece5 0deg)` }}><span>{percentage}%</span></div><div><strong>{passedCount} من {chapters.length} فصل مكتمل</strong><p>{readyCount ? `${readyCount} فصل جاهز للاختبار.` : "يُحتسب التقدم بعد اعتماد اختبارات الفصول."}</p></div></div></section>
        <section className="panel family-panel"><div className="panel-heading"><div><span className="section-icon mint"><Users /></span><div><h3>العائلة</h3><p>المشتركون في المتابعة</p></div></div></div><div className="family-list">{profiles.filter((item) => item.role !== "student").map((item, index) => <div key={item.id}><span className={`mini-avatar avatar-${(index % 4) + 1}`}>{item.full_name.charAt(0)}</span><strong>{relationshipLabels[item.relationship]} {item.full_name}</strong></div>)}</div></section>
      </div>{loading && <div className="dashboard-loading"><span className="spinner dark" /> جارٍ تحديث البيانات...</div>}</section>
  </main>;
}

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [booting, setBooting] = useState(true);
  useEffect(() => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    if ("serviceWorker" in navigator) navigator.serviceWorker.register(`${basePath}/sw.js`).catch(() => undefined);
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return setBooting(false);
    try { const session = JSON.parse(raw) as StoredSession; loadProfile(session.accessToken, session.userId).then(setProfile).catch(() => localStorage.removeItem(STORAGE_KEY)).finally(() => setBooting(false)); }
    catch { localStorage.removeItem(STORAGE_KEY); setBooting(false); }
  }, []);
  function logout() { supabase.auth.signOut().catch(() => undefined); localStorage.removeItem(STORAGE_KEY); setProfile(null); }
  if (booting) return <main className="boot-screen" dir="rtl"><BrandMark /><span className="spinner dark" /></main>;
  if (!profile) return <LoginScreen onLogin={setProfile} />;
  return <Dashboard profile={profile} onLogout={logout} />;
}
