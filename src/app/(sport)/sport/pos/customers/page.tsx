import { redirect } from 'next/navigation';
import { requirePosRole } from '@/lib/pos';
import { CustomersClient } from './customers-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'ลูกค้า - POS' };

export default async function CustomersPage() {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) redirect('/sport');
  return <CustomersClient />;
}
