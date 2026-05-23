'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type DriveBackupFile = { id: string; name: string; size: number; createdTime: string };

type Props = {
  initialFiles: DriveBackupFile[];
  configured: boolean;
  listError: string | null;
};

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
function fmtDate(s: string) {
  return new Date(s).toLocaleString('th-TH');
}

export function BackupClient({ initialFiles, configured, listError }: Props) {
  const router = useRouter();
  const [files, setFiles] = useState<DriveBackupFile[]>(initialFiles);
  const [busy, setBusy] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<DriveBackupFile | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function refresh() {
    const r = await fetch('/api/admin/backup');
    const data = await r.json();
    if (Array.isArray(data.files)) setFiles(data.files);
  }

  async function createNow() {
    setBusy('create');
    setMessage(null);
    try {
      const r = await fetch('/api/admin/backup', { method: 'POST' });
      const data = await r.json();
      if (!r.ok) {
        setMessage({ kind: 'err', text: data.error || 'backup failed' });
      } else {
        setMessage({ kind: 'ok', text: `สร้าง backup สำเร็จ: ${data.file.name}` });
        await refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  function startDownload(f: DriveBackupFile) {
    window.location.href = `/api/admin/backup/${f.id}`;
  }

  async function remove(f: DriveBackupFile) {
    if (!confirm(`ลบ backup "${f.name}"?`)) return;
    setBusy(f.id);
    try {
      const r = await fetch(`/api/admin/backup/${f.id}`, { method: 'DELETE' });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setMessage({ kind: 'err', text: d.error || 'ลบไม่สำเร็จ' });
      } else {
        setMessage({ kind: 'ok', text: 'ลบแล้ว' });
        setFiles((fs) => fs.filter((x) => x.id !== f.id));
      }
    } finally {
      setBusy(null);
    }
  }

  async function doRestore() {
    if (!restoring) return;
    if (confirmText !== 'RESTORE') return;
    setBusy('restore');
    setMessage(null);
    try {
      const r = await fetch('/api/admin/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId: restoring.id, confirm: 'RESTORE' }),
      });
      const data = await r.json();
      if (!r.ok) {
        setMessage({ kind: 'err', text: data.error || 'restore failed' });
      } else {
        setMessage({
          kind: 'ok',
          text: `Restore สำเร็จ. Pre-restore snapshot: ${data.preRestoreFileId ?? '-'} (ใช้ย้อนกลับได้ถ้าผิดพลาด)`,
        });
        setRestoring(null);
        setConfirmText('');
        await refresh();
        setTimeout(() => router.refresh(), 500);
      }
    } finally {
      setBusy(null);
    }
  }

  if (!configured) {
    return (
      <div className="p-6 border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-xl space-y-2">
        <div className="font-semibold">Backup ยังไม่ได้ตั้งค่า</div>
        <div className="text-sm">ตั้ง environment variables ใน Vercel:</div>
        <ul className="text-xs list-disc ml-6 font-mono">
          <li>GOOGLE_OAUTH_CLIENT_ID</li>
          <li>GOOGLE_OAUTH_CLIENT_SECRET</li>
          <li>GOOGLE_OAUTH_REFRESH_TOKEN</li>
          <li>GOOGLE_DRIVE_FOLDER_ID</li>
          <li>CRON_SECRET (ถ้ายังไม่มี)</li>
          <li>BACKUP_RETENTION_DAYS (option, default 30)</li>
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.kind === 'ok' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300'}`}>
          {message.text}
        </div>
      )}
      {listError && (
        <div className="p-3 rounded-lg bg-red-50 text-red-800 text-sm">List error: {listError}</div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={createNow}
          disabled={busy !== null}
          className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium disabled:opacity-50"
        >
          {busy === 'create' ? 'กำลังสร้าง...' : '+ สร้าง backup ตอนนี้'}
        </button>
        <button
          onClick={refresh}
          disabled={busy !== null}
          className="px-3 py-2 rounded-lg border dark:border-gray-700 text-sm"
        >
          ↻ รีเฟรช
        </button>
        <div className="text-xs text-gray-500 ml-auto">
          Auto backup: ทุกวัน 03:00 (เวลาไทย)
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border dark:border-gray-700/50 divide-y dark:divide-gray-800">
        <div className="p-3 grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500">
          <div className="col-span-5">ชื่อไฟล์</div>
          <div className="col-span-2 text-right">ขนาด</div>
          <div className="col-span-3">สร้างเมื่อ</div>
          <div className="col-span-2 text-right">การจัดการ</div>
        </div>
        {files.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">ยังไม่มี backup</div>
        ) : (
          files.map((f) => {
            const isPreRestore = f.name.startsWith('pre-restore-');
            return (
              <div key={f.id} className="p-3 grid grid-cols-12 gap-2 items-center text-sm">
                <div className="col-span-5 font-mono text-xs break-all">
                  {isPreRestore && <span className="text-amber-600 mr-1">⏮</span>}
                  {f.name}
                </div>
                <div className="col-span-2 text-right text-gray-500">{fmtBytes(f.size)}</div>
                <div className="col-span-3 text-xs text-gray-500">{fmtDate(f.createdTime)}</div>
                <div className="col-span-2 flex gap-1 justify-end">
                  <button
                    onClick={() => startDownload(f)}
                    className="px-2 py-1 text-xs rounded border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                    title="ดาวน์โหลด"
                  >
                    ⬇
                  </button>
                  <button
                    onClick={() => { setRestoring(f); setConfirmText(''); setMessage(null); }}
                    disabled={busy !== null}
                    className="px-2 py-1 text-xs rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                    title="นำเข้า backup (restore)"
                  >
                    ↻
                  </button>
                  <button
                    onClick={() => remove(f)}
                    disabled={busy !== null}
                    className="px-2 py-1 text-xs rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                    title="ลบ"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {restoring && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => !busy && setRestoring(null)}>
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-lg w-full space-y-4 border-2 border-red-500"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div className="text-lg font-bold text-red-600">นำเข้า Backup (Restore)</div>
              <div className="text-xs text-gray-500 mt-1">การกระทำนี้จะแทนที่ข้อมูลทั้งหมดด้วยข้อมูลใน backup</div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg text-xs space-y-1">
              <div><span className="text-gray-500">ไฟล์:</span> <span className="font-mono">{restoring.name}</span></div>
              <div><span className="text-gray-500">ขนาด:</span> {fmtBytes(restoring.size)}</div>
              <div><span className="text-gray-500">สร้างเมื่อ:</span> {fmtDate(restoring.createdTime)}</div>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-lg text-xs space-y-1">
              <div className="font-semibold text-emerald-800 dark:text-emerald-300">Safety guarantees</div>
              <ul className="list-disc ml-5 text-emerald-700 dark:text-emerald-400">
                <li>ระบบจะ snapshot ข้อมูลปัจจุบันก่อน (pre-restore-*)</li>
                <li>Restore ทำใน transaction — fail = rollback ทั้งหมด</li>
                <li>ถ้าผิดใจ ใช้ pre-restore snapshot ย้อนกลับได้</li>
              </ul>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">
                พิมพ์ <span className="font-mono font-bold text-red-600">RESTORE</span> เพื่อยืนยัน:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="RESTORE"
                className="w-full px-3 py-2 rounded-lg border-2 border-red-300 dark:border-red-800 bg-white dark:bg-gray-800 font-mono"
                autoFocus
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setRestoring(null); setConfirmText(''); }}
                disabled={busy === 'restore'}
                className="px-4 py-2 text-sm border dark:border-gray-700 rounded-lg"
              >
                ยกเลิก
              </button>
              <button
                onClick={doRestore}
                disabled={confirmText !== 'RESTORE' || busy === 'restore'}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy === 'restore' ? 'กำลัง restore...' : 'ยืนยัน Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
