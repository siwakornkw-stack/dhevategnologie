import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole, getPosSettings } from '@/lib/pos';

export async function GET() {
  const session = await requirePosRole(['ADMIN', 'CASHIER']);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const settings = await getPosSettings();
  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  const session = await requirePosRole(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.shopName !== undefined) data.shopName = String(body.shopName).trim() || '88ARENA';
  if (body.taxId !== undefined) data.taxId = body.taxId?.trim() || null;
  if (body.address !== undefined) data.address = body.address?.trim() || null;
  if (body.vatMode !== undefined) {
    if (!['NONE', 'INCLUDED', 'EXCLUDED'].includes(body.vatMode)) {
      return NextResponse.json({ error: 'vatMode invalid' }, { status: 400 });
    }
    data.vatMode = body.vatMode;
  }
  if (body.vatRate !== undefined) {
    const n = Number(body.vatRate);
    if (!Number.isFinite(n) || n < 0 || n > 100) return NextResponse.json({ error: 'vatRate invalid' }, { status: 400 });
    data.vatRate = n;
  }
  if (body.allowNegativeStock !== undefined) data.allowNegativeStock = !!body.allowNegativeStock;
  if (body.printerType !== undefined) {
    if (!['BROWSER', 'ESCPOS'].includes(body.printerType)) {
      return NextResponse.json({ error: 'printerType invalid' }, { status: 400 });
    }
    data.printerType = body.printerType;
  }
  if (body.paperSize !== undefined) data.paperSize = String(body.paperSize);
  if (body.receiptHeader !== undefined) data.receiptHeader = body.receiptHeader?.toString().slice(0, 500) || null;
  if (body.receiptFooter !== undefined) data.receiptFooter = body.receiptFooter?.toString().slice(0, 500) || null;
  if (body.cashDrawerEnabled !== undefined) data.cashDrawerEnabled = !!body.cashDrawerEnabled;

  await getPosSettings();
  const updated = await prisma.posSettings.update({ where: { id: 'default' }, data });
  prisma.auditLog
    .create({ data: { adminId: session.user.id, action: 'POS_SETTINGS_UPDATE', details: data as object } })
    .catch(() => {});
  return NextResponse.json(updated);
}
