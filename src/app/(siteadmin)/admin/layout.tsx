import { redirect } from 'next/navigation';
import { SessionProvider } from 'next-auth/react';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { LogoutButton } from '@/components/site/logout-button';

export const metadata = { title: 'หลังบ้าน Dhevategnologie' };

export default async function SiteAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') redirect('/sport/auth/signin?callbackUrl=/admin/leads');

  return (
    <SessionProvider session={session}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
        <header className="sticky top-0 z-50 border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md">
          <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <Link href="/admin/leads" className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
                <span className="text-xl">🏟️</span>
                <span>Dheva<span className="text-indigo-600 dark:text-indigo-400">tegnologie</span></span>
                <span className="text-xs font-medium text-gray-400 ml-1">หลังบ้าน (เว็บขาย)</span>
              </Link>
              <nav className="hidden sm:flex items-center gap-5 text-sm font-medium text-gray-600 dark:text-gray-400">
                <Link href="/admin/leads" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">📨 ลีด/คำขอเดโม</Link>
              </nav>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <Link href="/" className="text-gray-500 hover:text-indigo-600 transition">↗ ดูเว็บขาย</Link>
              <LogoutButton />
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </SessionProvider>
  );
}
