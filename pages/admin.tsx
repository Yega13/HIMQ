import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { useState, useCallback, useEffect } from 'react';
import { CheckCircle, XCircle, Trash2, RefreshCw, Calendar, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getBrowserClient } from '@/lib/supabase';

interface Event {
  id: string;
  title: string;
  event_type: string;
  organizer: string | null;
  deadline: string | null;
  description: string | null;
  link: string | null;
  created_at: string;
}

// 'checking' = verifying session, 'anon' = not logged in, 'forbidden' = logged
// in but not an admin, 'error' = request failed, 'ok' = admin.
type Access = 'checking' | 'anon' | 'forbidden' | 'error' | 'ok';

export default function Admin() {
  const [access, setAccess]   = useState<Access>('checking');
  const [token, setToken]     = useState('');
  const [events, setEvents]   = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast]     = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const fetchEvents = useCallback(async (accessToken: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin-events', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events ?? []);
        setAccess('ok');
      } else if (res.status === 403) {
        setAccess('forbidden');
      } else {
        setAccess('error');
      }
    } catch {
      setAccess('error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Authorize via the logged-in Supabase session + server-side is_admin check.
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await getBrowserClient().auth.getSession();
        if (!session) { setAccess('anon'); return; }
        setToken(session.access_token);
        await fetchEvents(session.access_token);
      } catch {
        setAccess('error');
      }
    })();
  }, [fetchEvents]);

  const handleDecision = async (id: string, approve: boolean) => {
    await fetch('/api/admin-events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, approve }),
    });
    setEvents((prev) => prev.filter((e) => e.id !== id));
    showToast(approve ? 'Event approved and published!' : 'Event rejected.');
  };

  const handleDelete = async (id: string) => {
    await fetch('/api/admin-events', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
    setEvents((prev) => prev.filter((e) => e.id !== id));
    showToast('Event deleted.');
  };

  if (access !== 'ok') {
    return (
      <Layout>
        <Head><title>Admin — HIMQ</title></Head>
        <div className="max-w-sm mx-auto px-4 py-20 text-center">
          {access === 'checking' && (
            <div className="w-6 h-6 border-2 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin mx-auto" />
          )}
          {access === 'anon' && (
            <>
              <h1 className="text-xl font-bold text-[var(--text-primary)] mb-3">Admin</h1>
              <p className="text-sm text-[var(--text-secondary)] mb-6">Sign in with an admin account to continue.</p>
              <Link href="/auth?next=/admin" className="inline-block px-5 py-3 rounded-xl bg-[var(--color-brand)] text-white font-semibold text-sm">
                Sign in
              </Link>
            </>
          )}
          {access === 'forbidden' && (
            <>
              <h1 className="text-xl font-bold text-[var(--text-primary)] mb-3">Not authorized</h1>
              <p className="text-sm text-[var(--text-secondary)]">Your account doesn&apos;t have admin access.</p>
            </>
          )}
          {access === 'error' && (
            <>
              <h1 className="text-xl font-bold text-[var(--text-primary)] mb-3">Couldn&apos;t load</h1>
              <p className="text-sm text-[var(--text-secondary)] mb-6">Something went wrong. Please try again.</p>
              <button
                onClick={() => window.location.reload()}
                className="inline-block px-5 py-3 rounded-xl bg-[var(--color-brand)] text-white font-semibold text-sm"
              >
                Retry
              </button>
            </>
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Head><title>Admin Panel — HIMQ</title></Head>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 z-50 bg-[var(--text-primary)] text-[var(--bg-primary)] px-4 py-3 rounded-xl text-sm font-medium shadow-lg"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Admin Panel</h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              {events.length} event{events.length !== 1 ? 's' : ''} pending review
            </p>
          </div>
          <button
            onClick={() => fetchEvents(token)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:border-[var(--color-brand)] transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {loading && events.length === 0 ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-[var(--border)] animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-20">
            <CheckCircle size={40} className="text-[var(--color-green)] mx-auto mb-3" />
            <p className="font-semibold text-[var(--text-primary)]">All caught up!</p>
            <p className="text-sm text-[var(--text-muted)] mt-1">No pending events to review.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {events.map((event) => (
                <motion.div
                  key={event.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium capitalize">
                          {event.event_type}
                        </span>
                        {event.deadline && (
                          <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                            <Calendar size={11} />
                            {new Date(event.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                        <span className="text-xs text-[var(--text-muted)]">
                          by {event.organizer ?? 'Unknown'}
                        </span>
                      </div>

                      <h3 className="font-semibold text-[var(--text-primary)] text-base leading-snug">
                        {event.title}
                      </h3>

                      {event.description && (
                        <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2 leading-relaxed">
                          {event.description}
                        </p>
                      )}

                      {event.link && (
                        <a
                          href={event.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-[var(--color-brand)] hover:underline mt-1"
                        >
                          <ExternalLink size={11} />
                          {event.link.length > 50 ? event.link.slice(0, 50) + '…' : event.link}
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => handleDecision(event.id, true)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-green)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                      <CheckCircle size={14} />
                      Approve
                    </button>
                    <button
                      onClick={() => handleDecision(event.id, false)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                      <XCircle size={14} />
                      Reject
                    </button>
                    <button
                      onClick={() => handleDelete(event.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 dark:border-red-900 text-red-500 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ml-auto"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? 'am', ['common'])),
  },
});
