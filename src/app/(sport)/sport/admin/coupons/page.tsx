import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { CouponManager } from './coupon-manager';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata() {
  const t = await getTranslations('admin');
  return { title: t('coupons.title') };
}

export default async function AdminCouponsPage() {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') redirect('/sport');

  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="wrapper py-8 max-w-5xl">
      <div className="mb-6">
        <Link href="/sport/admin" className="text-sm text-gray-400 hover:text-gray-600">← Dashboard</Link>
      </div>
      <CouponManager initialCoupons={coupons.map((c) => ({ ...c, expiresAt: c.expiresAt?.toISOString() ?? null }))} />
    </div>
  );
}
