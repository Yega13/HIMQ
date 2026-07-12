import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useEffect, useState, useMemo, useRef, type Ref } from 'react';
import Head from 'next/head';
import { Zap, Flame, Trophy, Crown, Medal, BookOpenCheck, Search, ArrowUp, ArrowDown, Minus, ChevronDown, Gem, Shield, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'next-i18next';
import Layout from '@/components/Layout';
import { supabase, getBrowserClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface Entry {
  id: string;
  full_name: string | null;
  xp: number;
  streak_days: number;
  lessons_completed: number;
  weekly_xp: number | null;
  monthly_xp: number | null;
  previous_rank: number | null;
}

interface Ranked {
  entry: Entry;
  rank: number;
  movement: number | null;
  value: number;
}

type Period = 'all' | 'week' | 'month';

// XP thresholds tuned for an early-stage app so learners actually progress
// through tiers: Bronze 0 → Silver 150 → Gold 400 → Platinum 800 → Diamond 1500.
const TIERS = [
  { id: 'diamond', min: 1500, icon: Gem, avatar: 'bg-sky-500', badge: 'bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-300' },
  { id: 'platinum', min: 800, icon: Shield, avatar: 'bg-cyan-500', badge: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-300' },
  { id: 'gold', min: 400, icon: Trophy, avatar: 'bg-yellow-500', badge: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300' },
  { id: 'silver', min: 150, icon: Medal, avatar: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  { id: 'bronze', min: 0, icon: Award, avatar: 'bg-amber-600', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300' },
];
function tierFor(xp: number) {
  return TIERS.find((t) => xp >= t.min) ?? TIERS[TIERS.length - 1];
}

const PERIODS: { id: Period; key: string }[] = [
  { id: 'all', key: 'leaderboard.period_all' },
  { id: 'week', key: 'leaderboard.period_week' },
  { id: 'month', key: 'leaderboard.period_month' },
];

const INITIAL_COUNT = 10;

function initial(name: string | null) {
  return (name ?? 'A').trim().charAt(0).toUpperCase() || 'A';
}

export default function Leaderboard({ profiles, totalLearners }: { profiles: Entry[]; totalLearners: number }) {
  const { t } = useTranslation('common');
  const [currentUserId, setCurrentUserId] = useState<string | null | undefined>(undefined);
  const [period, setPeriod] = useState<Period>('all');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [meVisible, setMeVisible] = useState(false);
  const meRowRef = useRef<HTMLLIElement>(null);
  const mePodiumRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getBrowserClient().auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id ?? null));
  }, []);

  const ranked: Ranked[] = useMemo(() => {
    const m = (e: Entry) => (period === 'week' ? e.weekly_xp ?? 0 : period === 'month' ? e.monthly_xp ?? 0 : e.xp ?? 0);
    return [...profiles]
      .sort((a, b) => m(b) - m(a))
      .map((e, i) => ({
        entry: e,
        rank: i + 1,
        value: m(e),
        movement: period === 'all' && typeof e.previous_rank === 'number' ? e.previous_rank - (i + 1) : null,
      }));
  }, [profiles, period]);

  const meRow = currentUserId ? ranked.find((r) => r.entry.id === currentUserId) ?? null : null;
  const searching = query.trim().length > 0;
  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () => ranked.filter((r) => (r.entry.full_name ?? (t('leaderboard.anonymous') as string)).toLowerCase().includes(q)),
    [ranked, q, t]
  );

  const podium = ranked.slice(0, 3);
  const listShown = expanded ? ranked : ranked.slice(0, INITIAL_COUNT);

  const myXpTotal = meRow?.entry.xp ?? 0;
  const myTier = tierFor(myXpTotal);
  const tierIdx = TIERS.findIndex((tt) => tt.id === myTier.id);
  const nextTier = tierIdx > 0 ? TIERS[tierIdx - 1] : null;
  const toNext = nextTier ? Math.max(0, nextTier.min - myXpTotal) : 0;
  const tierPct = nextTier ? Math.min(100, Math.round(((myXpTotal - myTier.min) / (nextTier.min - myTier.min)) * 100)) : 100;

  // Hide the sticky "your rank" helper while the user is already visible on
  // screen — either via their list row OR their podium card (top 3).
  useEffect(() => {
    const els = [meRowRef.current, mePodiumRef.current].filter(Boolean) as Element[];
    if (els.length === 0 || typeof IntersectionObserver === 'undefined') {
      setMeVisible(false);
      return;
    }
    const state = new Map<Element, boolean>();
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => state.set(e.target, e.isIntersecting));
        setMeVisible(Array.from(state.values()).some(Boolean));
      },
      { threshold: 0.5 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [currentUserId, expanded, searching, q, period, ranked]);

  return (
    <Layout>
      <Head><title>Leaderboard — HIMQ</title></Head>
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1.5">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-yellow-50 dark:bg-yellow-900/20">
            <Trophy size={22} className="text-yellow-500" />
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">{t('leaderboard.title')}</h1>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-2">{t('leaderboard.subtitle')}</p>
        <p className="text-xs text-[var(--color-brand)] font-medium mb-6 flex items-center gap-1.5">
          <Zap size={13} />
          {t('leaderboard.reward_hint')}
        </p>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label={t('leaderboard.learners')} value={totalLearners} />
          <StatCard label={t('leaderboard.your_rank')} value={meRow ? `#${meRow.rank}` : '—'} />
          <StatCard label={t('leaderboard.your_xp')} value={meRow ? meRow.value : '—'} gold />
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-sm)]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">{t('leaderboard.league')}</p>
            <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold', myTier.badge)}>
              <myTier.icon size={13} />
              {t(`leaderboard.tier_${myTier.id}`)}
            </span>
            {nextTier ? (
              <div className="mt-2.5">
                <div className="h-1.5 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                  <div className="h-full rounded-full bg-[var(--color-brand)]" style={{ width: `${tierPct}%` }} />
                </div>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                  {t('leaderboard.to_next_tier', { xp: toNext, tier: t(`leaderboard.tier_${nextTier.id}`) })}
                </p>
              </div>
            ) : (
              <p className="text-[10px] text-[var(--text-muted)] mt-2">{t('leaderboard.top_tier')}</p>
            )}
          </div>
        </div>

        {/* Controls: period + search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-1 shrink-0">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => { setPeriod(p.id); setExpanded(false); }}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                  period === p.id ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                )}
              >
                {t(p.key)}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('leaderboard.search_placeholder') as string}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] transition placeholder-[var(--text-muted)]"
            />
          </div>
        </div>

        {profiles.length === 0 ? (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl px-5 py-12 text-center">
            <Trophy size={32} className="text-[var(--text-muted)] mx-auto mb-3" />
            <p className="text-sm text-[var(--text-muted)]">{t('leaderboard.empty')}</p>
          </div>
        ) : searching ? (
          /* Flat search results */
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
            {matches.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[var(--text-muted)]">{t('leaderboard.empty')}</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {matches.map((r) => <RankRow key={r.entry.id} r={r} me={r.entry.id === currentUserId} period={period} t={t} innerRef={r.entry.id === currentUserId ? meRowRef : undefined} />)}
              </ul>
            )}
          </div>
        ) : (
          <>
            {/* Podium */}
            {podium.length >= 1 && (
              <div className="flex items-end justify-center gap-3 mb-6 pt-6">
                {podium[1] && <PodiumCard r={podium[1]} place={2} t={t} innerRef={podium[1].entry.id === currentUserId ? mePodiumRef : undefined} />}
                <PodiumCard r={podium[0]} place={1} t={t} innerRef={podium[0].entry.id === currentUserId ? mePodiumRef : undefined} />
                {podium[2] && <PodiumCard r={podium[2]} place={3} t={t} innerRef={podium[2].entry.id === currentUserId ? mePodiumRef : undefined} />}
              </div>
            )}

            {/* Full ranking list */}
            {ranked.length > 0 && (
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
                <ul className="divide-y divide-[var(--border)]">
                  {listShown.map((r) => <RankRow key={r.entry.id} r={r} me={r.entry.id === currentUserId} period={period} t={t} innerRef={r.entry.id === currentUserId ? meRowRef : undefined} />)}
                </ul>
                {ranked.length > INITIAL_COUNT && (
                  <button
                    onClick={() => setExpanded((v) => !v)}
                    className="w-full flex items-center justify-center gap-1.5 py-3 text-xs font-semibold text-[var(--color-brand)] border-t border-[var(--border)] hover:bg-[var(--bg-subtle)] transition-colors"
                  >
                    {expanded ? t('leaderboard.show_less') : t('leaderboard.show_more')}
                    <ChevronDown size={14} className={cn('transition-transform', expanded && 'rotate-180')} />
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* Sticky "your rank" bar — only while your row is off-screen */}
        <AnimatePresence>
        {meRow && !meVisible && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="sticky bottom-20 md:bottom-6 mt-4 z-30"
          >
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-brand)] bg-[var(--bg-card)] px-4 py-3 shadow-[var(--shadow-lg)]">
              <span className="text-sm font-bold w-7 text-center text-[var(--color-brand)] shrink-0">#{meRow.rank}</span>
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0', tierFor(meRow.entry.xp).avatar)}>
                {initial(meRow.entry.full_name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[var(--text-primary)] truncate">
                  {meRow.entry.full_name ?? t('leaderboard.anonymous')}
                  <span className="ml-2 text-[10px] bg-[var(--color-brand-soft)] text-[var(--color-brand)] font-bold px-1.5 py-0.5 rounded-full">{t('leaderboard.you')}</span>
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">{t(`leaderboard.tier_${tierFor(meRow.entry.xp).id}`)}</p>
              </div>
              <span className="flex items-center gap-1 font-extrabold text-sm text-[var(--color-gold)] shrink-0">
                <Zap size={14} />{meRow.value}
              </span>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}

function StatCard({ label, value, gold }: { label: string; value: string | number; gold?: boolean }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-sm)]">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">{label}</p>
      <p className={cn('text-2xl font-bold tabular-nums', gold ? 'text-[var(--color-gold)]' : 'text-[var(--text-primary)]')}>{value}</p>
    </div>
  );
}

function Movement({ m }: { m: number | null }) {
  if (m === null) return null;
  if (m > 0) return <span className="inline-flex items-center text-[10px] font-bold text-[var(--color-green)]"><ArrowUp size={11} />{m}</span>;
  if (m < 0) return <span className="inline-flex items-center text-[10px] font-bold text-red-500"><ArrowDown size={11} />{Math.abs(m)}</span>;
  return <Minus size={11} className="text-[var(--text-muted)]" />;
}

function PodiumCard({ r, place, t, innerRef }: { r: Ranked; place: number; t: (k: string) => string; innerRef?: Ref<HTMLDivElement> }) {
  const first = place === 1;
  const accent =
    place === 1 ? { ring: 'border-yellow-300 dark:border-yellow-700', bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600', medal: 'bg-yellow-400 text-yellow-900' }
    : place === 2 ? { ring: 'border-slate-300 dark:border-slate-600', bg: 'bg-slate-50 dark:bg-slate-800/40', text: 'text-slate-500', medal: 'bg-slate-300 text-slate-700' }
    : { ring: 'border-amber-300 dark:border-amber-800', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600', medal: 'bg-amber-500 text-amber-950' };

  return (
    <motion.div
      ref={innerRef}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: place === 1 ? 0 : place === 2 ? 0.1 : 0.2, type: 'spring', stiffness: 120 }}
      className={cn(
        'relative flex-1 rounded-2xl border text-center',
        accent.bg, accent.ring,
        first ? 'border-2 px-5 py-6 -translate-y-6 z-10 shadow-[var(--shadow-lg)]' : 'border p-4'
      )}
    >
      {first && (
        <div className="absolute -inset-1 -z-10 rounded-2xl bg-yellow-300/30 blur-xl" />
      )}
      <div className={cn('mx-auto mb-2 flex items-center justify-center rounded-full', accent.medal, first ? 'w-11 h-11' : 'w-9 h-9')}>
        {first ? <Crown size={20} /> : <Medal size={16} />}
      </div>
      <p className="text-xs font-bold text-[var(--text-primary)] truncate px-1">{r.entry.full_name ?? t('leaderboard.anonymous')}</p>
      <p className={cn('font-extrabold flex items-center justify-center gap-0.5', accent.text, first ? 'text-xl' : 'text-lg')}>
        <Zap size={first ? 16 : 14} />{r.value}
      </p>
      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">#{r.rank}</p>
    </motion.div>
  );
}

function RankRow({ r, me, period, t, innerRef }: { r: Ranked; me: boolean; period: Period; t: (k: string) => string; innerRef?: Ref<HTMLLIElement> }) {
  const tier = tierFor(r.entry.xp);
  return (
    <motion.li
      ref={innerRef}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className={cn('flex items-center gap-3 px-4 sm:px-5 py-3', me && 'bg-[var(--color-brand-soft)]')}
    >
      <div className="flex items-center gap-1 w-10 shrink-0">
        <span className="text-sm font-bold text-[var(--text-muted)] w-5 text-right">{r.rank}</span>
        <Movement m={r.movement} />
      </div>

      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0', tier.avatar)}>
        {initial(r.entry.full_name)}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
          {r.entry.full_name ?? t('leaderboard.anonymous')}
          {me && <span className="ml-2 text-[10px] bg-[var(--color-brand)] text-white font-bold px-1.5 py-0.5 rounded-full">{t('leaderboard.you')}</span>}
        </p>
        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-[var(--text-muted)]">
          {r.entry.streak_days > 0 && (
            <span className="flex items-center gap-0.5 text-orange-500"><Flame size={10} />{r.entry.streak_days}</span>
          )}
          <span className="flex items-center gap-0.5"><BookOpenCheck size={10} />{r.entry.lessons_completed} {t('leaderboard.lessons')}</span>
        </div>
      </div>

      <span className="flex items-center gap-1 font-bold text-sm text-[var(--color-gold)] shrink-0">
        <Zap size={14} />{period === 'all' ? r.entry.xp : r.value}
      </span>
    </motion.li>
  );
}

// Row shape from the leaderboard_period RPC (and the profiles select).
interface PeriodRow {
  id: string;
  full_name: string | null;
  xp: number | null;
  streak_days: number | null;
  lessons_completed: number | null;
  period_xp?: number | null;
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => {
  const now = Date.now();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

  // All-time top 50, real weekly/monthly top 50 (by lessons completed in the
  // window), and the true total learner count — in parallel.
  const [allRes, weekRes, monthRes, countRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, xp, streak_days, lessons_completed')
      .order('xp', { ascending: false }).limit(50),
    supabase.rpc('leaderboard_period', { p_since: weekAgo }),
    supabase.rpc('leaderboard_period', { p_since: monthAgo }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
  ]);

  // Union all three boards so a weekly/monthly leader outside the all-time top
  // 50 still shows up with the correct period XP.
  const map = new Map<string, Entry>();
  const ensure = (r: PeriodRow): Entry => {
    let e = map.get(r.id);
    if (!e) {
      e = {
        id: r.id,
        full_name: r.full_name ?? null,
        xp: r.xp ?? 0,
        streak_days: r.streak_days ?? 0,
        lessons_completed: r.lessons_completed ?? 0,
        weekly_xp: 0,
        monthly_xp: 0,
        previous_rank: null,
      };
      map.set(r.id, e);
    }
    return e;
  };
  (allRes.data as PeriodRow[] | null ?? []).forEach(ensure);
  (weekRes.data as PeriodRow[] | null ?? []).forEach((r) => { ensure(r).weekly_xp = Number(r.period_xp) || 0; });
  (monthRes.data as PeriodRow[] | null ?? []).forEach((r) => { ensure(r).monthly_xp = Number(r.period_xp) || 0; });

  const profiles = Array.from(map.values());

  return {
    props: {
      profiles,
      totalLearners: countRes.count ?? profiles.length,
      ...(await serverSideTranslations(locale ?? 'am', ['common'])),
    },
  };
};
