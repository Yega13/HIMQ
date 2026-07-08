import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import Layout from '@/components/Layout';

const UPDATED = 'July 8, 2026';

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2.5">{n}. {title}</h2>
      <div className="space-y-3 text-[14.5px] text-[var(--text-secondary)] leading-relaxed">{children}</div>
    </section>
  );
}

export default function Terms() {
  return (
    <Layout>
      <Head><title>Terms of Service · HIMQ</title></Head>
      <div className="max-w-3xl mx-auto px-4 pt-6 md:pt-10 pb-20">
        <div className="inline-flex items-center gap-2 text-[var(--color-brand)] mb-3">
          <FileText size={16} />
          <span className="text-xs font-bold uppercase tracking-[0.14em]">Terms of Service</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--text-primary)]">Terms of Service</h1>
        <p className="text-sm text-[var(--text-muted)] mt-2">Last updated {UPDATED}</p>

        <p className="mt-6 text-[14.5px] text-[var(--text-secondary)] leading-relaxed">
          Welcome to HIMQ. By creating an account or using the service, you agree to these terms. Please read them.
        </p>

        <Section n={1} title="The service">
          <p>HIMQ is an AI-powered learning platform that builds personalized learning paths, provides interactive practice, and surfaces educational opportunities. We may add, change, or remove features over time.</p>
        </Section>

        <Section n={2} title="Your account">
          <p>You are responsible for the accuracy of your account information and for keeping your login secure. You must be old enough to use an online service in your country, or have a parent or guardian&apos;s permission. You are responsible for activity under your account.</p>
        </Section>

        <Section n={3} title="Acceptable use">
          <p>Please use HIMQ respectfully. You agree not to:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>break the law or infringe others&apos; rights;</li>
            <li>upload harmful, hateful, or illegal content;</li>
            <li>attempt to disrupt, overload, scrape, or reverse-engineer the service;</li>
            <li>abuse the AI to generate prohibited or harmful content.</li>
          </ul>
          <p>We may suspend accounts that violate these rules.</p>
        </Section>

        <Section n={4} title="AI content disclaimer">
          <p>May is an AI tutor. Its responses are for educational purposes and may be inaccurate or incomplete. HIMQ is not a substitute for professional, legal, medical, or financial advice. Always verify important information independently.</p>
        </Section>

        <Section n={5} title="Your content">
          <p>You keep ownership of the content you create (such as your goals and messages). By submitting an opportunity to the public feed, you grant us permission to review, edit, and display it. We may remove content that violates these terms.</p>
        </Section>

        <Section n={6} title="Plans &amp; payments">
          <p>HIMQ offers a free plan and paid plans. When paid plans launch, payments are processed securely by Polar.sh. Paid plans are billed monthly and can be cancelled at any time; access continues until the end of the paid period. Prices may change with reasonable notice.</p>
        </Section>

        <Section n={7} title="Termination">
          <p>You may stop using HIMQ and delete your account at any time. We may suspend or terminate accounts that breach these terms or harm the service or other users.</p>
        </Section>

        <Section n={8} title="Disclaimer &amp; liability">
          <p>HIMQ is provided &quot;as is,&quot; without warranties of any kind. To the maximum extent permitted by law, we are not liable for indirect or consequential damages arising from your use of the service.</p>
        </Section>

        <Section n={9} title="Changes to these terms">
          <p>We may update these terms as HIMQ evolves. If we make material changes, we&apos;ll update the date above and, where appropriate, notify you in the app.</p>
        </Section>

        <Section n={10} title="Contact">
          <p>
            Questions? Email <a href="mailto:himqaiteam@gmail.com" className="text-[var(--color-brand)] hover:underline">himqaiteam@gmail.com</a>.
            See also our <Link href="/privacy" className="text-[var(--color-brand)] hover:underline">Privacy &amp; Security</Link> page.
          </p>
        </Section>
      </div>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'en', ['common'])) },
});
