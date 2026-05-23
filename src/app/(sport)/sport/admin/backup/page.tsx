import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { listBackups, isBackupConfigured, type DriveBackupFile } from '@/lib/google-drive';
import { BackupClient } from './backup-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Backup - Admin' };

export default async function AdminBackupPage() {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') redirect('/sport');

  const configured = isBackupConfigured();
  let initialFiles: DriveBackupFile[] = [];
  let listError: string | null = null;
  if (configured) {
    try {
      initialFiles = await listBackups();
    } catch (e) {
      listError = e instanceof Error ? e.message : 'list failed';
    }
  }

  return (
    <div className="wrapper py-8 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/sport/admin" className="text-sm text-gray-500 hover:text-gray-700">&larr; Dashboard</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold">Backup &amp; Restore</h1>
      </div>
      <BackupClient initialFiles={initialFiles} configured={configured} listError={listError} />
    </div>
  );
}
