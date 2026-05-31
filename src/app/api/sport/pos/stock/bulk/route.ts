import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole, getPosSettings } from '@/lib/pos';

type InputRow = { productId?: unknown; counted?: unknown; delta?: unknown };

export async function POST(req: NextRequest) {
  const session = await requirePosRole(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const rawRows: InputRow[] = Array.isArray(body?.rows) ? body.rows : [];
  const note: string | null = body?.note?.toString().slice(0, 500) || null;

  if (rawRows.length === 0) {
    return NextResponse.json({ error: 'rows required' }, { status: 400 });
  }
  if (rawRows.length > 1000) {
    return NextResponse.json({ error: 'too many rows (max 1000)' }, { status: 400 });
  }

  // Validate shape up front so we reject the whole batch before touching the DB.
  type Row = { productId: string; counted: number | null; delta: number | null };
  const rows: Row[] = [];
  const seen = new Set<string>();
  for (const r of rawRows) {
    if (!r.productId || typeof r.productId !== 'string') {
      return NextResponse.json({ error: 'productId required on every row' }, { status: 400 });
    }
    if (seen.has(r.productId)) {
      return NextResponse.json({ error: `duplicate productId: ${r.productId}` }, { status: 400 });
    }
    seen.add(r.productId);

    const hasCounted = r.counted !== undefined && r.counted !== null;
    const hasDelta = r.delta !== undefined && r.delta !== null;
    if (hasCounted === hasDelta) {
      return NextResponse.json({ error: 'each row needs exactly one of counted|delta' }, { status: 400 });
    }

    if (hasCounted) {
      const counted = Number(r.counted);
      if (!Number.isInteger(counted) || counted < 0) {
        return NextResponse.json({ error: 'counted must be a non-negative integer' }, { status: 400 });
      }
      if (counted > 100000) {
        return NextResponse.json({ error: 'counted exceeds maximum (100,000)' }, { status: 400 });
      }
      rows.push({ productId: r.productId, counted, delta: null });
    } else {
      const delta = Number(r.delta);
      if (!Number.isInteger(delta) || delta === 0) {
        return NextResponse.json({ error: 'delta must be a non-zero integer' }, { status: 400 });
      }
      if (Math.abs(delta) > 100000) {
        return NextResponse.json({ error: 'delta exceeds maximum (100,000)' }, { status: 400 });
      }
      rows.push({ productId: r.productId, counted: null, delta });
    }
  }

  const settings = await getPosSettings();
  const allowNegative = settings.allowNegativeStock;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const movements = [];
      for (const row of rows) {
        const product = await tx.posProduct.findUnique({ where: { id: row.productId } });
        if (!product) throw new Error(`PRODUCT_NOT_FOUND:${row.productId}`);

        // For counted rows compute delta against the authoritative stockQty read
        // inside this transaction, not a possibly stale client value.
        const delta = row.delta ?? (row.counted as number) - product.stockQty;
        if (delta === 0) continue;

        if (delta >= 0 || allowNegative) {
          await tx.posProduct.update({
            where: { id: row.productId },
            data: { stockQty: { increment: delta } },
          });
        } else {
          const need = -delta;
          const r = await tx.posProduct.updateMany({
            where: { id: row.productId, stockQty: { gte: need } },
            data: { stockQty: { decrement: need } },
          });
          if (r.count === 0) throw new Error(`STOCK_INSUFFICIENT:${row.productId}`);
        }

        const rowNote =
          row.counted !== null
            ? `${note ? `${note} ` : ''}(was ${product.stockQty} → ${row.counted})`.slice(0, 500)
            : note;
        const mv = await tx.posStockMovement.create({
          data: {
            productId: row.productId,
            type: 'ADJUST',
            qty: delta,
            refType: 'MANUAL',
            note: rowNote,
            userId: session.user.id,
          },
        });
        movements.push(mv);
      }
      return { movements, count: movements.length };
    });

    prisma.auditLog
      .create({
        data: {
          adminId: session.user.id,
          action: 'POS_STOCK_BULK_ADJUST',
          targetId: null,
          details: { count: result.count, note },
        },
      })
      .catch(() => {});
    return NextResponse.json(result, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'bulk adjust failed';
    if (msg.startsWith('STOCK_INSUFFICIENT')) {
      return NextResponse.json({ error: 'สต็อกไม่พอ', code: msg }, { status: 409 });
    }
    if (msg.startsWith('PRODUCT_NOT_FOUND')) {
      return NextResponse.json({ error: 'ไม่พบสินค้า', code: msg }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
