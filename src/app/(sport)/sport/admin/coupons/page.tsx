import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { CouponManager } from './coupon-manager';
import { getTranslations } from 'next-intl/server';
import { isCouponSystemEnabled } from '@/lib/settings';

export async function generateMetadata() {
  const t = await getTranslations('admin');
  return { title: t('coupons.title') };
}

export default async function AdminCouponsPage() {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') redirect('/sport');

  const [coupons, couponSystemEnabled] = await Promise.all([
    prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } }),
    isCouponSystemEnabled(),
  ]);

  return (
    <div className="wrapper py-8 max-w-5xl">
      <div className="mb-6">
        <Link href="/sport/admin" className="text-sm text-gray-400 hover:text-gray-600">← Dashboard</Link>
      </div>
      <CouponManager
        initialCoupons={coupons.map((c) => ({ ...c, expiresAt: c.expiresAt?.toISOString() ?? null }))}
        initialCouponSystemEnabled={couponSystemEnabled}
      />
    </div>
  );
}
