import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Layout from '@/components/Layout';

interface Props { id: string; }

export default function ChatDetail({ id }: Props) {
  return (
    <Layout fullscreen>
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <p className="text-[var(--text-muted)] text-sm">Chat {id} — coming soon</p>
      </div>
    </Layout>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale, params }) => ({
  props: {
    id: params?.id ?? '',
    ...(await serverSideTranslations(locale ?? 'am', ['common'])),
  },
});
