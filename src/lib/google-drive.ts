import { google } from 'googleapis';
import { Readable } from 'node:stream';

const BACKUP_MIME = 'application/gzip';

function getDriveClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('GOOGLE_OAUTH_* env vars not configured');
  }
  if (!folderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID not configured');

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });

  return { drive: google.drive({ version: 'v3', auth: oauth2 }), folderId };
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
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' },
  );
  return Buffer.from(res.data as ArrayBuffer);
}

export async function deleteBackup(fileId: string): Promise<void> {
  const { drive } = getDriveClient();
  await drive.files.delete({ fileId });
}

export async function cleanupOldBackups(retentionDays: number): Promise<{ deleted: number }> {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return { deleted: 0 };
  const cutoff = Date.now() - retentionDays * 86400_000;
  const files = await listBackups();
  let deleted = 0;
  for (const f of files) {
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
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN &&
    process.env.GOOGLE_DRIVE_FOLDER_ID,
  );
}
