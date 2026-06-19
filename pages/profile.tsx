import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { Zap, Flame, Edit2, Check, X, LogOut, Bookmark, Calendar, ExternalLink, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import Layout from '@/components/Layout';
import { useUser } from '@/lib/useUser';
import { getBrowserClient } from '@/lib/supabase';
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
  created_at: string;
}

const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced'];
const LANGUAGES = [{ value: 'am', label: 'Հայերեն' }, { value: 'en', label: 'English' }];

export default function ProfilePage() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user, loading: userLoading } = useUser();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  // Edit form state
  const [fullName, setFullName]     = useState('');
  const [goal, setGoal]             = useState('');
  const [skillLevel, setSkillLevel] = useState('beginner');
  const [prefLang, setPrefLang]     = useState('am');
  const [savedEvents, setSavedEvents] = useState<SavedEvent[]>([]);

  useEffect(() => {
    const refresh = () => setSavedEvents(getSavedEvents());
    refresh();
    window.addEventListener('ep-saved-events-changed', refresh);
    return () => window.removeEventListener('ep-saved-events-changed', refresh);
  }, []);

  const handleRemoveSaved = (id: string) => {
    removeSavedEvent(id);
    setSavedEvents(getSavedEvents());
  };

  useEffect(() => {
    if (!userLoading && !user) router.replace('/auth');
  }, [user, userLoading, router]);

  useEffect(() => {
    if (!user) return;
    const supabase = getBrowserClient();
    supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
      if (data) {
        setProfile(data as Profile);
        setFullName(data.full_name ?? '');
        setGoal(data.goal ?? '');
        setSkillLevel(data.skill_level ?? 'beginner');
        setPrefLang(data.preferred_language ?? 'am');
      }
      setPageLoading(false);
    });
  }, [user]);

  const handleSignOut = async () => {
    await getBrowserClient().auth.signOut();
    router.push('/auth');
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const supabase = getBrowserClient();
    const [{ data }] = await Promise.all([
      supabase
        .from('profiles')
        .update({ full_name: fullName, goal, skill_level: skillLevel, preferred_language: prefLang })
        .eq('id', user.id)
        .select()
        .single(),
      supabase.auth.updateUser({ data: { full_name: fullName } }),
    ]);
    if (data) setProfile(data as Profile);
    setSaving(false);
    setEditing(false);
  };

  if (userLoading || pageLoading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-8">
          {/* Avatar + name skeleton */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-[var(--border)] animate-pulse" />
            <div>
              <div className="h-5 w-36 rounded-lg bg-[var(--border)] animate-pulse mb-2" />
              <div className="h-3 w-28 rounded bg-[var(--border)] animate-pulse" />
            </div>
          </div>
          {/* Stat cards skeleton */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {[0, 1].map((i) => (
              <div key={i} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--border)] animate-pulse" />
                <div>
                  <div className="h-2.5 w-12 rounded bg-[var(--border)] animate-pulse mb-2" />
                  <div className="h-6 w-10 rounded-lg bg-[var(--border)] animate-pulse" />
                </div>
              </div>
            ))}
          </div>
          {/* Info card skeleton */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 space-y-4">
            {[0, 1].map((i) => (
              <div key={i}>
                <div className="h-2.5 w-20 rounded bg-[var(--border)] animate-pulse mb-2" />
                <div className="h-4 w-3/4 rounded bg-[var(--border)] animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  const displayName = profile?.full_name || user?.email?.split('@')[0] || '?';
  const initial = displayName[0].toUpperCase();
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  return (
    <Layout>
      <Head><title>Profile — Himq</title></Head>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>

          {/* Avatar + name */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-brand)] flex items-center justify-center text-white text-2xl font-bold">
              {initial}
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">{displayName}</h1>
              <p className="text-sm text-[var(--text-muted)]">{memberSince ? `${t('profile.member_since')} ${memberSince}` : ''}</p>
            </div>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:border-[var(--color-brand)] transition-colors"
              >
                <Edit2 size={14} />
                {t('profile.edit')}
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                <Zap size={18} className="text-[var(--color-green)]" />
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">{t('profile.xp')}</p>
                <p className="text-xl font-bold text-[var(--text-primary)]">{profile?.xp ?? 0}</p>
              </div>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
                <Flame size={18} className="text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)]">{t('profile.streak')}</p>
                <p className="text-xl font-bold text-[var(--text-primary)]">{profile?.streak_days ?? 0}</p>
              </div>
            </div>
          </div>

          {/* Info / Edit form */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 space-y-4">
            {editing ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{t('auth.full_name')}</label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{t('profile.goal_label')}</label>
                  <textarea
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder={t('profile.goal_placeholder') as string}
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] transition placeholder-[var(--text-muted)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">{t('profile.skill_label')}</label>
                  <div className="flex gap-2">
                    {SKILL_LEVELS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSkillLevel(s)}
                        className={cn(
                          'flex-1 py-2 rounded-xl text-xs font-medium border transition-all',
                          skillLevel === s
                            ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]'
                            : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--color-brand)]'
                        )}
                      >
                        {t(`common.${s}`)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">{t('profile.language_label')}</label>
                  <div className="flex gap-2">
                    {LANGUAGES.map((l) => (
                      <button
                        key={l.value}
                        type="button"
                        onClick={() => setPrefLang(l.value)}
                        className={cn(
                          'flex-1 py-2 rounded-xl text-xs font-medium border transition-all',
                          prefLang === l.value
                            ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]'
                            : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--color-brand)]'
                        )}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={saveProfile}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[var(--color-brand)] text-white text-sm font-semibold hover:bg-[var(--color-brand-hover)] transition-colors disabled:opacity-60"
                  >
                    <Check size={14} />
                    {saving ? t('common.loading') : t('profile.save')}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:border-[var(--color-brand)] transition-colors"
                  >
                    <X size={14} />
                    {t('profile.cancel')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-xs text-[var(--text-muted)] mb-0.5">{t('profile.goal_label')}</p>
                  <p className="text-sm text-[var(--text-primary)]">
                    {profile?.goal || <span className="text-[var(--text-muted)] italic">{t('profile.no_goal')}</span>}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-[var(--text-muted)] mb-0.5">{t('profile.skill_label')}</p>
                    <p className="text-sm text-[var(--text-primary)] capitalize">{profile?.skill_level ? t(`common.${profile.skill_level}`) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-muted)] mb-0.5">{t('profile.language_label')}</p>
                    <p className="text-sm text-[var(--text-primary)]">{LANGUAGES.find((l) => l.value === profile?.preferred_language)?.label ?? '—'}</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Saved opportunities */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                <Bookmark size={15} className="text-[var(--color-brand)]" />
                {t('profile.saved_title')}
              </h2>
              {savedEvents.length > 0 && (
                <Link href="/opportunities" className="text-xs font-medium text-[var(--color-brand)] hover:underline">
                  {t('profile.saved_browse')}
                </Link>
              )}
            </div>

            {savedEvents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border-strong)] px-4 py-8 text-center">
                <p className="text-sm text-[var(--text-muted)] mb-3">{t('profile.saved_empty')}</p>
                <Link href="/opportunities" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-brand)] hover:underline">
                  {t('profile.saved_browse')} →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {savedEvents.map((ev) => {
                  const d = ev.deadline ? Math.ceil((new Date(ev.deadline).getTime() - Date.now()) / 86400000) : null;
                  return (
                    <div key={ev.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3">
                      <Link href={`/opportunities/${ev.id}`} className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)] truncate hover:text-[var(--color-brand)] transition-colors">{ev.title}</p>
                        <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-2 mt-0.5">
                          <span className="capitalize">{ev.event_type}</span>
                          {d !== null && d >= 0 && (
                            <span className="flex items-center gap-1"><Calendar size={10} />{d} {t('opportunities.days_left')}</span>
                          )}
                        </p>
                      </Link>
                      {ev.link && (
                        <a
                          href={ev.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-[var(--text-muted)] hover:text-[var(--color-brand)] transition-colors"
                          title={t('opportunities.apply') as string}
                        >
                          <ExternalLink size={15} />
                        </a>
                      )}
                      <button
                        onClick={() => handleRemoveSaved(ev.id)}
                        className="shrink-0 text-[var(--text-muted)] hover:text-red-500 transition-colors"
                        title={t('common.cancel') as string}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sign out */}
          <div className="mt-6 pt-4 border-t border-[var(--border)]">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800 text-red-500 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? 'am', ['common'])),
  },
});
