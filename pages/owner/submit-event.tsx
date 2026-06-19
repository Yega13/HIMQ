import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ChevronLeft, Send, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import Layout from '@/components/Layout';
import { useUser } from '@/lib/useUser';
import { getBrowserClient } from '@/lib/supabase';

const EVENT_TYPES = ['scholarship', 'competition', 'internship', 'grant', 'other'] as const;
type EventType = typeof EVENT_TYPES[number];

interface FormState {
  title: string;
  type: EventType;
  organizer: string;
  deadline: string;
  description: string;
  link: string;
}

const INITIAL: FormState = {
  title: '',
  type: 'scholarship',
  organizer: '',
  deadline: '',
  description: '',
  link: '',
};

export default function SubmitEventPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const [form, setForm]       = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!userLoading && !user) router.replace('/auth?next=/owner/submit-event');
  }, [user, userLoading, router]);

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [k]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.title.trim() || !form.organizer.trim() || !form.description.trim()) {
      setError('Title, organizer, and description are required.');
      return;
    }

    setSubmitting(true);
    setError('');

    const supabase = getBrowserClient();
    const { error: dbErr } = await supabase.from('events').insert({
      title: form.title.trim(),
      type: form.type,
      organizer: form.organizer.trim(),
      deadline: form.deadline || null,
      description: form.description.trim(),
      link: form.link.trim() || null,
      is_approved: false,
    });

    if (dbErr) {
      setError('Failed to submit. Please try again.');
    } else {
      setDone(true);
    }
    setSubmitting(false);
  };

  if (done) {
    return (
      <Layout>
        <Head><title>Event Submitted — Himq</title></Head>
        <div className="max-w-lg mx-auto px-4 py-24 text-center">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <div className="w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={30} className="text-[var(--color-green)]" />
            </div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">Event submitted!</h1>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              Our team will review your submission and publish it within 24–48 hours.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => { setForm(INITIAL); setDone(false); }}
                className="px-5 py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:border-[var(--color-brand)] transition-colors"
              >
                Submit another
              </button>
              <Link
                href="/opportunities"
                className="px-5 py-2.5 rounded-xl bg-[var(--color-brand)] text-white text-sm font-semibold"
              >
                View opportunities
              </Link>
            </div>
          </motion.div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Head><title>Submit an Event — Himq</title></Head>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href="/opportunities"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--color-brand)] transition-colors mb-6"
        >
          <ChevronLeft size={14} />
          Back to Opportunities
        </Link>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">Submit an Event</h1>
          <p className="text-sm text-[var(--text-secondary)] mb-8">
            Submit a scholarship, competition, internship, or grant for Armenian students. Our team reviews all submissions within 48 hours.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Event title <span className="text-red-500">*</span>
              </label>
              <input
                value={form.title}
                onChange={set('title')}
                required
                placeholder="e.g. UGRAD Scholarship Program 2026"
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] transition placeholder-[var(--text-muted)]"
              />
            </div>

            {/* Type + Organizer in 2 columns */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.type}
                  onChange={set('type')}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] transition"
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                  Organizer <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.organizer}
                  onChange={set('organizer')}
                  required
                  placeholder="e.g. U.S. Embassy Yerevan"
                  className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] transition placeholder-[var(--text-muted)]"
                />
              </div>
            </div>

            {/* Deadline */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Deadline
              </label>
              <input
                type="date"
                value={form.deadline}
                onChange={set('deadline')}
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] transition"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.description}
                onChange={set('description')}
                required
                rows={4}
                placeholder="Describe the opportunity, eligibility criteria, benefits, and how to apply..."
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] transition placeholder-[var(--text-muted)]"
              />
            </div>

            {/* Link */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                Official link
              </label>
              <input
                type="url"
                value={form.link}
                onChange={set('link')}
                placeholder="https://example.com/apply"
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] transition placeholder-[var(--text-muted)]"
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-[var(--color-brand)] text-white font-semibold text-sm hover:bg-[var(--color-brand-hover)] transition-colors disabled:opacity-60"
            >
              <Send size={15} />
              {submitting ? 'Submitting…' : 'Submit for Review'}
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
