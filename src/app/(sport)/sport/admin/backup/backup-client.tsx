'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type Backup = {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: string | Date;
};

export function BackupClient({
  initialBackups,
  initialError,
}: {
  initialBackups: Backup[];
  initialError: string | null;
}) {
  const router = useRouter();
  const [backups, setBackups] = useState<Backup[]>(initialBackups);
  const [error, setError] = useState<string | null>(initialError);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const [restoreText, setRestoreText] = useState('');
  const [restoreTarget, setRestoreTarget] = useState<{ pathname: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const r = await fetch('/api/admin/backup', { cache: 'no-store' });
    const j = await r.json();
    if (r.ok) setBackups(j.backups);
    else setError(j.error || 'Refresh failed');
  }

  function runBackup() {
    setMsg(null);
    setError(null);
    startTransition(async () => {
      const r = await fetch('/api/admin/backup/run', { method: 'POST' });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || 'Backup failed');
        return;
      }
      setMsg(`Backup ok (${formatBytes(j.size)})`);
      await refresh();
    });
  }

  function deleteBackup(pathname: string) {
    if (!confirm('Delete this backup?')) return;
    startTransition(async () => {
      const r = await fetch(`/api/admin/backup?pathname=${encodeURIComponent(pathname)}`, {
        method: 'DELETE',
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || 'Delete failed');
        return;
      }
      setMsg('Deleted');
      await refresh();
    });
  }

  function restoreFromPathname(pathname: string) {
    if (restoreText !== 'RESTORE') {
      setError('Type RESTORE to confirm');
      return;
    }
    setError(null);
    setMsg(null);
    startTransition(async () => {
      const r = await fetch('/api/admin/backup/restore', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pathname, confirm: 'RESTORE' }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || 'Restore failed');
        return;
      }
      setMsg('Restore complete. Reloading.');
      setRestoreTarget(null);
      setRestoreText('');
      setTimeout(() => router.refresh(), 1500);
    });
  }

  function restoreFromFile() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('Choose a file first');
      return;
    }
    if (restoreText !== 'RESTORE') {
      setError('Type RESTORE to confirm');
      return;
    }
    setError(null);
    setMsg(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('file', file);
      fd.set('confirm', 'RESTORE');
      const r = await fetch('/api/admin/backup/restore', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || 'Restore failed');
        return;
      }
      setMsg('Restore complete. Reloading.');
      if (fileRef.current) fileRef.current.value = '';
      setRestoreText('');
      setTimeout(() => router.refresh(), 1500);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Backup และ Restore</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Auto backup ทุกวัน 02:00 น. เก็บไว้ 30 วัน. Restore ทำใน transaction ถ้า fail rollback อัตโนมัติ.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {msg && (
        <div className="rounded-xl border border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-800 p-3 text-sm text-green-700 dark:text-green-300">
          {msg}
        </div>
      )}

      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">Backup ตอนนี้</h2>
          <button
            onClick={runBackup}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {busy ? 'Running...' : 'Backup เดี๋ยวนี้'}
          </button>
        </div>
      </section>

      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white">รายการ Backup ({backups.length})</h2>
        </div>
        {backups.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">ยังไม่มี backup</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {backups.map((b) => (
              <div key={b.pathname} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {b.pathname.replace('db-backups/', '')}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(b.uploadedAt).toLocaleString('th-TH')} · {formatBytes(b.size)}
                  </p>
                </div>
                <a
                  href={`/api/admin/backup/download?pathname=${encodeURIComponent(b.pathname)}`}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Download
                </a>
                <button
                  onClick={() => setRestoreTarget({ pathname: b.pathname })}
                  className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700"
                >
                  Restore
                </button>
                <button
                  onClick={() => deleteBackup(b.pathname)}
                  disabled={busy}
                  className="text-xs px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {restoreTarget && (
        <section className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800 rounded-2xl p-5 space-y-3">
          <h3 className="font-semibold text-amber-900 dark:text-amber-200">ยืนยัน Restore</h3>
          <p className="text-sm text-amber-800 dark:text-amber-300">
            ทุก table ใน database จะถูก replace ด้วยข้อมูลจาก backup นี้. พิมพ์ <code className="font-mono font-bold">RESTORE</code> เพื่อยืนยัน.
          </p>
          <input
            type="text"
            value={restoreText}
            onChange={(e) => setRestoreText(e.target.value)}
            placeholder="RESTORE"
            className="w-full px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-900 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={() => restoreFromPathname(restoreTarget.pathname)}
              disabled={busy || restoreText !== 'RESTORE'}
              className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              {busy ? 'Restoring...' : 'ยืนยัน Restore'}
            </button>
            <button
              onClick={() => {
                setRestoreTarget(null);
                setRestoreText('');
              }}
              className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm"
            >
              ยกเลิก
            </button>
          </div>
        </section>
      )}

      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-5 space-y-3">
        <h2 className="font-semibold text-gray-900 dark:text-white">Restore จากไฟล์ที่ download ไว้</h2>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-gray-100 file:text-sm dark:file:bg-gray-800 dark:file:text-gray-200"
        />
        <input
          type="text"
          value={restoreText}
          onChange={(e) => setRestoreText(e.target.value)}
          placeholder="พิมพ์ RESTORE เพื่อยืนยัน"
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
        />
        <button
          onClick={restoreFromFile}
          disabled={busy || restoreText !== 'RESTORE'}
          className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
        >
          {busy ? 'Restoring...' : 'Restore จากไฟล์'}
        </button>
      </section>
    </div>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
