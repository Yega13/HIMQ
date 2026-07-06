import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import Logo from './Logo';

// Full-screen blocking page with NO navbar / footer — for unauthorized /
// not-signed-in states so the app chrome isn't shown to people who can't use it.
export default function Blocked({
  title,
  message,
  action,
  icon,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center px-4 text-center overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="flex flex-col items-center"
      >
        <div className="mb-6 opacity-90">
          <Logo height={34} />
        </div>

        {icon && (
          <motion.div
            initial={{ scale: 0.7, opacity: 0, rotate: -6 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ delay: 0.12, type: 'spring', stiffness: 220, damping: 16 }}
            className="w-16 h-16 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center mb-5 text-[var(--text-muted)] shadow-[var(--shadow-sm)]"
          >
            {icon}
          </motion.div>
        )}

        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.18 }}
          className="text-2xl font-bold text-[var(--text-primary)] mb-2"
        >
          {title}
        </motion.h1>
        {message && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.24 }}
            className="text-sm text-[var(--text-secondary)] max-w-sm mb-6 leading-relaxed"
          >
            {message}
          </motion.p>
        )}
        {action && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            {action}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
