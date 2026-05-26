import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { ShiftClient } from './shift-client';

export const metadata = { title: 'กะ POS' };

export default async function ShiftPage() {
  const session = await auth();
  if (!session) redirect('/sport/auth/signin?callbackUrl=/sport/pos/shift');
  const role = session.user.role;
  if (role !== 'ADMIN' && role !== 'CASHIER') redirect('/sport');
  return <ShiftClient />;
}
