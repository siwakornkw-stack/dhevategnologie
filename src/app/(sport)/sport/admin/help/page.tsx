import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';

export const metadata = { title: 'วิธีใช้งาน - Admin' };

interface Section {
  id: string;
  title: string;
  emoji: string;
  href?: string;
  intro: string;
  steps: string[];
  tips?: string[];
  download?: { label: string; href: string };
}

const SECTIONS: Section[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    emoji: '🏠',
    href: '/sport/admin',
    intro: 'หน้าหลักของแอดมิน รวมสถิติและจัดการสนาม',
    steps: [
      'ดูสถิติรวม: สนามที่ใช้งาน, จำนวนผู้ใช้, การจองทั้งหมด, รายการรอการอนุมัติ',
      'กด "+ เพิ่มสนาม" เพื่อสร้างสนามใหม่ ตั้งราคา/ชม., เวลาเปิด-ปิด',
      'กดที่สนามแต่ละแห่ง: แก้ไข, ปิดวันหยุด (Blocked Dates), หรือลบ',
      'ดู Recent Bookings 6 รายการล่าสุด พร้อมเบอร์ติดต่อลูกค้า',
    ],
    tips: ['Auto-refresh เปิดอยู่ทุก 30 วินาที — ไม่ต้องกด F5'],
  },
  {
    id: 'calendar',
    title: 'ปฏิทิน',
    emoji: '📅',
    href: '/sport/admin/calendar',
    intro: 'มุมมองปฏิทิน เห็นการจองทั้งหมดในแต่ละวัน',
    steps: [
      'เลือกวันที่ในปฏิทิน เพื่อดูรายการจองทั้งหมดของวันนั้น',
      'กดที่ booking เพื่ออนุมัติ/ปฏิเสธ/ยกเลิก',
      'สลับมุมมองสนาม (filter by field) ได้ที่ด้านบน',
    ],
  },
  {
    id: 'bookings',
    title: 'รายการจองทั้งหมด',
    emoji: '📋',
    href: '/sport/admin/bookings',
    intro: 'จัดการการจองทุกรายการ พร้อม bulk actions',
    steps: [
      'Filter: ช่วงวันที่, สถานะ (PENDING/APPROVED/REJECTED/CANCELLED), ประเภทกีฬา',
      'อนุมัติทีละหลายรายการ: ติ๊ก checkbox แล้วกด "อนุมัติทั้งหมด"',
      'ปฏิเสธ: ใส่เหตุผล (optional) แล้วยืนยัน',
      'Export CSV — ออก report ไฟล์ csv (สูงสุด 5000 รายการต่อครั้ง)',
    ],
    tips: [
      'การอนุมัติจะให้แต้ม loyalty อัตโนมัติ + bonus referral (ถ้ามี)',
      'ระบบป้องกัน slot ทับซ้อน — ถ้ามีการจองอื่นในช่วงเดียวกัน จะ reject',
    ],
  },
  {
    id: 'availability',
    title: 'ดูสนามว่าง + จองด่วน',
    emoji: '🟢',
    href: '/sport/admin/availability',
    intro: 'เห็นทุกสนามในวันเดียว เลือกช่อง 15 นาที จองให้ลูกค้าได้ทันที',
    steps: [
      'เลือกวันที่ — เห็นทุกสนามพร้อมกัน',
      'ปุ่มสีเขียว = ว่าง, สีเทา = ถูกจอง (กดไม่ได้)',
      'กดช่องเวลาที่ต้องการ → dialog เปิด',
      'ตั้งเวลาเริ่ม-สิ้นสุด (step 5 นาที), ใส่หมายเหตุ (ชื่อ/เบอร์ลูกค้า)',
      'จองซ้ำทุกสัปดาห์: ติ๊ก checkbox + กำหนดจำนวนสัปดาห์ (สูงสุด 26)',
      'กด "จองและอนุมัติ" — สถานะเป็น APPROVED ทันที',
    ],
    tips: ['Slot แสดงเป็นช่วง 15 นาที (18:00, 18:15, 18:30, ...) เพื่อความยืดหยุ่น'],
  },
  {
    id: 'fields',
    title: 'จัดการสนามกีฬา',
    emoji: '🏟️',
    href: '/sport/admin/fields',
    intro: 'รายชื่อสนามทั้งหมด พร้อมจัดการเชิงลึก',
    steps: [
      'เพิ่มสนาม: ชื่อ, ประเภทกีฬา, ราคา/ชม., เวลาเปิด-ปิด, สถานที่, สิ่งอำนวยความสะดวก',
      'ตั้ง Price Rules: ราคาตามช่วงเวลา เช่น Peak hour 19:00-22:00 ราคา x2',
      'ปิดวันหยุด (Blocked Dates): เลือกวันที่ไม่ให้จองได้',
      'ปิด/เปิดสนามชั่วคราว — toggle isActive',
      'ลบสนาม — soft delete (ยังเก็บประวัติ booking)',
    ],
  },
  {
    id: 'users',
    title: 'จัดการผู้ใช้',
    emoji: '👥',
    href: '/sport/admin/users',
    intro: 'ดูผู้ใช้ทั้งหมด, ปรับบทบาท, ดูแต้ม loyalty',
    steps: [
      'Search: ชื่อ/อีเมล/เบอร์โทร',
      'เปลี่ยน role: USER ↔ ADMIN ↔ MANAGER ↔ STAFF',
      'ดูแต้มสะสม (loyalty points) ของแต่ละคน',
      'ดูจำนวนการจองและประวัติ',
    ],
  },
  {
    id: 'waiting-list',
    title: 'รายการรอ (Waiting List)',
    emoji: '🕐',
    href: '/sport/admin/waiting-list',
    intro: 'ลูกค้าที่ขอจองในช่วงเวลาที่เต็มแล้ว — จะเข้าคิวรอที่นี่',
    steps: [
      'ดูรายการรอตามวัน/สนาม',
      'ติดต่อลูกค้าถ้ามีคนยกเลิก — เสนอช่วงที่ว่าง',
      'ลบ entry หลังจัดการแล้ว',
    ],
  },
  {
    id: 'coupons',
    title: 'คูปอง',
    emoji: '🎟️',
    href: '/sport/admin/coupons',
    intro: 'สร้างโค้ดส่วนลด PERCENT หรือ FIXED',
    steps: [
      'กด "+ สร้างคูปอง" — กำหนด code, ประเภทส่วนลด, มูลค่า',
      'ตั้งวันหมดอายุ + จำนวนใช้ได้ (usage limit)',
      'เปิด/ปิดคูปอง (isActive)',
      'ลูกค้าใส่ code ตอน checkout — ระบบเช็คเงื่อนไขอัตโนมัติ',
    ],
    tips: ['PERCENT: ลด N% จากยอด, FIXED: ลด N บาท (ไม่เกินยอดรวม)'],
  },
  {
    id: 'reports',
    title: 'รีพอร์ต / Analytics',
    emoji: '📊',
    href: '/sport/admin/reports',
    intro: 'วิเคราะห์รายได้, occupancy rate, ช่วงเวลายอดนิยม',
    steps: [
      'Filter: วันที่, สถานะ, ประเภทกีฬา',
      'ดู: รายได้สุทธิ, รายได้ที่ถูกยกเลิก, แยกตามประเภทกีฬา/สนาม',
      'Heatmap วันxชั่วโมง — เห็นช่วงเวลาที่จองเยอะ',
      'Occupancy Rate ของแต่ละสนาม (ชม.จองจริง / ชม.ที่เปิดบริการ)',
      'Trend รายได้ของ top 5 สนาม',
      'Export CSV',
    ],
  },
  {
    id: 'chat',
    title: 'แชทกับลูกค้า',
    emoji: '💬',
    href: '/sport/admin/chat',
    intro: 'รับ-ตอบข้อความจากลูกค้าในระบบ',
    steps: [
      'ดู conversations ทั้งหมด',
      'เปิดห้องแชท — เห็นประวัติย้อนหลัง',
      'ส่งข้อความ/รูปภาพได้',
    ],
  },
  {
    id: 'pos',
    title: 'POS (จุดขายหน้าร้าน)',
    emoji: '🛒',
    href: '/sport/pos',
    intro: 'ระบบขายหน้าร้านครบวงจร — สินค้า, stock, refund, shift, รายงาน',
    steps: [
      'เปิดกะ (Shift Open) — บันทึก opening cash float',
      'ขายด่วน (Quick Sale): สแกน barcode หรือเลือกสินค้า → checkout',
      'จัดการสินค้า (Products): เพิ่ม/แก้/ลบ, ตั้งราคา, barcode, ภาพ',
      'จัดการ Stock: เติม (Stock In), ตัดสต๊อก (Stock Out), ปรับยอด (Adjust)',
      'รับเงิน: cash/QR/transfer, ให้ทอน, พิมพ์ใบเสร็จ',
      'ใช้แต้ม loyalty + คูปอง POS',
      'Refund: คืนเงินทั้งบิล/บางส่วน — บันทึก audit log',
      'ปิดกะ (Shift Close): ระบบสรุปยอดขาย, เทียบเงินสดจริง',
      'รายงานยอดขาย: ตามวัน/พนักงาน/วิธีจ่าย',
    ],
    tips: [
      'STAFF เปิด/ปิดกะของตัวเองได้',
      'MANAGER ดูรายงานข้ามกะของพนักงาน',
      'ADMIN เห็นทั้งหมด + จัดการ settings',
    ],
  },
  {
    id: 'pos-merge',
    title: 'รวมบิล (Merge Tabs)',
    emoji: '🧾',
    href: '/sport/pos',
    intro: 'รวมหลาย tab (โต๊ะ/ทีม) เข้าเป็นบิลเดียว ก่อน checkout — เหมาะตอนลูกค้าจ่ายรวม',
    steps: [
      'เงื่อนไข: ทุก tab ต้องอยู่สถานะ OPEN และยังไม่ถูก merge มาก่อน (parentTabId = null)',
      'CASHIER รวมได้เฉพาะ tab ที่ตัวเองเปิด — ADMIN รวมได้ทั้งหมด',
      'เลือก tab หลัก (master) — บิลรวมจะอยู่ภายใต้ master นี้',
      'ติ๊ก tab รอง (children) ที่จะรวมเข้า (ห้ามใส่ master ซ้ำ)',
      'กด "รวมบิล" — children เปลี่ยนสถานะเป็น MERGED + parentTabId ชี้ไปที่ master',
      'ตอน checkout: ยอดของ children ทั้งหมดถูกรวมเข้า master โดยอัตโนมัติ',
      'พิมพ์ใบเสร็จเดียวครอบคลุมทุก tab ที่รวม',
    ],
    tips: [
      'เมื่อ merge แล้ว ย้อนกลับไม่ได้ — ตรวจให้แน่ก่อนยืนยัน',
      'tab ที่เป็น MERGED จะไม่แสดงใน list หลัก แต่ยังเปิดดูประวัติได้',
      'ถ้าจะ refund: ทำที่ invoice ของ master tab หลัง checkout',
    ],
  },
  {
    id: 'pos-link-booking',
    title: 'ผูกบิลกับการจอง (Link Tab ↔ Booking)',
    emoji: '🔗',
    href: '/sport/pos',
    intro: 'ผูก POS tab เข้ากับ booking ของลูกค้า — ช่วยให้บิลค่าสนาม + ค่าสินค้ารวมในรอบเดียว',
    steps: [
      'ตอนเปิด tab ใหม่: เลือก "ผูกกับการจอง" → ค้นหา booking จากชื่อ/เบอร์/รหัส',
      'หรือเปิด tab จากหน้า booking โดยตรง (ปุ่ม "เปิดบิล POS")',
      'ระบบเช็คว่า booking ยังไม่ถูกจ่าย (paidAt = null) ก่อนยอมผูก',
      'tab จะแสดง teamLabel = ชื่อทีม/ผู้จอง เพื่อให้ cashier เห็นชัด',
      'เพิ่มสินค้า/บริการเข้า tab ได้ตามปกติ — ขั้นต่ำเช่น น้ำดื่ม ค่าเช่าอุปกรณ์',
      'Checkout: ระบบสามารถ mark booking เป็น PAID พร้อมตัด stock + ออกใบเสร็จรวม',
      'ถ้า booking ถูก CANCELLED/REJECTED: tab ที่ยัง OPEN/HELD จะถูก detach (bookingId = null) อัตโนมัติ — tab ที่ PAID/VOID จะคง link เพื่อรักษาประวัติ',
    ],
    tips: [
      'หนึ่ง booking ผูกได้หลาย tab (เช่น แยกทีม A/B แต่จอง slot เดียวกัน) — ใช้ teamLabel แยก',
      'การ unlink booking จาก tab ที่ยัง OPEN ทำผ่าน PATCH /api/sport/pos/tabs/[id] (ADMIN/CASHIER เจ้าของ)',
      'รายงานยอดขายจะแยกชัดระหว่างยอดสนาม (booking) กับยอดสินค้า (POS items)',
    ],
  },
  {
    id: 'audit-logs',
    title: 'Audit Logs',
    emoji: '📜',
    href: '/sport/admin/audit-logs',
    intro: 'ประวัติการทำงานของแอดมินทั้งหมด — ตรวจสอบย้อนหลัง',
    steps: [
      'Filter: action, แอดมิน, ช่วงวันที่, target ID',
      'ดูใครทำอะไร เมื่อไหร่',
      'ครอบคลุม: booking actions, POS, fields, settings, backup, export',
    ],
  },
  {
    id: 'cash-drawer',
    title: 'เครื่องพิมพ์ + ลิ้นชักเก็บเงิน',
    emoji: '💵',
    intro: 'ตั้งค่าเครื่องพิมพ์ใบเสร็จ (XP-Q80I) + ลิ้นชักเก็บเงิน (EK-350) บน PC cashier — ลิ้นชักเปิดอัตโนมัติเวลารับเงินสด/ทอน',
    steps: [
      'โหลดไฟล์ setup (ปุ่มด้านล่าง) แล้วแตก zip ลงเครื่อง cashier',
      'PC ใหม่: ติดตั้ง driver เครื่องพิมพ์ — เปิด "XPrinter Driver Setup V8.2.exe" เลือกพอร์ต USB',
      'ต่อสาย: ลิ้นชัก EK-350 → RJ11 เข้าเครื่องพิมพ์ XP-Q80I, เครื่องพิมพ์ → USB เข้า PC',
      'double-click "poscashiersetup.cmd" → เลือกเครื่องพิมพ์ → รอจนขึ้น READY',
      'เปิด POS Settings → เปิด "Cash drawer" (ตั้งครั้งเดียว ใช้ร่วมทุกเครื่อง)',
      'ลิ้นชักเปิดเองเมื่อรับเงินสด + มีปุ่ม "เปิดลิ้นชัก" แบบ manual ในหน้าขาย',
    ],
    tips: [
      'ลิ้นชักเปิดเฉพาะจ่ายเงินสด — บัตร/QR/โอน ไม่เปิด, reprint ไม่เปิด',
      'agent autostart ตอนเปิดเครื่อง (Startup shortcut) — ไม่ต้องเปิดเอง',
      'ลิ้นชักไม่เปิด: ดูหน้าต่าง run-agent มี error ไหม หรือแก้ DRAWER_PIN=1 ใน run-agent.cmd',
      'ย้าย/เพิ่ม PC cashier: รัน poscashiersetup.cmd บนเครื่องใหม่อีกครั้ง',
      'ใช้ได้ทั้ง Windows 10 และ 11 — ถ้าไม่มี Node จะโหลด portable ให้อัตโนมัติ',
    ],
    download: { label: 'โหลดตัวติดตั้ง (poscashiersetup.zip)', href: '/downloads/poscashiersetup.zip' },
  },
  {
    id: 'backup',
    title: 'Backup ฐานข้อมูล',
    emoji: '💾',
    href: '/sport/admin/backup',
    intro: 'สำรองข้อมูลทั้งหมดเป็นไฟล์ JSON เก็บใน Vercel Blob',
    steps: [
      'กด "Create Backup" → ระบบ snapshot DB ทั้งหมด',
      'Download backup เป็นไฟล์ .json',
      'Restore: upload ไฟล์ — ระบบจะเช็ค schema ก่อน',
    ],
    tips: ['Backup เก็บใน private blob — เข้าถึงผ่านระบบเท่านั้น'],
  },
];

export default async function AdminHelpPage() {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') redirect('/sport');

  return (
    <div className="wrapper py-8 max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/sport/admin"
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition"
        >
          &larr; Dashboard
        </Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">วิธีใช้งาน</h1>
      </div>

      <div className="bg-gradient-to-br from-indigo-500/10 to-indigo-400/10 border border-indigo-200 dark:border-indigo-900/50 rounded-2xl p-5">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">คู่มือผู้ดูแลระบบ DhevaSuite</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          สรุปวิธีใช้งานทุกหน้าในระบบแอดมิน เลือกหัวข้อด้านล่างเพื่อดูรายละเอียด
        </p>
      </div>

      {/* Table of contents */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">สารบัญ</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              {s.emoji} {s.title}
            </a>
          ))}
        </div>
      </div>

      {/* Sections */}
      {SECTIONS.map((s) => (
        <section
          key={s.id}
          id={s.id}
          className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-5 scroll-mt-20"
        >
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{s.emoji}</span>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{s.title}</h2>
            </div>
            {s.href && (
              <Link
                href={s.href}
                className="px-3 py-1.5 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                เปิดหน้านี้ →
              </Link>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{s.intro}</p>
          <ol className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            {s.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center justify-center tabular-nums">
                  {i + 1}
                </span>
                <span className="flex-1">{step}</span>
              </li>
            ))}
          </ol>
          {s.tips && s.tips.length > 0 && (
            <div className="mt-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">💡 Tips</p>
              <ul className="space-y-1">
                {s.tips.map((tip, i) => (
                  <li key={i} className="text-xs text-gray-600 dark:text-gray-400">
                    · {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {s.download && (
            <a
              href={s.download.href}
              download
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              ⬇ {s.download.label}
            </a>
          )}
        </section>
      ))}

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">บทบาท (Roles) ในระบบ</h3>
        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li><span className="font-semibold">ADMIN</span> — เข้าถึงทุกอย่าง รวม settings, backup, audit logs</li>
          <li><span className="font-semibold">MANAGER</span> — POS เต็มสิทธิ์ + ดูรายงานข้ามกะ</li>
          <li><span className="font-semibold">STAFF</span> — เปิด/ปิดกะของตัวเอง ขายผ่าน POS</li>
          <li><span className="font-semibold">USER</span> — ลูกค้า จองสนาม สะสมแต้ม</li>
        </ul>
      </div>
    </div>
  );
}
