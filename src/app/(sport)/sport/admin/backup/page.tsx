import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { listBackups } from '@/lib/backup';
import { BackupClient } from './backup-client';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Backup' };

export default async function BackupPage() {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') redirect('/sport');

  let initialBackups: Awaited<ReturnType<typeof listBackups>> = [];
  let initialError: string | null = null;
  try {
    initialBackups = await listBackups();
  } catch (e) {
    initialError = e instanceof Error ? e.message : 'Failed to load backups';
  }

  return (
    <div className="wrapper py-8 max-w-4xl">
      <BackupClient initialBackups={initialBackups} initialError={initialError} />
    </div>
  );
}
