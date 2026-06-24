import Link from 'next/link';
import { SPORT_TYPE_LABELS, SPORT_TYPE_EMOJI } from '@/lib/booking';
import { SportType } from '@prisma/client';
import { DEMO_URL } from '@/lib/site';

export const metadata = {
  title: 'DhevaSuite — ระบบจัดการสนามกีฬาครบวงจร จอง + POS ในระบบเดียว',
  description:
    'ระบบจองออนไลน์ + POS ขายหน้าร้าน + จัดการสต็อกและรายงาน สำหรับสนามกีฬาและอารีน่า เปิดรับจอง 24 ชม. ปิดการขายไวขึ้น เห็นตัวเลขจริงแบบเรียลไทม์ ทดลองดูเดโมได้ทันที',
};

const FEATURES = [
  { emoji: '📅', title: 'ระบบจองออนไลน์', desc: 'ลูกค้าเลือกสนาม เลือกเวลา และชำระเงินจองเองได้ตลอด 24 ชม. ลดงานรับโทรศัพท์ ไม่จองซ้ำซ้อน รองรับจองล่วงหน้าและคิวรอ' },
  { emoji: '💵', title: 'POS ขายหน้าร้าน', desc: 'เปิดบิล แยก/รวมโต๊ะ รับชำระหลายช่องทาง พิมพ์ใบเสร็จ และปิดการขายได้ในไม่กี่คลิก พร้อมระบบกะเงินสดของแคชเชียร์' },
  { emoji: '📦', title: 'จัดการสต็อกสินค้า', desc: 'ตัดสต็อกอัตโนมัติเมื่อขาย แจ้งเตือนของใกล้หมด เห็นความเคลื่อนไหวและต้นทุน-กำไรรายสินค้าได้ชัดเจน' },
  { emoji: '🎟️', title: 'สมาชิก แต้ม คูปอง', desc: 'ระบบสมาชิก สะสมแต้ม คูปองส่วนลด และรีวิว ช่วยดึงลูกค้าเก่ากลับมาใช้บริการซ้ำ' },
  { emoji: '📊', title: 'รายงานเรียลไทม์', desc: 'สรุปยอดขาย การจอง และกะเงินสด ดูได้ทุกที่ทุกเวลา ปิดรอบกะแม่นยำ ตัดสินใจด้วยตัวเลขจริง' },
  { emoji: '💳', title: 'ชำระเงิน + แจ้งเตือน', desc: 'รับบัตรและ PromptPay ผ่าน Stripe ออกใบเสร็จ PDF แจ้งเตือนลูกค้าและทีมงานผ่านอีเมล LINE และ Push' },
];

const WHY = [
  { emoji: '🕒', title: 'เพิ่มยอดจอง', desc: 'รับจองออนไลน์ตลอด 24 ชม. ไม่พลาดลูกค้านอกเวลาทำการ และไม่เสียคิวเพราะตอบช้า' },
  { emoji: '🧩', title: 'ลดงานหน้าร้าน', desc: 'จอง ขาย สต็อก และสมาชิก รวมอยู่ในระบบเดียว ไม่ต้องสลับหลายโปรแกรมให้สับสน' },
  { emoji: '📈', title: 'ตัดสินใจด้วยข้อมูล', desc: 'เห็นยอดขาย กำไร และของคงเหลือแบบเรียลไทม์ รู้ว่าสนามและสินค้าตัวไหนทำเงิน' },
];

const HOW_IT_WORKS = [
  { step: '1', title: 'ดูเดโม / ปรึกษาทีมงาน', desc: 'ลองใช้ระบบจริงและสอบถามความต้องการของสนามคุณก่อนตัดสินใจ' },
  { step: '2', title: 'ตั้งค่าสนามและสินค้า', desc: 'ทีมงานช่วยนำเข้าข้อมูลสนาม ราคา และสินค้า ตั้งค่าให้พร้อมใช้' },
  { step: '3', title: 'เปิดรับจองและขายได้เลย', desc: 'ลูกค้าจองออนไลน์ แคชเชียร์เริ่มขายหน้าร้านได้ทันที' },
];

const PLANS = [
  {
    name: 'เริ่มต้น',
    tagline: 'สำหรับสนามเดี่ยวที่เพิ่งเริ่มรับจองออนไลน์',
    popular: false,
    features: ['ระบบจองออนไลน์ 1 สาขา', 'POS ขายหน้าร้าน', 'จัดการสต็อกพื้นฐาน', 'รายงานยอดขายและการจอง', 'ซัพพอร์ตทางอีเมล'],
  },
  {
    name: 'มาตรฐาน',
    tagline: 'สำหรับสนามที่มีหลายคอร์ตและทีมงานหลายคน',
    popular: true,
    features: ['ทุกอย่างในแพ็กเกจเริ่มต้น', 'สมาชิก แต้ม และคูปอง', 'หลายแคชเชียร์ + ระบบกะเงินสด', 'ชำระเงินออนไลน์ (บัตร/PromptPay)', 'แจ้งเตือนอีเมล/LINE/Push', 'ซัพพอร์ตทางโทรศัพท์'],
  },
  {
    name: 'องค์กร',
    tagline: 'สำหรับเครือสนามและอารีน่าขนาดใหญ่',
    popular: false,
    features: ['ทุกอย่างในแพ็กเกจมาตรฐาน', 'ปรับแต่งฟีเจอร์ตามธุรกิจ', 'เชื่อมต่อระบบภายในผ่าน API', 'ผู้ดูแลบัญชีเฉพาะองค์กร', 'อบรมการใช้งานถึงที่', 'SLA และซัพพอร์ตลำดับความสำคัญสูง'],
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-white dark:bg-dark-primary pt-20 pb-24">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary-400/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-violet-400/20 blur-3xl pointer-events-none" />

        <div className="wrapper relative text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300 text-sm font-medium mb-6">
            🏟️ ระบบจัดการสนามกีฬาครบวงจร โดย Dheva Technologie
          </span>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-white leading-tight tracking-tight">
            เปิดสนามให้ลูกค้าจองออนไลน์
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-violet-500">
              และขายหน้าร้านในระบบเดียว
            </span>
          </h1>

          <p className="mt-5 text-lg sm:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
            DhevaSuite รวมระบบจองออนไลน์ POS ขายหน้าร้าน จัดการสต็อก สมาชิก และรายงาน
            ไว้ในที่เดียว สำหรับสนามกีฬาและอารีน่าทุกขนาด
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href={DEMO_URL}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-base shadow-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              ดูเดโมจริง →
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white font-semibold text-base hover:bg-gray-300 dark:hover:bg-gray-600 transition shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              ติดต่อฝ่ายขาย
            </Link>
          </div>

          {/* Trust strip */}
          <div className="mt-14 inline-flex flex-wrap justify-center gap-x-8 gap-y-3 px-8 py-5 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700/50 shadow-theme-xs text-sm text-gray-600 dark:text-gray-300">
            <span className="inline-flex items-center gap-2">✅ รับจองออนไลน์ 24 ชม.</span>
            <span className="inline-flex items-center gap-2">✅ ปิดการขายไม่กี่คลิก</span>
            <span className="inline-flex items-center gap-2">✅ รองรับบัตร/PromptPay</span>
            <span className="inline-flex items-center gap-2">✅ รายงานเรียลไทม์</span>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-20 bg-gray-50 dark:bg-dark-secondary">
        <div className="wrapper">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">ทุกอย่างที่สนามคุณต้องใช้ ในระบบเดียว</h2>
            <p className="mt-2 text-gray-500 dark:text-gray-400">ตั้งแต่ลูกค้ากดจอง จนปิดยอดขายหน้าร้าน ครบในแพลตฟอร์มเดียว</p>
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

      {/* ── Why ── */}
      <section className="py-20 bg-white dark:bg-dark-primary">
        <div className="wrapper">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">ทำไมสนามถึงเลือก DhevaSuite</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {WHY.map((w) => (
              <div key={w.title} className="p-6 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700/50 text-center">
                <div className="text-4xl mb-3">{w.emoji}</div>
                <div className="font-bold text-gray-900 dark:text-white text-lg mb-1">{w.title}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{w.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sport types supported ── */}
      <section className="py-20 bg-gray-50 dark:bg-dark-secondary">
        <div className="wrapper">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">รองรับทุกประเภทสนาม</h2>
            <p className="mt-2 text-gray-500 dark:text-gray-400">ฟุตบอล บาส แบดมินตัน เทนนิส และอีกหลากหลายประเภทกีฬา</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {Object.values(SportType).map((type) => (
              <div
                key={type}
                className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/50 text-center"
              >
                <span className="text-4xl">{SPORT_TYPE_EMOJI[type]}</span>
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">{SPORT_TYPE_LABELS[type]}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it Works ── */}
      <section id="how" className="py-20 bg-white dark:bg-dark-primary">
        <div className="wrapper">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">เริ่มใช้งานได้ใน 3 ขั้นตอน</h2>
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

      {/* ── Pricing ── */}
      <section id="pricing" className="py-20 bg-gray-50 dark:bg-dark-secondary">
        <div className="wrapper">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">แพ็กเกจที่เหมาะกับสนามคุณ</h2>
            <p className="mt-2 text-gray-500 dark:text-gray-400">เลือกตามขนาดธุรกิจ ปรับแต่งได้ ติดต่อรับใบเสนอราคาและทดลองใช้ฟรี</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 items-start max-w-5xl mx-auto">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`relative flex flex-col p-8 rounded-3xl bg-white dark:bg-gray-900 border ${
                  p.popular
                    ? 'border-indigo-500 dark:border-indigo-400 shadow-theme-sm'
                    : 'border-gray-200 dark:border-gray-700/50'
                }`}
              >
                {p.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-indigo-500 text-white text-xs font-semibold">
                    แนะนำ
                  </span>
                )}
                <div className="text-xl font-bold text-gray-900 dark:text-white">{p.name}</div>
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400 min-h-[40px]">{p.tagline}</div>
                <Link
                  href="/contact"
                  className={`mt-6 inline-flex items-center justify-center px-5 py-3 rounded-full font-semibold text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    p.popular
                      ? 'bg-indigo-500 hover:bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  ขอใบเสนอราคา
                </Link>
                <div className="my-6 h-px bg-gray-100 dark:bg-gray-800" />
                <ul className="flex flex-col gap-3">
                  {p.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                      <span className="text-indigo-500 flex-shrink-0 mt-0.5">✓</span>
                      {feat}
                    </li>
                  ))}
                </ul>
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
                พร้อมเปลี่ยนสนามให้เป็นระบบดิจิทัลแล้วหรือยัง?
              </h2>
              <p className="text-primary-100 text-lg mb-8 max-w-xl mx-auto">
                ลองดูเดโมจริง หรือให้ทีมงานช่วยวางระบบจองและขายหน้าร้านให้สนามของคุณ
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link
                  href={DEMO_URL}
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-white text-primary-700 font-bold text-base hover:bg-primary-50 transition shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  ดูเดโมจริง →
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-white/10 border border-white/30 text-white font-semibold text-base hover:bg-white/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  ติดต่อฝ่ายขาย
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
