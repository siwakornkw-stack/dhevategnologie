import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import Link from 'next/link';
import { AvailabilityClient } from './availability-client';

export async function generateMetadata() {
  return { title: 'ดูสนามว่าง - Admin' };
}

export default async function AdminAvailabilityPage() {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') redirect('/sport');

  return (
    <div className="wrapper py-8 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link
          href="/sport/admin"
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition"
        >
          &larr; Dashboard
        </Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">ดูสนามว่าง</h1>
      </div>
      <AvailabilityClient />
    </div>
  );
}
