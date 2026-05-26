import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { AuditClient } from './audit-client';

export const metadata = { title: 'POS Audit Log' };

export default async function PosAuditPage() {
  const session = await auth();
  if (!session) redirect('/sport/auth/signin?callbackUrl=/sport/pos/audit');
  if (session.user.role !== 'ADMIN') redirect('/sport/pos');
  return <AuditClient />;
}
