import { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

// Full-screen "building your plan" state with rotating fun facts + reassurances,
// so the ~30-50s plan generation doesn't feel like a dead spinner. `titleKey`
// lets both the exam flow and the discovery flow reuse the same rotating screen
// with their own heading (the fun facts are generic and shared).
export function PlanBuildingScreen({ titleKey = 'exams.building_title' }: { titleKey?: string }) {
  const { t } = useTranslation('common');
  const facts = (t('exams.facts', { returnObjects: true }) as string[]) ?? [];
  const [i, setI] = useState(0);

  useEffect(() => {
    if (facts.length < 2) return;
    const id = setInterval(() => setI((x) => (x + 1) % facts.length), 3800);
    return () => clearInterval(id);
  }, [facts.length]);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center px-6 bg-[var(--bg-primary)]">
      <motion.div
        animate={{ scale: [1, 1.12, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="w-16 h-16 rounded-2xl bg-[var(--color-brand-soft)] text-[var(--color-brand)] flex items-center justify-center mb-6"
      >
        <Sparkles size={30} />
      </motion.div>

      <p className="text-lg font-bold text-[var(--text-primary)] mb-3">{t(titleKey)}</p>

      <div className="h-14 max-w-md flex items-start justify-center text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
            className="text-sm text-[var(--text-secondary)] leading-relaxed"
          >
            {facts[i]}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="mt-2 w-48 h-1 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
        <motion.div
          className="h-full w-1/3 rounded-full bg-[var(--color-brand)]"
          animate={{ x: ['-120%', '360%'] }}
          transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
    </div>
  );
}
