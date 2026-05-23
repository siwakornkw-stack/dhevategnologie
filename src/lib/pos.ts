import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type AllowedRole = 'ADMIN' | 'CASHIER';

export async function requirePosRole(roles: AllowedRole[] = ['ADMIN', 'CASHIER']) {
  const session = await auth();
  if (!session?.user) return null;
  const role = session.user.role as AllowedRole | 'USER' | undefined;
  if (!role || !roles.includes(role as AllowedRole)) return null;
  return session;
}

export async function getPosSettings() {
  let settings = await prisma.posSettings.findUnique({ where: { id: 'default' } });
  if (!settings) {
    settings = await prisma.posSettings.create({ data: { id: 'default' } });
  }
  return settings;
}

export type VatBreakdown = {
  subtotal: number;
  vatAmount: number;
  total: number;
  vatMode: 'NONE' | 'INCLUDED' | 'EXCLUDED';
  vatRate: number;
};

export async function nextInvoiceNo() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const prefix = `INV-${y}${m}${d}-`;
  const last = await prisma.posInvoice.findFirst({
    where: { invoiceNo: { startsWith: prefix } },
    orderBy: { invoiceNo: 'desc' },
    select: { invoiceNo: true },
  });
  const seq = last ? Number(last.invoiceNo.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

export function calcVat(
  itemsTotal: number,
  vatMode: 'NONE' | 'INCLUDED' | 'EXCLUDED',
  vatRate: number,
): VatBreakdown {
  const rate = vatRate / 100;
  if (vatMode === 'NONE') {
    return { subtotal: itemsTotal, vatAmount: 0, total: itemsTotal, vatMode, vatRate };
  }
  if (vatMode === 'INCLUDED') {
    const vatAmount = +(itemsTotal * rate / (1 + rate)).toFixed(2);
    return { subtotal: +(itemsTotal - vatAmount).toFixed(2), vatAmount, total: itemsTotal, vatMode, vatRate };
  }
  const vatAmount = +(itemsTotal * rate).toFixed(2);
  return { subtotal: itemsTotal, vatAmount, total: +(itemsTotal + vatAmount).toFixed(2), vatMode, vatRate };
}
