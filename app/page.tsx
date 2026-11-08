"use client";

import {
  Bell, BookOpen, CalendarDays, CheckCircle2, ChevronLeft, ClipboardCheck,
  Clock3, GraduationCap, LogOut, Menu, MessageSquareText, Play, ShieldCheck,
  Sparkles, Users, X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const INTERNAL_DOMAIN = "jaafar-learning.local";
const STORAGE_KEY = "jaafar-learning-session";

type Profile = {
  id: string;
  login_id: string;
  full_name: string;
  role: "student" | "guardian" | "admin";
  relationship: "self" | "brother" | "father" | "mother" | "sister";
};

type StoredSession = { accessToken: string; refreshToken: string; userId: string };
type ScheduleItem = { time: string; title: string; subtitle: string; kind: "study" | "school" | "break" };

const roleLabels: Record<Profile["role"], string> = {
  student: "حساب التلميذ", guardian: "حساب ولي أمر", admin: "المدير",
};
const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function scheduleForDay(day: number): ScheduleItem[] {
  if (day === 0 || day === 1) return [
    { time: "7:30 ص - 12:30 م", title: "المدرسة", subtitle: "الدوام الصباحي", kind: "school" },
    { time: "2:00 م - 4:00 م", title: "الجلسة الأولى", subtitle: "المواد الثقيلة", kind: "study" },
    { time: "7:00 م - 9:00 م", title: "الجلسة الثانية", subtitle: "مراجعة وحفظ", kind: "study" },
  ];
  if (day >= 2 && day <= 4) return [
    { time: "9:00 ص - 11:00 ص", title: "الجلسة الأولى", subtitle: "المواد الثقيلة", kind: "study" },
    { time: "12:00 م - 4:30 م", title: "المدرسة", subtitle: "الدوام الظهري", kind: "school" },
    { time: "7:00 م - 9:00 م", title: "الجلسة الثانية", subtitle: "مراجعة وحفظ", kind: "study" },
  ];
  return [
    { time: "9:00 ص - 11:00 ص", title: "الجلسة الأولى", subtitle: "دراسة مركزة", kind: "study" },
    { time: "2:00 م - 4:00 م", title: "الجلسة الثانية", subtitle: "دراسة مركزة", kind: "study" },
    { time: "7:00 م - 9:00 م", title: "الجلسة الثالثة", subtitle: "المراجعة الأسبوعية", kind: "study" },
  ];
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

function BrandMark({ compact = false }: { compact?: boolean }) {
  return <div className="brand-lockup">
    <span className={compact ? "brand-mark brand-mark-small" : "brand-mark"}><GraduationCap aria-hidden="true" /></span>
    {!compact && <span><strong>المنصة التعليمية</strong><small>رحلة جعفر نحو التفوق</small></span>}
  </div>;
}

function LoginScreen({ onLogin }: { onLogin: (profile: Profile) => void }) {
  const [loginId, setLoginId] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const normalizedId = loginId.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(normalizedId)) { setError("اكتب المعرّف بحروف إنجليزية، مثل jaafar"); return; }
    if (!/^\d{6}$/.test(pin)) { setError("رمز PIN يجب أن يتكون من 6 أرقام"); return; }
    setLoading(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
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
    <section className="login-intro">
      <BrandMark />
      <div className="intro-copy">
        <span className="eyebrow"><Sparkles size={16} /> تنظيم، متابعة، إنجاز</span>
        <h1>كل خطوة دراسية<br />تصنع فرقًا.</h1>
        <p>مكان واحد يجمع جلسات جعفر، اختبارات العائلة، الملاحظات، وتقدم المواد والفصول.</p>
      </div>
      <div className="feature-row">
        <span><Clock3 /> جلسات مباشرة</span><span><ClipboardCheck /> اختبارات ومتابعة</span><span><ShieldCheck /> عائلي وآمن</span>
      </div>
    </section>
    <section className="login-panel-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="mobile-brand"><BrandMark /></div>
        <div className="login-card-head"><span className="login-icon"><BookOpen /></span><div><p>مرحبًا بك</p><h2>سجّل الدخول إلى المنصة</h2></div></div>
        <label htmlFor="login-id">المعرّف الشخصي</label>
        <div className="input-shell" dir="ltr"><input id="login-id" value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="jaafar" autoComplete="username" spellCheck={false} /></div>
        <label htmlFor="pin">رمز PIN</label>
        <div className="input-shell" dir="ltr"><input id="pin" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="••••••" autoComplete="current-password" /></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={loading}>{loading ? <span className="spinner" /> : <>دخول إلى المنصة <ChevronLeft size={19} /></>}</button>
        <p className="privacy-note"><ShieldCheck size={15} /> الدخول مخصص لجعفر وعائلته فقط</p>
      </form>
    </section>
  </main>;
}

function Dashboard({ profile, onLogout }: { profile: Profile; onLogout: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const now = useMemo(() => new Date(), []);
  const todaySchedule = useMemo(() => scheduleForDay(now.getDay()), [now]);
  const isStudent = profile.role === "student";
  const dateLabel = new Intl.DateTimeFormat("ar-IQ", { weekday: "long", day: "numeric", month: "long" }).format(now);
  const navItems = [
    { label: "الرئيسية", icon: Sparkles, active: true }, { label: "المواد والفصول", icon: BookOpen },
    { label: "جلسات الدراسة", icon: Clock3 }, { label: "الاختبارات", icon: ClipboardCheck },
    { label: "الملاحظات", icon: MessageSquareText },
    ...(profile.role === "admin" ? [{ label: "إدارة الحسابات", icon: Users }] : []),
  ];

  return <main className="app-shell" dir="rtl">
    <aside className={menuOpen ? "sidebar sidebar-open" : "sidebar"}>
      <div className="sidebar-brand"><BrandMark /></div>
      <button className="sidebar-close" onClick={() => setMenuOpen(false)} aria-label="إغلاق القائمة"><X /></button>
      <nav>
  {navItems.map(({ label, icon: Icon, active }) => (
    <button
      key={label}
      className={active ? "nav-item nav-active" : "nav-item"}
      onClick={() => {
  if (label === "المواد والفصول") {
    window.location.href = "/subjects";
  }

  if (label === "جلسات الدراسة") {
    window.location.href = "/sessions";
  }
}}
    >
      <Icon size={20} />
      {label}
    </button>
  ))}
</nav>
      <div className="sidebar-user"><span className="avatar">{profile.full_name.charAt(0)}</span><div><strong>{profile.full_name}</strong><small>{roleLabels[profile.role]}</small></div><button onClick={onLogout} aria-label="تسجيل الخروج"><LogOut size={18} /></button></div>
    </aside>
    {menuOpen && <button className="menu-backdrop" onClick={() => setMenuOpen(false)} aria-label="إغلاق القائمة" />}
    <section className="main-area">
      <header className="topbar"><button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="فتح القائمة"><Menu /></button><div><p>{dateLabel}</p><h1>أهلًا، {profile.full_name.split(" ")[0]} 👋</h1></div><button className="notification-button" aria-label="الإشعارات"><Bell /><span /></button></header>
      <div className="content-grid">
        <section className="hero-card"><div><span className="hero-kicker">{isStudent ? "جلسة اليوم التالية" : "متابعة جعفر اليوم"}</span><h2>{isStudent ? "جاهز لجلسة دراسة مركزة؟" : "كل شيء يسير حسب الخطة"}</h2><p>{isStudent ? "اختر المادة والفصل، ثم ابدأ العداد عندما تكون مستعدًا." : "ستظهر هنا الجلسة المباشرة وأي تغيير يجريه جعفر على مواعيده."}</p><button><Play size={18} fill="currentColor" /> {isStudent ? "بدء جلسة الدراسة" : "عرض جلسات اليوم"}</button></div><div className="hero-visual" aria-hidden="true"><span className="book book-one" /><span className="book book-two" /><span className="hero-clock"><Clock3 /></span></div></section>
        <section className="stats-row"><article><span className="stat-icon green"><CheckCircle2 /></span><div><strong>0</strong><small>فصول مكتملة</small></div></article><article><span className="stat-icon gold"><Clock3 /></span><div><strong>0 س</strong><small>دراسة هذا الأسبوع</small></div></article><article><span className="stat-icon blue"><ClipboardCheck /></span><div><strong>0</strong><small>اختبارات قادمة</small></div></article></section>
        <section className="panel schedule-panel"><div className="panel-heading"><div><span className="section-icon"><CalendarDays /></span><div><h3>جدول اليوم</h3><p>{dayNames[now.getDay()]}</p></div></div><button>عرض الجدول كاملًا</button></div><div className="timeline">{todaySchedule.map((item, index) => <article className="timeline-item" key={`${item.time}-${item.title}`}><span className={`timeline-dot ${item.kind}`} /><div className="timeline-copy"><strong>{item.title}</strong><small>{item.subtitle}</small></div><time>{item.time}</time>{index === 0 && <span className="status-chip">حسب الخطة</span>}</article>)}</div></section>
        <section className="panel notes-panel"><div className="panel-heading"><div><span className="section-icon lavender"><MessageSquareText /></span><div><h3>آخر الملاحظات</h3><p>من العائلة</p></div></div></div><div className="empty-state"><span><MessageSquareText /></span><h4>لا توجد ملاحظات بعد</h4><p>{isStudent ? "ستظهر هنا الملاحظات التي ترسلها العائلة." : "يمكنك إضافة أول ملاحظة لجعفر في المرحلة القادمة."}</p><button>إضافة ملاحظة</button></div></section>
        <section className="panel progress-panel"><div className="panel-heading"><div><span className="section-icon peach"><BookOpen /></span><div><h3>تقدم المواد</h3><p>السادس العلمي</p></div></div><button>كل المواد</button></div><div className="subject-placeholder"><div className="subject-ring"><span>0%</span></div><div><strong>لم يبدأ التقدم بعد</strong><p>سنضيف المواد والفصول في المرحلة التالية، ثم يظهر تقدم كل مادة هنا.</p></div></div></section>
        <section className="panel family-panel"><div className="panel-heading"><div><span className="section-icon mint"><Users /></span><div><h3>العائلة</h3><p>المشتركون في المتابعة</p></div></div></div><div className="family-list">{["أخي علي", "أبي", "أمي", "أختي فاطمة"].map((name, index) => <div key={name}><span className={`mini-avatar avatar-${index + 1}`}>{name.replace("أخي ", "").replace("أختي ", "").charAt(0)}</span><strong>{name}</strong></div>)}</div></section>
      </div>
    </section>
  </main>;
}

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [booting, setBooting] = useState(true);
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { setBooting(false); return; }
    try {
      const session = JSON.parse(raw) as StoredSession;
      loadProfile(session.accessToken, session.userId).then(setProfile).catch(() => localStorage.removeItem(STORAGE_KEY)).finally(() => setBooting(false));
    } catch { localStorage.removeItem(STORAGE_KEY); setBooting(false); }
  }, []);
  function logout() { localStorage.removeItem(STORAGE_KEY); setProfile(null); }
  if (booting) return <main className="boot-screen" dir="rtl"><BrandMark /><span className="spinner dark" /></main>;
  if (!profile) return <LoginScreen onLogin={setProfile} />;
  return <Dashboard profile={profile} onLogout={logout} />;
}
