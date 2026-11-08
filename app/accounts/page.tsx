"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Pencil, Plus, RefreshCw, RotateCcw, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { supabase } from "../../lib/supabase";
import styles from "./accounts.module.css";

type Profile = {
  id: string;
  login_id: string;
  full_name: string;
  role: "student" | "guardian" | "admin";
  relationship: "self" | "brother" | "father" | "mother" | "sister";
  is_active: boolean;
};

const roleNames = { student: "تلميذ", guardian: "ولي أمر", admin: "مدير" };
const relationshipNames = { self: "نفسه", brother: "أخ", father: "أب", mother: "أم", sister: "أخت" };

export default function AccountsPage() {
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [loginId, setLoginId] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState<Profile["role"]>("guardian");
  const [relationship, setRelationship] = useState<Profile["relationship"]>("father");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function initialize() {
    const raw = localStorage.getItem("jaafar-learning-session");
    if (!raw) return void (window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`);
    const saved = JSON.parse(raw);
    const { error } = await supabase.auth.setSession({ access_token: saved.accessToken, refresh_token: saved.refreshToken });
    if (error) return void (window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return void (window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`);
    const { data: me } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (!me || me.role !== "admin") return void (window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`);
    setCurrentProfile(me);
    const { data } = await supabase.from("profiles").select("id, login_id, full_name, role, relationship, is_active").order("full_name");
    setProfiles(data ?? []);
    setLoading(false);
  }

  useEffect(() => { initialize(); }, []);

  function resetForm() {
    setEditing(null); setFullName(""); setLoginId(""); setPin(""); setRole("guardian"); setRelationship("father");
  }

  function beginEdit(profile: Profile) {
    setEditing(profile); setFullName(profile.full_name); setLoginId(profile.login_id); setPin(""); setRole(profile.role); setRelationship(profile.relationship);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function callAdminFunction(payload: Record<string, unknown>) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("انتهت جلسة الدخول.");
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-users`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "تعذر تنفيذ العملية.");
  }

  async function saveAccount(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    try {
      await callAdminFunction({ action: editing ? "update" : "create", userId: editing?.id, fullName, loginId, pin, role, relationship });
      resetForm(); await initialize();
    } catch (error) { window.alert(error instanceof Error ? error.message : "حدث خطأ."); }
    finally { setSaving(false); }
  }

  async function toggleAccount(profile: Profile) {
    if (!window.confirm(`${profile.is_active ? "تعطيل" : "تفعيل"} حساب ${profile.full_name}؟`)) return;
    try { await callAdminFunction({ action: "toggle", userId: profile.id, isActive: !profile.is_active }); await initialize(); }
    catch (error) { window.alert(error instanceof Error ? error.message : "حدث خطأ."); }
  }

  async function resetPlatformData() {
    const confirmation = window.prompt(
      "سيتم حذف جميع بيانات التقدم والجلسات والاختبارات والملاحظات وتغييرات المواعيد. لن تُحذف الحسابات أو المواد أو الجدول الأساسي. اكتب: تصفير المنصة"
    );

    if (confirmation !== "تصفير المنصة") return;

    const { error } = await supabase.rpc("admin_reset_all_learning_data");

    if (error) {
      window.alert(error.message);
      return;
    }

    window.alert("تم تصفير بيانات المتابعة بنجاح.");
  }

  if (loading) return <main className={styles.loading}><RefreshCw className={styles.spin} /><p>جارٍ تحميل الحسابات...</p></main>;

  return <main className={styles.page} dir="rtl">
    <header className={styles.header}><div><Link href="/" className={styles.back}><ArrowRight size={18} />الرئيسية</Link><h1>إدارة الحسابات</h1><p>هذه الصفحة متاحة للمدير فقط</p></div><span><ShieldCheck /> {currentProfile?.full_name}</span></header>
    <form className={styles.form} onSubmit={saveAccount}><div className={styles.formHeading}><Plus /><div><h2>{editing ? `تعديل حساب ${editing.full_name}` : "إنشاء حساب جديد"}</h2><p>{editing ? "اترك PIN فارغًا إذا لم ترغب بتغييره" : "اكتب بيانات الشخص ورمز PIN من 6 أرقام"}</p></div></div><div className={styles.formGrid}><label>الاسم الكامل<input value={fullName} onChange={(event) => setFullName(event.target.value)} required /></label><label>المعرّف ID<input dir="ltr" value={loginId} onChange={(event) => setLoginId(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} required /></label><label>رمز PIN<input dir="ltr" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} required={!editing} placeholder={editing ? "اتركه فارغًا دون تغيير" : "6 أرقام"} /></label><label>نوع الحساب<select value={role} onChange={(event) => setRole(event.target.value as Profile["role"])}><option value="student">تلميذ</option><option value="guardian">ولي أمر</option><option value="admin">مدير</option></select></label><label>الصفة<select value={relationship} onChange={(event) => setRelationship(event.target.value as Profile["relationship"])}><option value="self">نفسه</option><option value="brother">أخ</option><option value="father">أب</option><option value="mother">أم</option><option value="sister">أخت</option></select></label></div><div className={styles.formActions}><button type="submit" disabled={saving}>{saving ? "جارٍ الحفظ..." : editing ? "حفظ التعديلات" : "إنشاء الحساب"}</button>{editing && <button type="button" onClick={resetForm}>إلغاء</button>}</div></form>
    <section className={styles.list}><div className={styles.listHeading}><h2>الحسابات الحالية</h2><strong>{profiles.length}</strong></div>{profiles.map((profile) => <article className={!profile.is_active ? styles.inactive : ""} key={profile.id}><span className={styles.avatar}>{profile.full_name.charAt(0)}</span><div><h3>{profile.full_name}</h3><p>{roleNames[profile.role]} — {relationshipNames[profile.relationship]}</p><small dir="ltr">ID: {profile.login_id}</small></div><span className={profile.is_active ? styles.activeBadge : styles.inactiveBadge}>{profile.is_active ? "فعّال" : "معطّل"}</span><div className={styles.actions}><button onClick={() => beginEdit(profile)}><Pencil size={16} />تعديل</button><button disabled={profile.id === currentProfile?.id} onClick={() => toggleAccount(profile)}>{profile.is_active ? <UserX size={16} /> : <UserCheck size={16} />}{profile.is_active ? "تعطيل" : "تفعيل"}</button></div></article>)}</section>
    <section className={styles.dangerZone}><div><h2>تصحيح بيانات المنصة</h2><p>استخدم هذا الخيار فقط عند الرغبة في بدء المتابعة من الصفر. الحسابات والمواد والفصول والجدول الأساسي لن تُحذف.</p></div><button onClick={resetPlatformData}><RotateCcw size={17} />تصفير بيانات المنصة</button></section>
  </main>;
}
