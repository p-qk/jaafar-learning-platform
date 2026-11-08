"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  History,
  Pencil,
  RefreshCw,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import styles from "./schedule.module.css";

type Profile = {
  id: string;
  full_name: string;
  role: "student" | "guardian" | "admin";
};

type Schedule = {
  id: string;
  day_of_week: number;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  sort_order: number;
};

type ScheduleChange = {
  id: string;
  schedule_id: string;
  schedule_date: string;
  new_start_time: string;
  new_end_time: string;
  reason: string | null;
  changed_by: string;
  created_at: string;
};

const dayNames = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(2000, 0, 1, hours, minutes);

  return new Intl.DateTimeFormat("ar-IQ", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function SchedulePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [schedule, setSchedule] = useState<Schedule[]>([]);
  const [changes, setChanges] = useState<ScheduleChange[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const today = new Date();
  const todayKey = getLocalDateKey(today);
  const todayNumber = today.getDay();

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
      { data: scheduleData },
      { data: changesData },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", user.id)
        .single(),

      supabase
        .from("study_schedule")
        .select("*")
        .eq("is_active", true)
        .order("day_of_week")
        .order("sort_order"),

      supabase
        .from("schedule_changes")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    setProfile(currentProfile ?? null);
    setSchedule(scheduleData ?? []);
    setChanges(changesData ?? []);
    setLoading(false);
  }

  useEffect(() => {
    initialize();

    const channel = supabase
      .channel("shared-schedule-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "schedule_changes",
        },
        initialize
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const latestTodayChangeBySchedule = useMemo(() => {
    const result = new Map<string, ScheduleChange>();

    for (const change of changes) {
      if (
        change.schedule_date === todayKey &&
        !result.has(change.schedule_id)
      ) {
        result.set(change.schedule_id, change);
      }
    }

    return result;
  }, [changes, todayKey]);

  const todaySchedule = schedule.filter(
    (item) => item.day_of_week === todayNumber
  );

  function beginChange(item: Schedule) {
    const currentChange = latestTodayChangeBySchedule.get(item.id);

    setEditingId(item.id);
    setNewStartTime(
      (currentChange?.new_start_time ?? item.start_time).slice(0, 5)
    );
    setNewEndTime(
      (currentChange?.new_end_time ?? item.end_time).slice(0, 5)
    );
    setReason(currentChange?.reason ?? "");
  }

  function cancelChange() {
    setEditingId(null);
    setNewStartTime("");
    setNewEndTime("");
    setReason("");
  }

  async function saveChange(
    event: FormEvent<HTMLFormElement>,
    item: Schedule
  ) {
    event.preventDefault();

    if (!profile || profile.role !== "student") return;

    if (!newStartTime || !newEndTime) {
      window.alert("حدد وقت بداية الجلسة ونهايتها.");
      return;
    }

    if (newEndTime <= newStartTime) {
      window.alert("وقت نهاية الجلسة يجب أن يكون بعد وقت البداية.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("schedule_changes")
      .insert({
        schedule_id: item.id,
        schedule_date: todayKey,
        new_start_time: newStartTime,
        new_end_time: newEndTime,
        reason: reason.trim() || null,
        changed_by: profile.id,
      });

    setSaving(false);

    if (error) {
      window.alert(error.message);
      return;
    }

    cancelChange();
    await initialize();
  }

  if (loading) {
    return (
      <main className={styles.loading}>
        <RefreshCw className={styles.spin} />
        <p>جارٍ تحميل الجدول الدراسي...</p>
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

          <h1>الجدول الدراسي</h1>
          <p>مواعيد جلسات جعفر اليومية والأسبوعية</p>
        </div>

        <span className={styles.account}>
          {profile?.full_name}
        </span>
      </header>

      <section className={styles.todaySection}>
        <div className={styles.todayHeading}>
          <div>
            <span className={styles.todayIcon}>
              <CalendarDays size={24} />
            </span>

            <div>
              <h2>جلسات اليوم</h2>
              <p>
                {dayNames[todayNumber]}،{" "}
                {new Intl.DateTimeFormat("ar-IQ", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }).format(today)}
              </p>
            </div>
          </div>

          <strong>{todaySchedule.length}</strong>
        </div>

        <div className={styles.todayList}>
          {todaySchedule.length === 0 ? (
            <div className={styles.empty}>
              <CalendarDays size={32} />
              <p>لا توجد جلسات مقررة لهذا اليوم.</p>
            </div>
          ) : (
            todaySchedule.map((item) => {
              const change = latestTodayChangeBySchedule.get(item.id);
              const displayedStart =
                change?.new_start_time ?? item.start_time;
              const displayedEnd =
                change?.new_end_time ?? item.end_time;

              return (
                <article className={styles.todayCard} key={item.id}>
                  <div className={styles.timeBox}>
                    <Clock3 size={20} />
                    <strong>{formatTime(displayedStart)}</strong>
                    <span>إلى {formatTime(displayedEnd)}</span>
                  </div>

                  <div className={styles.sessionInfo}>
                    <div className={styles.titleRow}>
                      <h3>{item.title}</h3>

                      {change && (
                        <span className={styles.changedBadge}>
                          <History size={14} />
                          تم تغيير الموعد
                        </span>
                      )}
                    </div>

                    {change?.reason && (
                      <small className={styles.reason}>
                        سبب التغيير: {change.reason}
                      </small>
                    )}
                  </div>

                  {profile?.role === "student" &&
                    editingId !== item.id && (
                      <button
                        type="button"
                        className={styles.editButton}
                        onClick={() => beginChange(item)}
                      >
                        <Pencil size={16} />
                        تغيير الموعد
                      </button>
                    )}

                  {profile?.role !== "student" && change && (
                    <span className={styles.familyNotice}>
                      غيّر جعفر موعد هذه الجلسة
                    </span>
                  )}

                  {editingId === item.id && (
                    <form
                      className={styles.changeForm}
                      onSubmit={(event) =>
                        saveChange(event, item)
                      }
                    >
                      <label>
                        وقت البداية
                        <input
                          type="time"
                          value={newStartTime}
                          onChange={(event) =>
                            setNewStartTime(event.target.value)
                          }
                        />
                      </label>

                      <label>
                        وقت النهاية
                        <input
                          type="time"
                          value={newEndTime}
                          onChange={(event) =>
                            setNewEndTime(event.target.value)
                          }
                        />
                      </label>

                      <label className={styles.reasonField}>
                        سبب التغيير — اختياري
                        <input
                          value={reason}
                          onChange={(event) =>
                            setReason(event.target.value)
                          }
                          placeholder="مثال: لدي ظرف في الموعد الأصلي"
                        />
                      </label>

                      <div className={styles.formActions}>
                        <button
                          type="submit"
                          className={styles.saveButton}
                          disabled={saving}
                        >
                          <Check size={17} />
                          {saving
                            ? "جارٍ الحفظ..."
                            : "حفظ الموعد"}
                        </button>

                        <button
                          type="button"
                          className={styles.cancelButton}
                          onClick={cancelChange}
                        >
                          <X size={17} />
                          إلغاء
                        </button>
                      </div>
                    </form>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>

      <section className={styles.weekSection}>
        <div className={styles.sectionHeading}>
          <CalendarDays size={23} />
          <div>
            <h2>الجدول الأسبوعي الأساسي</h2>
            <p>الخطة الثابتة لجلسات الدراسة</p>
          </div>
        </div>

        <div className={styles.weekGrid}>
          {dayNames.map((dayName, dayNumber) => {
            const daySchedule = schedule.filter(
              (item) => item.day_of_week === dayNumber
            );

            return (
              <article
                className={`${styles.dayCard} ${
                  dayNumber === todayNumber
                    ? styles.currentDay
                    : ""
                }`}
                key={dayName}
              >
                <div className={styles.dayHeading}>
                  <h3>{dayName}</h3>

                  {dayNumber === todayNumber && (
                    <span>اليوم</span>
                  )}
                </div>

                <div className={styles.daySessions}>
                  {daySchedule.length === 0 ? (
                    <p className={styles.restDay}>
                      لا توجد جلسات
                    </p>
                  ) : (
                    daySchedule.map((item) => (
                      <div
                        className={styles.weekSession}
                        key={item.id}
                      >
                        <strong>{item.title}</strong>

                        <span>
                          {formatTime(item.start_time)} –{" "}
                          {formatTime(item.end_time)}
                        </span>

                      </div>
                    ))
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
