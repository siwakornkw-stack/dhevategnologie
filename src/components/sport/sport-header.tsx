'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useState } from 'react';
import { NotificationBell } from './notification-bell';

export function SportHeader() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const isAdmin = session?.user?.role === 'ADMIN';
  const isUnverified = session && !session.user.emailVerified;

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-dark-secondary/80 backdrop-blur-md">
      <div className="wrapper h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/sport" className="flex items-center gap-2 font-bold text-lg text-gray-900 dark:text-white">
          <span className="text-2xl">🏟️</span>
          <span className="hidden sm:block">88ARENA</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          <Link href="/sport" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors font-medium">
            สนามทั้งหมด
          </Link>
          {session && (
            <>
              <Link href="/sport/bookings" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors font-medium">
                การจองของฉัน
              </Link>
              <Link href="/sport/chat" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors font-medium">
                แชท
              </Link>
              <Link href="/sport/profile" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors font-medium">
                โปรไฟล์
              </Link>
            </>
          )}
          {isAdmin && (
            <Link href="/sport/admin" className="text-sm text-primary-600 dark:text-primary-400 font-semibold">
              Admin Dashboard
            </Link>
          )}
        </nav>

        {/* Right Side */}
        <div className="flex items-center gap-3">
          {session && <NotificationBell />}
          {status === 'loading' ? (
            <div className="h-9 w-24 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
          ) : session ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-700 dark:text-primary-300 font-semibold text-xs">
                  {session.user?.name?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <span className="hidden sm:block text-gray-700 dark:text-gray-300 max-w-[120px] truncate">
                  {session.user?.name}
                </span>
                <span className="text-gray-400 text-xs">▾</span>
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-theme-lg py-2 z-50">
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800">
                      <p className="text-xs text-gray-400">{session.user?.email}</p>
                      {isAdmin && (
                        <span className="text-xs font-medium text-primary-600 dark:text-primary-400">● Admin</span>
                      )}
                    </div>
                    <Link href="/sport/profile" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                      โปรไฟล์ของฉัน
                    </Link>
                    <Link href="/sport/bookings" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                      การจองของฉัน
                    </Link>
                    {isAdmin && (
                      <Link href="/sport/admin" onClick={() => setMenuOpen(false)} className="block px-4 py-2 text-sm text-primary-600 dark:text-primary-400 font-medium hover:bg-gray-50 dark:hover:bg-gray-800">
                        Admin Dashboard
                      </Link>
                    )}
                    <button
                      onClick={() => { signOut({ callbackUrl: '/sport' }); setMenuOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      ออกจากระบบ
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/sport/auth/signin"
                className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-primary-600 px-3 py-2"
              >
                เข้าสู่ระบบ
              </Link>
              <Link
                href="/sport/auth/signup"
                className="gradient-btn text-sm font-medium text-white px-4 py-2 rounded-full"
              >
                สมัครสมาชิก
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Email verification warning */}
      {isUnverified && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800/50 px-4 py-2 text-center text-xs text-amber-700 dark:text-amber-400">
          อีเมลยังไม่ได้รับการยืนยัน — กรุณาตรวจสอบกล่องจดหมายของคุณ
          <a href="/sport/auth/resend-verification" className="ml-2 underline font-medium">ส่งอีกครั้ง</a>
        </div>
      )}

      {/* Mobile Nav */}
      {session && (
        <div className="md:hidden border-t border-gray-100 dark:border-gray-800 flex">
          <Link href="/sport" className="flex-1 text-center py-2 text-xs text-gray-600 dark:text-gray-400">
            🏟️ สนาม
          </Link>
          <Link href="/sport/bookings" className="flex-1 text-center py-2 text-xs text-gray-600 dark:text-gray-400">
            📋 การจอง
          </Link>
          <Link href="/sport/chat" className="flex-1 text-center py-2 text-xs text-gray-600 dark:text-gray-400">
            💬 แชท
          </Link>
          <Link href="/sport/profile" className="flex-1 text-center py-2 text-xs text-gray-600 dark:text-gray-400">
            👤 โปรไฟล์
          </Link>
          {isAdmin && (
            <Link href="/sport/admin" className="flex-1 text-center py-2 text-xs text-primary-600 dark:text-primary-400 font-medium">
              ⚙️ Admin
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
