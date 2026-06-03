import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { SPORT_TYPE_LABELS, SPORT_TYPE_EMOJI } from '@/lib/booking';
import { SportType } from '@prisma/client';

export const metadata = { title: '88ARENA — จองสนามกีฬาออนไลน์' };

async function getStats() {
  const [fieldCount, userCount, bookingCount, sportCounts] = await Promise.all([
    prisma.field.count({ where: { isActive: true } }),
    prisma.user.count(),
    prisma.booking.count({ where: { status: 'APPROVED' } }),
    prisma.field.groupBy({ by: ['sportType'], where: { isActive: true }, _count: true }),
  ]);
  return { fieldCount, userCount, bookingCount, sportCounts };
}

const FEATURES = [
  { emoji: '⚡', title: 'จองทันที', desc: 'เลือกสนาม เลือกเวลา ยืนยันได้ใน 30 วินาที ไม่ต้องโทรถาม' },
  { emoji: '📱', title: 'ใช้งานผ่านมือถือ', desc: 'PWA รองรับทุกอุปกรณ์ ติดตั้งได้เหมือนแอปโดยไม่ต้องผ่าน Store' },
  { emoji: '🔔', title: 'แจ้งเตือนอัจฉริยะ', desc: 'ได้รับการแจ้งเตือนเมื่อคิวว่าง อนุมัติการจอง หรือมีข่าวสารสำคัญ' },
  { emoji: '⭐', title: 'รีวิวจากผู้ใช้จริง', desc: 'อ่านรีวิวและให้คะแนนหลังใช้งานสนาม ช่วยให้เลือกสนามได้ตรงใจ' },
  { emoji: '💳', title: 'ชำระเงินออนไลน์', desc: 'รองรับสลิปโอนเงิน พร้อมใบเสร็จ PDF ดาวน์โหลดได้ทันที' },
  { emoji: '🔐', title: 'ความปลอดภัยสูง', desc: 'รองรับการยืนยัน 2 ขั้นตอน (2FA) และการยืนยันอีเมล' },
];

const HOW_IT_WORKS = [
  { step: '1', title: 'ค้นหาสนาม', desc: 'กรองตามประเภทกีฬา ราคา และโลเคชัน' },
  { step: '2', title: 'เลือกวัน-เวลา', desc: 'เช็คช่วงว่าง จองได้ทันทีหรือเข้าคิวรอ' },
  { step: '3', title: 'ยืนยันและเล่น!', desc: 'รับอีเมลยืนยัน แล้วไปสนุกได้เลย' },
];

export default async function HomePage() {
  const { fieldCount, userCount, bookingCount, sportCounts } = await getStats();

  return (
    <div className="flex flex-col">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-white dark:bg-dark-primary pt-20 pb-24">
        {/* glow blobs */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary-400/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-violet-400/20 blur-3xl pointer-events-none" />

        <div className="wrapper relative text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300 text-sm font-medium mb-6">
            🏟️ ยินดีต้อนรับสู่ 88ARENA
          </span>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-white leading-tight tracking-tight">
            จองสนามกีฬา
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-violet-500">
              ออนไลน์ได้ทุกที่
            </span>
          </h1>

          <p className="mt-5 text-lg sm:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
            จองง่ายใน 3 ขั้นตอน ยืนยันทันที ไม่ต้องโทรถาม ไม่ต้องรอนาน
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/sport"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-base shadow-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              ดูสนามทั้งหมด →
            </Link>
            <Link
              href="/sport/auth/signup"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white font-semibold text-base hover:bg-gray-300 dark:hover:bg-gray-600 transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              สมัครสมาชิกฟรี
            </Link>
          </div>

          {/* Stats bar */}
          <div className="mt-14 inline-flex flex-wrap justify-center gap-8 px-8 py-5 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700/50 shadow-theme-xs">
            <div className="text-center">
              <div className="text-3xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">{fieldCount}</div>
              <div className="text-xs text-gray-400 mt-0.5">สนามทั้งหมด</div>
            </div>
            <div className="w-px bg-gray-200 dark:bg-gray-700 hidden sm:block" />
            <div className="text-center">
              <div className="text-3xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">{userCount.toLocaleString()}</div>
              <div className="text-xs text-gray-400 mt-0.5">สมาชิก</div>
            </div>
            <div className="w-px bg-gray-200 dark:bg-gray-700 hidden sm:block" />
            <div className="text-center">
              <div className="text-3xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">{bookingCount.toLocaleString()}</div>
              <div className="text-xs text-gray-400 mt-0.5">การจองสำเร็จ</div>
            </div>
            <div className="w-px bg-gray-200 dark:bg-gray-700 hidden sm:block" />
            <div className="text-center">
              <div className="text-3xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">{sportCounts.length}</div>
              <div className="text-xs text-gray-400 mt-0.5">ประเภทกีฬา</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Sport Types ── */}
      <section className="py-20 bg-gray-50 dark:bg-dark-secondary">
        <div className="wrapper">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">กีฬาที่ให้บริการ</h2>
            <p className="mt-2 text-gray-500 dark:text-gray-400">เลือกสนามตามประเภทกีฬาที่คุณชื่นชอบ</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {Object.values(SportType).map((type) => {
              const count = sportCounts.find((s) => s.sportType === type)?._count ?? 0;
              return (
                <Link
                  key={type}
                  href={`/sport?sport=${type}`}
                  className="group flex flex-col items-center gap-3 p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/50 hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-theme-sm transition text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <span className="text-4xl group-hover:scale-110 transition-transform">{SPORT_TYPE_EMOJI[type]}</span>
                  <div>
                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">{SPORT_TYPE_LABELS[type]}</div>
                    <div className="text-xs text-gray-400 mt-0.5"><span className="tabular-nums">{count}</span> สนาม</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How it Works ── */}
      <section className="py-20 bg-white dark:bg-dark-primary">
        <div className="wrapper">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">จองสนามง่าย ใน 3 ขั้นตอน</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="flex flex-col items-center text-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-500 to-violet-500 flex items-center justify-center text-white text-2xl font-extrabold shadow-lg shadow-primary-500/30">
                  {item.step}
                </div>
                <div>
                  <div className="font-bold text-gray-900 dark:text-white text-lg">{item.title}</div>
                  <div className="text-gray-500 dark:text-gray-400 text-sm mt-1">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20 bg-gray-50 dark:bg-dark-secondary">
        <div className="wrapper">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">ทำไมต้องเลือก 88ARENA?</h2>
            <p className="mt-2 text-gray-500 dark:text-gray-400">ครบ ง่าย สะดวก — ทุกอย่างที่คุณต้องการในที่เดียว</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="flex gap-4 p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/50 shadow-theme-xs hover:shadow-theme-sm transition"
              >
                <div className="text-3xl flex-shrink-0">{f.emoji}</div>
                <div>
                  <div className="font-bold text-gray-900 dark:text-white mb-1">{f.title}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 bg-white dark:bg-dark-primary">
        <div className="wrapper">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-600 to-violet-600 p-10 sm:p-16 text-center shadow-xl shadow-primary-500/20">
            <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
            <div className="relative">
              <div className="text-5xl mb-4">🏟️</div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
                พร้อมจองสนามแล้วหรือยัง?
              </h2>
              <p className="text-primary-100 text-lg mb-8 max-w-xl mx-auto">
                สมัครสมาชิกฟรี เริ่มต้นจองสนามกีฬาคุณภาพดีได้เลยวันนี้
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/sport/auth/signup"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-white text-primary-700 font-bold text-base hover:bg-primary-50 transition shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  สมัครสมาชิกฟรี
                </Link>
                <Link
                  href="/sport"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-white/10 border border-white/30 text-white font-semibold text-base hover:bg-white/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  ดูสนามทั้งหมด →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
