import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
import Layout from '@/components/Layout';
import { useUser } from '@/lib/useUser';
import { getBrowserClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
type SkillLevel = typeof SKILL_LEVELS[number];

export default function ChatIndex() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { user, loading } = useUser();

  const [goal, setGoal] = useState('');
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('beginner');
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/auth');
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim() || !user) return;
    setBuilding(true);
    setError('');

    try {
      const supabase = getBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch('/api/create-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ goal: goal.trim(), skillLevel }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to create chat');
      }

      const { chatId } = await res.json();
      await router.push(`/chat/${chatId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBuilding(false);
    }
  };

  if (loading) {
    return (
      <Layout hideFooter>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="w-6 h-6 border-2 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout hideFooter>
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-lg"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/30 mb-4">
              <Sparkles size={28} className="text-[var(--color-brand)]" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
              {t('chat.goal_label')}
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Our AI will build a 5-lesson plan and start teaching you right away.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder={t('chat.goal_placeholder') as string}
                required
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] transition placeholder-[var(--text-muted)]"
              />
            </div>

            <div>
              <p className="text-sm font-medium text-[var(--text-secondary)] mb-2">
                {t('chat.skill_label')}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {SKILL_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setSkillLevel(level)}
                    className={cn(
                      'py-2.5 rounded-xl text-sm font-medium border transition-all',
                      skillLevel === level
                        ? 'bg-[var(--color-brand)] text-white border-[var(--color-brand)]'
                        : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--color-brand)]'
                    )}
                  >
                    {t(`chat.skill_${level}`)}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={building || !goal.trim()}
              className="w-full py-3.5 rounded-xl bg-[var(--color-brand)] text-white font-semibold text-sm hover:bg-[var(--color-brand-hover)] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {building ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t('chat.building_plan')}
                </>
              ) : (
                <>
                  {t('chat.build_plan')}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
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
