import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { User as UserIcon, LogOut } from 'lucide-react';
import { getBrowserClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';

// Desktop account button that morphs from a small avatar into an account menu
// (shared layoutId does the box + avatar morph; content blurs in). Wired to the
// real Supabase user — no external branding.
const SPRING = { type: 'spring' as const, bounce: 0.18, duration: 0.35 };
const blurIn = (delay: number) => ({
  initial: { opacity: 0, filter: 'blur(6px)' },
  animate: { opacity: 1, filter: 'blur(0px)', transition: { delay } },
});

// Module-level (stable identity) so the shared layoutId morphs the avatar
// between the closed button and the open menu header instead of remounting it.
function Avatar({ large, initial }: { large?: boolean; initial: string }) {
  return (
    <motion.div
      layoutId="profile-avatar"
      transition={SPRING}
      className={cn(
        'flex items-center justify-center rounded-full bg-[var(--color-brand)] text-white font-semibold select-none',
        large ? 'w-10 h-10 text-base' : 'w-8 h-8 text-sm',
      )}
    >
      {initial}
    </motion.div>
  );
}

export default function ProfileMenu() {
  const router = useRouter();
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getBrowserClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setName((user.user_metadata?.full_name as string) ?? '');
      setEmail(user.email ?? '');
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const signOut = async () => {
    setOpen(false);
    await getBrowserClient().auth.signOut();
    router.push('/');
  };

  const initial = (name || email || '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <div ref={rootRef} className="relative w-8 h-8">
      <AnimatePresence>
        {!open ? (
          <motion.button
            key="closed"
            layoutId="profile-menu"
            onClick={() => setOpen(true)}
            aria-label="Open account menu"
            style={{ borderRadius: 999 }}
            transition={SPRING}
            className="absolute top-0 right-0 z-30 flex items-center justify-center w-8 h-8 overflow-hidden"
          >
            <Avatar initial={initial} />
          </motion.button>
        ) : (
          <motion.div
            key="open"
            layoutId="profile-menu"
            style={{ borderRadius: 16 }}
            transition={SPRING}
            className="absolute top-0 right-0 z-30 w-60 overflow-hidden bg-[var(--bg-card)] border border-[var(--border)] shadow-[var(--shadow-lg)]"
          >
            <div className="flex items-center gap-3 p-3.5">
              <Avatar large initial={initial} />
              <motion.div {...blurIn(0.12)} className="min-w-0">
                {name && <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{name}</p>}
                <p className="text-xs text-[var(--text-muted)] truncate">{email}</p>
              </motion.div>
            </div>
            <div className="h-px bg-[var(--border)]" />
            <motion.div {...blurIn(0.15)} className="p-1.5">
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
              >
                <UserIcon size={16} className="text-[var(--text-muted)]" />
                {t('nav.profile')}
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
              >
                <LogOut size={16} className="text-[var(--text-muted)]" />
                {t('profile.sign_out')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
