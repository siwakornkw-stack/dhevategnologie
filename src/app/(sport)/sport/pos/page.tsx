import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const metadata = { title: 'POS' };
export const dynamic = 'force-dynamic';

export default async function PosHubPage() {
  const session = await auth();
  if (!session) redirect('/sport/auth/signin?callbackUrl=/sport/pos');
  const role = session.user.role;
  if (role !== 'ADMIN' && role !== 'CASHIER') redirect('/sport');

  const isAdmin = role === 'ADMIN';

  const lowStockRows = await prisma.$queryRaw<{ c: bigint }[]>`
    SELECT COUNT(*)::bigint AS c FROM "PosProduct"
    WHERE "deletedAt" IS NULL AND "isActive" = true
      AND "lowStockAlert" > 0 AND "stockQty" <= "lowStockAlert"
  `.catch(() => [{ c: BigInt(0) }]);
  const lowStockCount = Number(lowStockRows[0]?.c || 0);

  const items: { href: string; title: string; desc: string; admin?: boolean }[] = [
    { href: '/sport/pos/sale', title: 'ขายหน้าร้าน', desc: 'POS ขายของ + Quick Sale' },
    { href: '/sport/pos/tabs', title: 'Tabs / โต๊ะ', desc: 'จัดการบิลที่เปิดอยู่' },
    { href: '/sport/pos/shift', title: 'กะ (Shift)', desc: 'เปิด-ปิดกะ + X/Z report' },
    { href: '/sport/pos/invoices', title: 'บิลย้อนหลัง', desc: 'ดู / พิมพ์ซ้ำ / refund / void' },
    { href: '/sport/pos/customers', title: 'ลูกค้า', desc: 'ค้นลูกค้า + แต้ม + ประวัติซื้อ' },
    { href: '/sport/pos/products', title: 'สินค้า', desc: 'เพิ่ม/แก้สินค้า + ราคา', admin: true },
    { href: '/sport/pos/stock', title: 'Stock', desc: 'รับเข้า/ปรับ + log', admin: true },
    { href: '/sport/pos/settings', title: 'ตั้งค่า POS', desc: 'VAT, ร้าน, ใบเสร็จ', admin: true },
    { href: '/sport/pos/cashiers', title: 'Cashiers', desc: 'จัดการพนักงานคิดเงิน', admin: true },
    { href: '/sport/pos/report', title: 'รายงานยอดขาย', desc: 'สรุปยอด + top สินค้า', admin: true },
    { href: '/sport/pos/audit', title: 'Audit Log', desc: 'ตรวจสอบทุก action ใน POS', admin: true },
  ];

  return (
    <div className="wrapper py-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">POS</h1>
        <p className="text-sm text-gray-500 mt-1">
          role: <span className="font-mono">{role}</span>
        </p>
      </div>

      {lowStockCount > 0 && (
        <Link
          href="/sport/pos/stock"
          className="block px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-sm text-amber-800 dark:text-amber-200 hover:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <b>เตือน:</b> มีสินค้า <span className="tabular-nums">{lowStockCount}</span> รายการ stock ต่ำกว่าจุดเตือน → ดู/รับเข้าสต๊อก
        </Link>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((it) => {
          const disabled = it.admin && !isAdmin;
          return (
            <Link
              key={it.href}
              href={disabled ? '#' : it.href}
              aria-disabled={disabled}
              className={`p-5 rounded-lg border bg-white dark:bg-gray-900 dark:border-gray-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                disabled ? 'opacity-40 pointer-events-none' : 'hover:border-primary-500 hover:shadow-sm'
              }`}
            >
              <div className="font-semibold text-gray-900 dark:text-white">{it.title}</div>
              <div className="text-xs text-gray-500 mt-1">{it.desc}</div>
              {it.admin && <div className="text-[10px] text-amber-600 mt-2">ADMIN only</div>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
