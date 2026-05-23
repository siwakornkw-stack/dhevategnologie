import { google } from 'googleapis';
import { Readable } from 'node:stream';

const BACKUP_MIME = 'application/gzip';

function getDriveClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured');
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID not configured');

  let credentials: { client_email: string; private_key: string };
  try {
    credentials = JSON.parse(raw);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON');
  }
  if (!credentials.client_email || !credentials.private_key) {
    throw new Error('Service account JSON missing client_email or private_key');
  }
  // Handle escaped newlines from env var
  credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  return { drive: google.drive({ version: 'v3', auth }), folderId };
}

export type DriveBackupFile = {
  id: string;
  name: string;
  size: number;
  createdTime: string;
};

export async function uploadBackup(buffer: Buffer, filename: string): Promise<DriveBackupFile> {
  const { drive, folderId } = getDriveClient();
  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
      mimeType: BACKUP_MIME,
    },
    media: {
      mimeType: BACKUP_MIME,
      body: Readable.from(buffer),
    },
    fields: 'id, name, size, createdTime',
    supportsAllDrives: true,
  });
  return {
    id: res.data.id!,
    name: res.data.name!,
    size: Number(res.data.size ?? buffer.length),
    createdTime: res.data.createdTime!,
  };
}

export async function listBackups(): Promise<DriveBackupFile[]> {
  const { drive, folderId } = getDriveClient();
  const all: DriveBackupFile[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'nextPageToken, files(id, name, size, createdTime)',
      orderBy: 'createdTime desc',
      pageSize: 200,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of res.data.files ?? []) {
      all.push({
        id: f.id!,
        name: f.name!,
        size: Number(f.size ?? 0),
        createdTime: f.createdTime!,
      });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return all;
}

export async function downloadBackup(fileId: string): Promise<Buffer> {
  const { drive } = getDriveClient();
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' },
  );
  return Buffer.from(res.data as ArrayBuffer);
}

export async function deleteBackup(fileId: string): Promise<void> {
  const { drive } = getDriveClient();
  await drive.files.delete({ fileId, supportsAllDrives: true });
}

export async function cleanupOldBackups(retentionDays: number): Promise<{ deleted: number }> {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return { deleted: 0 };
  const cutoff = Date.now() - retentionDays * 86400_000;
  const files = await listBackups();
  let deleted = 0;
  for (const f of files) {
    // Never delete pre-restore safety snapshots
    if (f.name.startsWith('pre-restore-')) continue;
    if (new Date(f.createdTime).getTime() < cutoff) {
      try {
        await deleteBackup(f.id);
        deleted++;
      } catch {
        // ignore single-file failures
      }
    }
  }
  return { deleted };
}

export function isBackupConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.GOOGLE_DRIVE_FOLDER_ID);
}
