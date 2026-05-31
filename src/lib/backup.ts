import { prisma } from '@/lib/prisma';
import { put, list, head, del } from '@vercel/blob';

// Tables in FK dependency order (parents first).
// Restore inserts in this order; delete (truncate) uses reverse order.
const TABLES = [
  'User',
  'Field',
  'Coupon',
  'SystemSetting',
  'PosProduct',
  'PosSettings',
  'VerificationToken',
  'PosTab',
  'Account',
  'Session',
  'Conversation',
  'Message',
  'PushSubscription',
  'Notification',
  'AuditLog',
  'FieldBlockedDate',
  'FieldPriceRule',
  'WaitingList',
  'Review',
  'Booking',
  'PointTransaction',
  'PosStockMovement',
  'PosOrderItem',
  'PosInvoice',
  'PosPayment',
  'PosInvoiceSplit',
] as const;

type TableName = (typeof TABLES)[number];

const SELF_REF: Partial<Record<TableName, string>> = {
  User: 'referredById',
  PosTab: 'parentTabId',
};

const BACKUP_PREFIX = 'db-backups/';
const RETENTION_DAYS = 30;

export type BackupFile = {
  version: 1;
  createdAt: string;
  rowCounts: Record<string, number>;
  data: Record<string, unknown[]>;
};

function delegate(table: TableName) {
  const key = table.charAt(0).toLowerCase() + table.slice(1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma as any)[key];
}

export async function exportAll(): Promise<BackupFile> {
  const data: Record<string, unknown[]> = {};
  const rowCounts: Record<string, number> = {};
  for (const t of TABLES) {
    const rows = await delegate(t).findMany();
    data[t] = rows;
    rowCounts[t] = rows.length;
  }
  return { version: 1, createdAt: new Date().toISOString(), rowCounts, data };
}

export async function createBackup(): Promise<{ url: string; pathname: string; size: number; rowCounts: Record<string, number> }> {
  const dump = await exportAll();
  const json = JSON.stringify(dump);
  const ts = dump.createdAt.replace(/[:.]/g, '-');
  const pathname = `${BACKUP_PREFIX}backup-${ts}.json`;
  const res = await put(pathname, json, {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  await pruneOldBackups();
  return { url: res.url, pathname: res.pathname, size: json.length, rowCounts: dump.rowCounts };
}

export async function listBackups() {
  const { blobs } = await list({ prefix: BACKUP_PREFIX });
  return blobs
    .filter((b) => b.pathname.endsWith('.json'))
    .map((b) => ({ url: b.url, pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt }))
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}

export async function deleteBackup(pathname: string) {
  await del(pathname);
}

async function pruneOldBackups() {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const { blobs } = await list({ prefix: BACKUP_PREFIX });
  const old = blobs.filter((b) => new Date(b.uploadedAt).getTime() < cutoff);
  if (old.length === 0) return;
  await del(old.map((b) => b.url));
}

function blobAuthHeaders(): HeadersInit {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN not set');
  return { authorization: `Bearer ${token}` };
}

export async function fetchBlobResponse(pathname: string): Promise<Response> {
  const meta = await head(pathname);
  const res = await fetch(meta.url, { cache: 'no-store', headers: blobAuthHeaders() });
  if (!res.ok) throw new Error(`Fetch blob failed: ${res.status}`);
  return res;
}

// Same 100 MB cap the multipart upload branch enforces, so a tampered/oversized
// stored blob can't exhaust memory when parsed into a BackupFile.
const MAX_BACKUP_BYTES = 100 * 1024 * 1024;

export async function fetchBackupByPathname(pathname: string): Promise<BackupFile> {
  const meta = await head(pathname);
  if (meta.size > MAX_BACKUP_BYTES) throw new Error('Backup file too large (max 100 MB)');
  const res = await fetch(meta.url, { cache: 'no-store', headers: blobAuthHeaders() });
  if (!res.ok) throw new Error(`Fetch blob failed: ${res.status}`);
  const json = (await res.json()) as BackupFile;
  if (json.version !== 1 || !json.data) throw new Error('Invalid backup file');
  return json;
}

export async function restoreFromBackup(dump: BackupFile): Promise<{ inserted: Record<string, number> }> {
  for (const t of TABLES) {
    if (!Array.isArray(dump.data[t])) throw new Error(`Backup missing table: ${t}`);
  }

  const inserted: Record<string, number> = {};

  // PostgreSQL FK + self-ref strategy:
  // 1. TRUNCATE all tables (CASCADE handles FKs) in single statement.
  // 2. Insert each table in dependency order. For self-ref tables, null the self-FK on first pass.
  // 3. Second pass: update self-FK values.
  // All inside one transaction so failure rolls back.

  const truncateList = [...TABLES].map((t) => `"${t}"`).join(', ');

  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`TRUNCATE TABLE ${truncateList} RESTART IDENTITY CASCADE`);

      for (const t of TABLES) {
        const rows = dump.data[t] as Record<string, unknown>[];
        if (rows.length === 0) {
          inserted[t] = 0;
          continue;
        }
        const selfFk = SELF_REF[t];
        const sanitized = rows.map((r) => {
          const obj: Record<string, unknown> = {};
          for (const k of Object.keys(r)) {
            const v = r[k];
            if (typeof v === 'string' && isIsoDate(v) && isDateField(t, k)) {
              obj[k] = new Date(v);
            } else {
              obj[k] = v;
            }
          }
          if (selfFk) obj[selfFk] = null;
          return obj;
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const model = (tx as any)[t.charAt(0).toLowerCase() + t.slice(1)];
        await model.createMany({ data: sanitized, skipDuplicates: false });
        inserted[t] = sanitized.length;
      }

      // Self-ref fixups
      for (const t of TABLES) {
        const selfFk = SELF_REF[t];
        if (!selfFk) continue;
        const rows = dump.data[t] as Record<string, unknown>[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const model = (tx as any)[t.charAt(0).toLowerCase() + t.slice(1)];
        for (const r of rows) {
          const fkVal = r[selfFk];
          if (fkVal == null) continue;
          await model.update({ where: { id: r.id }, data: { [selfFk]: fkVal } });
        }
      }
    },
    { maxWait: 10_000, timeout: 5 * 60_000 },
  );

  return { inserted };
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
function isIsoDate(v: string) {
  return ISO_RE.test(v);
}

// Conservative: convert any field whose name ends in "At" or equals "date"/"expires"/"emailVerified"/"paidAt"/"openedAt"/"closedAt"/"voidedAt"/"reminderSentAt"/"passwordChangedAt"/"lastMessageAt"/"expiresAt"/"deletedAt"/"updatedAt"/"createdAt"
const DATE_FIELD_RE = /(At|date|expires|emailVerified)$/;
function isDateField(_t: string, key: string) {
  return DATE_FIELD_RE.test(key) || key === 'date' || key === 'expires' || key === 'emailVerified';
}
