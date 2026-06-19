import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { useState, useCallback } from 'react';
import { CheckCircle, XCircle, Trash2, RefreshCw, Calendar, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Event {
  id: string;
  title: string;
  type: string;
  organizer: string | null;
  deadline: string | null;
  description: string | null;
  link: string | null;
  created_at: string;
}

export default function Admin() {
  const [authed, setAuthed]   = useState(false);
  const [pass, setPass]       = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [err, setErr]         = useState('');
  const [events, setEvents]   = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast]     = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const fetchEvents = useCallback(async (pw: string) => {
    setLoading(true);
    const res = await fetch('/api/admin-events', {
      headers: { 'x-admin-password': pw },
    });
    if (res.ok) {
      const data = await res.json();
      setEvents(data.events ?? []);
    }
    setLoading(false);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pass }),
    });
    if (res.ok) {
      setAdminPass(pass);
      localStorage.setItem('adminPass', pass);
      setAuthed(true);
      fetchEvents(pass);
    } else {
      setErr('Wrong password');
    }
  };

  const handleDecision = async (id: string, approve: boolean) => {
    await fetch('/api/admin-events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPass },
      body: JSON.stringify({ id, approve }),
    });
    setEvents((prev) => prev.filter((e) => e.id !== id));
    showToast(approve ? 'Event approved and published!' : 'Event rejected.');
  };

  const handleDelete = async (id: string) => {
    await fetch('/api/admin-events', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPass },
      body: JSON.stringify({ id }),
    });
    setEvents((prev) => prev.filter((e) => e.id !== id));
    showToast('Event deleted.');
  };

  if (!authed) {
    return (
      <Layout>
        <Head><title>Admin — Himq</title></Head>
        <div className="max-w-sm mx-auto px-4 py-20">
          <h1 className="text-xl font-bold text-[var(--text-primary)] mb-6">Admin Login</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="Admin password"
              className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
            />
            {err && <p className="text-red-500 text-sm">{err}</p>}
            <button type="submit" className="w-full py-3 rounded-xl bg-[var(--color-brand)] text-white font-semibold text-sm">
              Enter
            </button>
          </form>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Head><title>Admin Panel — Himq</title></Head>

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
            onClick={() => fetchEvents(adminPass)}
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
                          {event.type}
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
