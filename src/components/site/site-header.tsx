import Link from 'next/link';
import { DEMO_URL } from '@/lib/site';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-dark-secondary/80 backdrop-blur-md">
      <div className="wrapper h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-gray-900 dark:text-white">
          <span className="text-2xl">🏟️</span>
          <span>Dheva<span className="text-indigo-600 dark:text-indigo-400">Suite</span></span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600 dark:text-gray-400">
          <Link href="/#features" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">ฟีเจอร์</Link>
          <Link href="/#how" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">เริ่มใช้งาน</Link>
          <Link href="/#pricing" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">แพ็กเกจ</Link>
          <Link href="/contact" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition">ติดต่อฝ่ายขาย</Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/sport/auth/signin"
            className="hidden sm:inline-flex text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo-600 px-3 py-2"
          >
            เข้าสู่ระบบ
          </Link>
          <Link
            href={DEMO_URL}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-indigo-500 hover:bg-indigo-600 px-4 py-2 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            ดูเดโม →
          </Link>
        </div>
      </div>
    </header>
  );
}
