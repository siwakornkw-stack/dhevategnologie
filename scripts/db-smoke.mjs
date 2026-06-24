// DB smoke test: runs every RAW SQL statement form used in the app against the real database
// inside a rolled-back transaction. Catches the class of failures that tsc + node unit tests
// CANNOT see — e.g. $queryRaw on a void/unsupported column ("Failed to deserialize column of
// type 'void'"), wrong table/column identifiers, or invalid SQL — BEFORE they reach prod.
//
// Run before deploying a change that touches raw SQL:  npm run db:smoke
// Each check mirrors a real call site; when you add a new $queryRaw/$executeRaw/Unsafe in the
// app, add a check here too. Nothing is written: every check runs in a transaction that is
// rolled back, and the mutating one targets a non-existent row (0 rows affected).

import { config } from 'dotenv';
config({ path: '.env.local', override: true }); // .env is a placeholder; real URL is in .env.local
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const ROLLBACK = Symbol('rollback');

// [label, fn(tx)] — fn must exercise the raw statement; it never needs to commit.
const checks = [
  ['advisory lock — src/lib/pos.ts lockSeq (nextInvoiceNo/Shift/Refund)', (tx) =>
    tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'SMOKE-LOCK'}))`],

  ['low-stock SELECT (deserializes columns) — pos/products/low-stock/route.ts', (tx) =>
    tx.$queryRaw`
      SELECT id, name, sku, category, "stockQty", "stockUnit", "lowStockAlert"
      FROM "PosProduct"
      WHERE "deletedAt" IS NULL AND "isActive" = true AND "stockParentId" IS NULL
        AND "lowStockAlert" > 0 AND "stockQty" <= "lowStockAlert"
      ORDER BY ("stockQty"::float / NULLIF("lowStockAlert", 0)) ASC
      LIMIT 1`],

  ['coupon UPDATE (0 rows) — bookings/checkout, pos/checkout, pos/quick-sale', (tx) =>
    tx.$executeRaw`
      UPDATE "Coupon" SET "usedCount" = "usedCount" + 1
      WHERE code = ${'__SMOKE_NONEXISTENT__'} AND "isActive" = true
        AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
        AND ("expiresAt" IS NULL OR "expiresAt" > NOW())`],

  ['invoice row lock — pos/refunds/route.ts FOR UPDATE', (tx) =>
    tx.$queryRaw`SELECT id FROM "PosInvoice" WHERE id = ${'__smoke_nonexistent__'} FOR UPDATE`],
];

let failures = 0;
for (const [label, fn] of checks) {
  try {
    // Each in its own transaction so one failure can't poison the others; always rolled back.
    await prisma.$transaction(async (tx) => { await fn(tx); throw ROLLBACK; });
  } catch (e) {
    if (e === ROLLBACK) { console.log(`  ok   ${label}`); continue; }
    failures++;
    console.error(`  FAIL ${label}\n       ${e.message}`);
  }
}

await prisma.$disconnect();
await pool.end();

if (failures > 0) {
  console.error(`\ndb-smoke: ${failures} check(s) failed`);
  process.exit(1);
}
console.log('\ndb-smoke: all raw-SQL checks passed');
