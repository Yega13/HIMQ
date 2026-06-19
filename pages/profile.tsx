import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {
  Zap, Flame, BookOpenCheck, Edit2, Check, X, LogOut, Bookmark, Calendar, ExternalLink, Trash2,
  Camera, Sun, Moon, Mail, Lock, AlertTriangle, Hash, Trophy, Gem, Shield, Medal, Award,
} from 'lucide-react';
import { motion } from 'framer-motion';
import Layout from '@/components/Layout';
import { useUser } from '@/lib/useUser';
import { getBrowserClient, IS_MOCK } from '@/lib/supabase';
import { mockDeleteAccount } from '@/lib/mockClient';
import { cn } from '@/lib/utils';
import { getSavedEvents, removeSavedEvent, type SavedEvent } from '@/lib/savedEvents';

interface Profile {
  full_name: string | null;
  username: string | null;
  bio: string | null;
  goal: string | null;
  skill_level: string | null;
  preferred_language: string;
  xp: number;
  streak_days: number;
  lessons_completed?: number;
  avatar_url?: string | null;
  created_at: string;
}

const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced'];
const LANGUAGES = [
  { value: 'am', label: 'Հայերեն' },
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
];

const TIERS = [
  { id: 'diamond', min: 1500, icon: Gem, badge: 'bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-300' },
  { id: 'platinum', min: 800, icon: Shield, badge: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-300' },
  { id: 'gold', min: 400, icon: Trophy, badge: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300' },
  { id: 'silver', min: 150, icon: Medal, badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  { id: 'bronze', min: 0, icon: Award, badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300' },
];
function tierFor(xp: number) {
  return TIERS.find((tt) => xp >= tt.min) ?? TIERS[TIERS.length - 1];
}

const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] transition placeholder-[var(--text-muted)]';

export default function ProfilePage() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user, loading: userLoading } = useUser();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  // Edit form
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [goal, setGoal] = useState('');
  const [skillLevel, setSkillLevel] = useState('beginner');

  const [rank, setRank] = useState<number | null>(null);
  const [savedEvents, setSavedEvents] = useState<SavedEvent[]>([]);

  // Settings
  const [dark, setDark] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailMsg, setEmailMsg] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userLoading && !user) router.replace('/auth');
  }, [user, userLoading, router]);

  useEffect(() => {
    const refresh = () => setSavedEvents(getSavedEvents());
    refresh();
    window.addEventListener('ep-saved-events-changed', refresh);
    return () => window.removeEventListener('ep-saved-events-changed', refresh);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDark(stored === 'dark' || (!stored && prefersDark));
  }, []);

  useEffect(() => {
    if (!user) return;
    const supabase = getBrowserClient();
    supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
      if (data) {
        setProfile(data as Profile);
        setFullName(data.full_name ?? '');
        setUsername(data.username ?? '');
        setBio(data.bio ?? '');
        setGoal(data.goal ?? '');
        setSkillLevel(data.skill_level ?? 'beginner');
      }
      setPageLoading(false);
    });
    supabase.from('profiles').select('id, xp').order('xp', { ascending: false }).limit(1000).then(({ data }) => {
      const list = (data ?? []) as { id: string }[];
      const idx = list.findIndex((r) => r.id === user.id);
      setRank(idx >= 0 ? idx + 1 : null);
    });
  }, [user]);

  const handleRemoveSaved = (id: string) => {
    removeSavedEvent(id);
    setSavedEvents(getSavedEvents());
  };

  const applyTheme = (d: boolean) => {
    setDark(d);
    document.documentElement.classList.toggle('dark', d);
    localStorage.setItem('theme', d ? 'dark' : 'light');
  };

  const setLanguage = (code: string) => {
    if (user) getBrowserClient().from('profiles').update({ preferred_language: code }).eq('id', user.id);
    setProfile((p) => (p ? { ...p, preferred_language: code } : p));
    router.push({ pathname: router.pathname, query: router.query }, router.asPath, { locale: code });
  };

  const handlePhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      await getBrowserClient().from('profiles').update({ avatar_url: dataUrl }).eq('id', user.id);
      setProfile((p) => (p ? { ...p, avatar_url: dataUrl } : p));
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = async () => {
    if (!user) return;
    await getBrowserClient().from('profiles').update({ avatar_url: null }).eq('id', user.id);
    setProfile((p) => (p ? { ...p, avatar_url: null } : p));
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const supabase = getBrowserClient();
    const [{ data }] = await Promise.all([
      supabase.from('profiles')
        .update({ full_name: fullName, username: username || null, bio: bio || null, goal, skill_level: skillLevel })
        .eq('id', user.id).select().single(),
      supabase.auth.updateUser({ data: { full_name: fullName } }),
    ]);
    if (data) setProfile(data as Profile);
    setSaving(false);
    setEditing(false);
  };

  const changeEmail = async () => {
    if (!newEmail.trim()) return;
    setEmailSaving(true);
    setEmailMsg('');
    const { error } = await getBrowserClient().auth.updateUser({ email: newEmail.trim() });
    setEmailSaving(false);
    if (error) setEmailMsg(error.message);
    else { setEmailMsg(t('profile.email_updated') as string); setNewEmail(''); }
  };

  const changePassword = async () => {
    if (newPassword.length < 8) return;
    setPwSaving(true);
    setPwMsg('');
    const { error } = await getBrowserClient().auth.updateUser({ password: newPassword });
    setPwSaving(false);
    if (error) setPwMsg(error.message);
    else { setPwMsg(t('profile.password_updated') as string); setNewPassword(''); }
  };

  const handleSignOut = async () => {
    await getBrowserClient().auth.signOut();
    router.push('/auth');
  };

  const handleDelete = async () => {
    setDeleting(true);
    if (IS_MOCK) mockDeleteAccount();
    else await getBrowserClient().auth.signOut();
    router.push('/auth');
  };

  if (userLoading || pageLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="h-40 rounded-3xl bg-[var(--border)] animate-pulse mb-16" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] animate-pulse" />)}
          </div>
          <div className="h-40 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] animate-pulse" />
        </div>
      </Layout>
    );
  }

  const displayName = profile?.full_name || user?.email?.split('@')[0] || '?';
  const initialLetter = displayName[0].toUpperCase();
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';
  const tier = tierFor(profile?.xp ?? 0);
  const currentLang = (router.locale as string) || profile?.preferred_language || 'am';

  const stats = [
    { label: t('profile.xp'), value: profile?.xp ?? 0, Icon: Zap, color: 'text-[var(--color-gold)]', bg: 'bg-[var(--color-gold)]/10' },
    { label: t('profile.rank'), value: rank ? `#${rank}` : '—', Icon: Hash, color: 'text-[var(--color-brand)]', bg: 'bg-[var(--color-brand-soft)]' },
    { label: t('profile.streak'), value: profile?.streak_days ?? 0, Icon: Flame, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
    { label: t('profile.lessons'), value: profile?.lessons_completed ?? 0, Icon: BookOpenCheck, color: 'text-[var(--color-green)]', bg: 'bg-green-50 dark:bg-green-900/20' },
  ];

  return (
    <Layout>
      <Head><title>{`${t('profile.title')} — Himq`}</title></Head>
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header banner */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative mb-20">
          <div className="h-36 sm:h-44 rounded-3xl bg-gradient-to-r from-[var(--color-brand)] via-[#1d3262] to-[#0a1733] relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-52 h-52 rounded-full bg-white/10" />
            <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full bg-[var(--color-gold)]/10 blur-2xl" />
          </div>

          <div className="absolute left-6 -bottom-12">
            <div className="relative w-24 h-24 rounded-2xl ring-4 ring-[var(--bg-primary)] overflow-hidden bg-[var(--color-brand)] flex items-center justify-center shadow-[var(--shadow-lg)]">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-3xl font-bold">{initialLetter}</span>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute inset-x-0 bottom-0 h-7 bg-black/45 text-white flex items-center justify-center hover:bg-black/60 transition-colors"
                aria-label={t('profile.change_photo') as string}
              >
                <Camera size={14} />
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
          </div>

          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/15 text-white text-sm font-medium backdrop-blur-sm hover:bg-white/25 transition-colors"
            >
              <Edit2 size={14} />
              {t('profile.edit_profile')}
            </button>
          )}
        </motion.div>

        {/* Name row */}
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <h1 className="text-2xl font-extrabold text-[var(--text-primary)]">{displayName}</h1>
          <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold', tier.badge)}>
            <tier.icon size={13} />
            {t(`leaderboard.tier_${tier.id}`)}
          </span>
          {profile?.avatar_url && (
            <button onClick={removePhoto} className="text-xs text-[var(--text-muted)] hover:text-red-500 transition-colors">
              {t('profile.remove_photo')}
            </button>
          )}
        </div>
        <p className="text-sm text-[var(--text-muted)] mb-8">
          {profile?.username ? `@${profile.username} · ` : ''}{memberSince ? `${t('profile.member_since')} ${memberSince}` : ''}
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-[var(--shadow-sm)]"
            >
              <span className={cn('flex items-center justify-center w-9 h-9 rounded-xl mb-3', s.bg)}>
                <s.Icon size={18} className={s.color} />
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{s.label}</p>
              <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{s.value}</p>
            </motion.div>
          ))}
        </div>

        {/* About / Edit */}
        <Section title={t('profile.about') as string}>
          {editing ? (
            <div className="space-y-4">
              <Field label={t('auth.full_name') as string}>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
              </Field>
              <Field label={t('profile.username_label') as string}>
                <input value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))} placeholder={t('profile.username_placeholder') as string} className={inputCls} />
              </Field>
              <Field label={t('profile.bio_label') as string}>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} placeholder={t('profile.bio_placeholder') as string} className={cn(inputCls, 'resize-none')} />
              </Field>
              <Field label={t('profile.goal_label') as string}>
                <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} placeholder={t('profile.goal_placeholder') as string} className={cn(inputCls, 'resize-none')} />
              </Field>
              <Field label={t('profile.skill_label') as string}>
                <div className="flex gap-2">
                  {SKILL_LEVELS.map((sk) => (
                    <button key={sk} type="button" onClick={() => setSkillLevel(sk)}
                      className={cn('flex-1 py-2 rounded-xl text-xs font-medium border transition-all',
                        skillLevel === sk ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--color-brand)]')}>
                      {t(`common.${sk}`)}
                    </button>
                  ))}
                </div>
              </Field>
              <div className="flex gap-2 pt-1">
                <button onClick={saveProfile} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--color-brand)] text-white text-sm font-semibold hover:bg-[var(--color-brand-hover)] transition-colors disabled:opacity-60">
                  <Check size={14} />{saving ? t('common.loading') : t('profile.save')}
                </button>
                <button onClick={() => setEditing(false)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:border-[var(--color-brand)] transition-colors">
                  <X size={14} />{t('profile.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-0.5">{t('profile.bio_label')}</p>
                <p className="text-sm text-[var(--text-primary)]">
                  {profile?.bio || <span className="italic text-[var(--text-muted)]">{t('profile.no_bio')}</span>}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-0.5">{t('profile.goal_label')}</p>
                <p className="text-sm text-[var(--text-primary)]">
                  {profile?.goal || <span className="italic text-[var(--text-muted)]">{t('profile.no_goal')}</span>}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-0.5">{t('profile.skill_label')}</p>
                <p className="text-sm text-[var(--text-primary)]">{profile?.skill_level ? t(`common.${profile.skill_level}`) : '—'}</p>
              </div>
            </div>
          )}
        </Section>

        {/* Saved opportunities */}
        <Section
          title={t('profile.saved_title') as string}
          icon={<Bookmark size={15} className="text-[var(--color-brand)]" />}
          action={savedEvents.length > 0 ? <Link href="/opportunities" className="text-xs font-medium text-[var(--color-brand)] hover:underline">{t('profile.saved_browse')}</Link> : undefined}
        >
          {savedEvents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border-strong)] px-4 py-8 text-center">
              <p className="text-sm text-[var(--text-muted)] mb-3">{t('profile.saved_empty')}</p>
              <Link href="/opportunities" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-brand)] hover:underline">{t('profile.saved_browse')} →</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {savedEvents.map((ev) => {
                const d = ev.deadline ? Math.ceil((new Date(ev.deadline).getTime() - Date.now()) / 86400000) : null;
                return (
                  <div key={ev.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-3">
                    <Link href={`/opportunities/${ev.id}`} className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)] truncate hover:text-[var(--color-brand)] transition-colors">{ev.title}</p>
                      <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-2 mt-0.5">
                        <span className="capitalize">{ev.event_type}</span>
                        {d !== null && d >= 0 && <span className="flex items-center gap-1"><Calendar size={10} />{d} {t('opportunities.days_left')}</span>}
                      </p>
                    </Link>
                    {ev.link && (
                      <a href={ev.link} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[var(--text-muted)] hover:text-[var(--color-brand)] transition-colors" title={t('opportunities.apply') as string}>
                        <ExternalLink size={15} />
                      </a>
                    )}
                    <button onClick={() => handleRemoveSaved(ev.id)} className="shrink-0 text-[var(--text-muted)] hover:text-red-500 transition-colors" title={t('common.cancel') as string}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Preferences */}
        <Section title={t('profile.preferences') as string}>
          <div className="space-y-5">
            <Field label={t('profile.language_label') as string}>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((l) => (
                  <button key={l.value} type="button" onClick={() => setLanguage(l.value)}
                    className={cn('px-4 py-2 rounded-xl text-sm font-medium border transition-all',
                      currentLang === l.value ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--color-brand)]')}>
                    {l.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={t('profile.theme') as string}>
              <div className="flex gap-2">
                <button type="button" onClick={() => applyTheme(false)}
                  className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all',
                    !dark ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--color-brand)]')}>
                  <Sun size={15} />{t('profile.theme_light')}
                </button>
                <button type="button" onClick={() => applyTheme(true)}
                  className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all',
                    dark ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--color-brand)]')}>
                  <Moon size={15} />{t('profile.theme_dark')}
                </button>
              </div>
            </Field>
          </div>
        </Section>

        {/* Account */}
        <Section title={t('profile.account') as string}>
          <div className="space-y-5">
            <Field label={t('profile.change_email') as string}>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder={t('profile.new_email') as string} className={cn(inputCls, 'pl-10')} />
                </div>
                <button onClick={changeEmail} disabled={emailSaving || !newEmail.trim()}
                  className="px-5 py-2.5 rounded-xl bg-[var(--color-brand)] text-white text-sm font-semibold hover:bg-[var(--color-brand-hover)] transition-colors disabled:opacity-50 shrink-0">
                  {emailSaving ? t('common.loading') : t('profile.update')}
                </button>
              </div>
              {emailMsg && <p className="text-xs text-[var(--text-secondary)] mt-1.5">{emailMsg}</p>}
            </Field>
            <Field label={t('profile.change_password') as string}>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t('profile.new_password') as string} className={cn(inputCls, 'pl-10')} />
                </div>
                <button onClick={changePassword} disabled={pwSaving || newPassword.length < 8}
                  className="px-5 py-2.5 rounded-xl bg-[var(--color-brand)] text-white text-sm font-semibold hover:bg-[var(--color-brand-hover)] transition-colors disabled:opacity-50 shrink-0">
                  {pwSaving ? t('common.loading') : t('profile.update')}
                </button>
              </div>
              {pwMsg && <p className="text-xs text-[var(--text-secondary)] mt-1.5">{pwMsg}</p>}
            </Field>
          </div>
        </Section>

        {/* Danger zone */}
        <div className="rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50/40 dark:bg-red-900/10 p-5 mb-8">
          <h2 className="flex items-center gap-2 text-sm font-bold text-red-600 dark:text-red-400 mb-1">
            <AlertTriangle size={15} />{t('profile.danger_zone')}
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mb-4">{t('profile.delete_warning')}</p>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border-strong)] text-[var(--text-primary)] text-sm font-medium hover:border-[var(--color-brand)] transition-colors">
              <LogOut size={14} />{t('profile.sign_out')}
            </button>
            {!deleteConfirm ? (
              <button onClick={() => setDeleteConfirm(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                <Trash2 size={14} />{t('profile.delete_account')}
              </button>
            ) : (
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60">
                <Trash2 size={14} />{deleting ? t('common.loading') : t('profile.delete_confirm')}
              </button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function Section({ title, icon, action, children }: { title: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35 }}
      className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 shadow-[var(--shadow-sm)] mb-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">{icon}{title}</h2>
        {action}
      </div>
      {children}
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? 'am', ['common'])),
  },
});
