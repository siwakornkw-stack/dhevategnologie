import { gzipSync, gunzipSync } from 'node:zlib';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export const BACKUP_VERSION = 1;

type ModelDef = {
  name: string;
  delegate: keyof typeof prisma;
  selfFk?: string[];
};

// Order: insert direction (parents first). Reverse for delete.
const MODELS: ModelDef[] = [
  { name: 'SystemSetting', delegate: 'systemSetting' },
  { name: 'VerificationToken', delegate: 'verificationToken' },
  { name: 'PosSettings', delegate: 'posSettings' },
  { name: 'User', delegate: 'user', selfFk: ['referredById'] },
  { name: 'Account', delegate: 'account' },
  { name: 'Session', delegate: 'session' },
  { name: 'PushSubscription', delegate: 'pushSubscription' },
  { name: 'Notification', delegate: 'notification' },
  { name: 'Conversation', delegate: 'conversation' },
  { name: 'Message', delegate: 'message' },
  { name: 'Field', delegate: 'field' },
  { name: 'FieldBlockedDate', delegate: 'fieldBlockedDate' },
  { name: 'FieldPriceRule', delegate: 'fieldPriceRule' },
  { name: 'Coupon', delegate: 'coupon' },
  { name: 'Booking', delegate: 'booking' },
  { name: 'PointTransaction', delegate: 'pointTransaction' },
  { name: 'WaitingList', delegate: 'waitingList' },
  { name: 'Review', delegate: 'review' },
  { name: 'AuditLog', delegate: 'auditLog' },
  { name: 'AiChatSession', delegate: 'aiChatSession' },
  { name: 'AiChatMessage', delegate: 'aiChatMessage' },
  { name: 'PosProduct', delegate: 'posProduct' },
  { name: 'PosStockMovement', delegate: 'posStockMovement' },
  { name: 'PosTab', delegate: 'posTab', selfFk: ['parentTabId'] },
  { name: 'PosOrderItem', delegate: 'posOrderItem' },
  { name: 'PosInvoice', delegate: 'posInvoice' },
  { name: 'PosPayment', delegate: 'posPayment' },
  { name: 'PosInvoiceSplit', delegate: 'posInvoiceSplit' },
];

export type BackupFile = {
  version: number;
  createdAt: string;
  models: Record<string, Record<string, unknown>[]>;
  counts: Record<string, number>;
};

function getDelegate(name: keyof typeof prisma) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma as any)[name];
}

export async function dumpDatabase(): Promise<{ buffer: Buffer; counts: Record<string, number>; sizeBytes: number }> {
  const models: Record<string, Record<string, unknown>[]> = {};
  const counts: Record<string, number> = {};
  for (const m of MODELS) {
    const rows = await getDelegate(m.delegate).findMany();
    models[m.name] = rows;
    counts[m.name] = rows.length;
  }
  const payload: BackupFile = {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    models,
    counts,
  };
  const json = JSON.stringify(payload);
  const buffer = gzipSync(Buffer.from(json, 'utf8'));
  return { buffer, counts, sizeBytes: buffer.length };
}

export function parseBackup(buffer: Buffer): BackupFile {
  const raw = gunzipSync(buffer).toString('utf8');
  const parsed = JSON.parse(raw) as BackupFile;
  if (typeof parsed.version !== 'number') throw new Error('Invalid backup: missing version');
  if (parsed.version !== BACKUP_VERSION) {
    throw new Error(`Backup version mismatch: file=${parsed.version} expected=${BACKUP_VERSION}`);
  }
  if (!parsed.models || typeof parsed.models !== 'object') throw new Error('Invalid backup: missing models');
  for (const m of MODELS) {
    if (!(m.name in parsed.models)) throw new Error(`Backup missing model: ${m.name}`);
    if (!Array.isArray(parsed.models[m.name])) throw new Error(`Backup model not array: ${m.name}`);
  }
  return parsed;
}

// Re-hydrate Date strings → Date objects.
function reviveDates(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) {
        const d = new Date(v);
        out[k] = isNaN(d.getTime()) ? v : d;
      } else {
        out[k] = v;
      }
    }
    return out;
  });
}

export async function restoreDatabase(parsed: BackupFile): Promise<{ inserted: Record<string, number> }> {
  const inserted: Record<string, number> = {};
  await prisma.$transaction(
    async (tx) => {
      // Phase 1: delete in reverse order
      for (let i = MODELS.length - 1; i >= 0; i--) {
        const m = MODELS[i];
        if (m.selfFk && m.selfFk.length > 0) {
          // Null out self-FK first to allow deletion ordering
          const update: Record<string, null> = {};
          for (const fk of m.selfFk) update[fk] = null;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (tx as any)[m.delegate].updateMany({ data: update });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (tx as any)[m.delegate].deleteMany({});
      }

      // Phase 2: insert in forward order
      for (const m of MODELS) {
        const rows = reviveDates(parsed.models[m.name] || []);
        if (rows.length === 0) {
          inserted[m.name] = 0;
          continue;
        }

        // For self-FK models, insert with null first, then UPDATE pass
        const pending: { id: unknown; fkValues: Record<string, unknown> }[] = [];
        const toInsert = rows.map((row) => {
          if (m.selfFk && m.selfFk.length > 0) {
            const fkValues: Record<string, unknown> = {};
            const cleaned = { ...row };
            for (const fk of m.selfFk) {
              fkValues[fk] = row[fk] ?? null;
              cleaned[fk] = null;
            }
            pending.push({ id: row.id, fkValues });
            return cleaned;
          }
          return row;
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (tx as any)[m.delegate].createMany({
          data: toInsert,
          skipDuplicates: false,
        });
        inserted[m.name] = result.count;

        // Backfill self-FKs
        if (m.selfFk && m.selfFk.length > 0 && pending.length > 0) {
          for (const p of pending) {
            const hasValue = Object.values(p.fkValues).some((v) => v !== null);
            if (!hasValue) continue;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (tx as any)[m.delegate].update({
              where: { id: p.id },
              data: p.fkValues,
            });
          }
        }
      }
    },
    { timeout: 5 * 60 * 1000, maxWait: 10_000, isolationLevel: 'Serializable' as Prisma.TransactionIsolationLevel },
  );
  return { inserted };
}

export function getModelNames(): string[] {
  return MODELS.map((m) => m.name);
}
