import { SessionProvider } from 'next-auth/react';
import { auth } from '@/lib/auth';
import { SportHeader } from '@/components/sport/sport-header';
import Link from 'next/link';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <SessionProvider session={session}>
      <div className="min-h-screen bg-gray-50 dark:bg-dark-primary flex flex-col">
        <SportHeader />
        <div className="flex-1 flex flex-col">{children}</div>
        <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-dark-secondary py-10">
          <div className="wrapper">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🏟️</span>
                <span className="font-bold text-gray-900 dark:text-white text-lg">88ARENA</span>
                <span className="text-xs text-gray-400 ml-2">ระบบจองสนามกีฬาออนไลน์</span>
              </div>
              <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-gray-500 dark:text-gray-400">
                <Link href="/sport" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">สนามทั้งหมด</Link>
                <Link href="/sport/auth/signin" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">เข้าสู่ระบบ</Link>
                <Link href="/sport/auth/signup" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">สมัครสมาชิก</Link>
                <Link href="/contact" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">ติดต่อเรา</Link>
                <Link href="/privacy" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">นโยบายความเป็นส่วนตัว</Link>
              </nav>
              <p className="text-xs text-gray-400">© {new Date().getFullYear()} 88ARENA — All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </SessionProvider>
  );
}
