import { SessionProvider } from 'next-auth/react';
import { auth } from '@/lib/auth';
import { SportHeader } from '@/components/sport/sport-header';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  const t = await getTranslations('sport');
  return {
    title: { default: `88ARENA - ${t('metaTitle')}`, template: '%s | 88ARENA' },
    description: t('metaDescription'),
  };
}

export default async function SportLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const t = await getTranslations('sport');

  return (
    <SessionProvider session={session}>
      <div className="min-h-screen bg-gray-50 dark:bg-dark-primary flex flex-col">
        <SportHeader />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-gray-200 dark:border-gray-800 py-6 text-center text-sm text-gray-400">
          © {new Date().getFullYear()} 88ARENA — {t('footerText')}
        </footer>
      </div>
    </SessionProvider>
  );
}
