import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { RefundClient } from './refund-client';

export const metadata = { title: 'Refund' };

export default async function RefundPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect('/sport/auth/signin');
  if (session.user.role !== 'ADMIN' && session.user.role !== 'CASHIER') redirect('/sport/pos');
  const { id } = await params;
  return <RefundClient invoiceId={id} />;
}
