import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePosRole } from '@/lib/pos';

export async function GET(req: NextRequest) {
  const session = await requirePosRole(['ADMIN']);
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(new Date().setHours(0, 0, 0, 0));
  const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : new Date();
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: 'ช่วงวันที่ไม่ถูกต้อง' }, { status: 400 });
  }
  if (to < from) {
    return NextResponse.json({ error: 'วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น' }, { status: 400 });
  }
  if (to.getTime() - from.getTime() > 366 * 86_400_000) {
    return NextResponse.json({ error: 'ช่วงวันที่ต้องไม่เกิน 366 วัน' }, { status: 400 });
  }

  const invoices = await prisma.posInvoice.findMany({
    where: { paidAt: { gte: from, lte: to } },
    include: { payments: true },
  });

  const paid = invoices.filter((i) => i.status === 'PAID');
  const totalSales = paid.reduce((s, i) => s + i.total, 0);
  const totalProduct = paid.reduce((s, i) => s + i.subtotalProduct, 0);
  const totalBooking = paid.reduce((s, i) => s + i.subtotalBooking, 0);
  const totalDiscount = paid.reduce((s, i) => s + i.discount, 0);
  const totalVat = paid.reduce((s, i) => s + i.vatAmount, 0);
  const totalServiceCharge = paid.reduce((s, i) => s + (i.serviceCharge || 0), 0);
  const totalCost = paid.reduce((s, i) => s + (i.totalCost || 0), 0);
  const grossProfit = totalProduct - totalCost;
  const marginPct = totalProduct > 0 ? (grossProfit / totalProduct) * 100 : 0;
  const voidCount = invoices.filter((i) => i.status === 'VOID').length;

  // Refunds against invoices paid in this range reduce net revenue and per-method cash.
  const paidIds = paid.map((i) => i.id);
  const refunds = paidIds.length
    ? await prisma.posRefund.findMany({ where: { invoiceId: { in: paidIds } } })
    : [];
  const totalRefunds = refunds.reduce((s, r) => s + r.amount, 0);
  const netSales = +(totalSales - totalRefunds).toFixed(2);

  const byMethod: Record<string, number> = {};
  for (const inv of paid) {
    for (const pay of inv.payments) {
      byMethod[pay.method] = (byMethod[pay.method] || 0) + pay.amount;
    }
  }
  for (const r of refunds) {
    byMethod[r.method] = (byMethod[r.method] || 0) - r.amount;
  }

  // Top products
  const productCount: Record<string, { qty: number; revenue: number; name: string }> = {};
  for (const inv of paid) {
    const snap = (inv.itemsSnapshot as Array<{ productId?: string; productName: string; qty: number; unitPrice: number; discount: number }> | null) || [];
    for (const it of snap) {
      const k = it.productId;
      if (!k) continue;
      if (!productCount[k]) productCount[k] = { qty: 0, revenue: 0, name: it.productName };
      productCount[k].qty += it.qty;
      productCount[k].revenue += it.unitPrice * it.qty - it.discount;
    }
  }
  const topProducts = Object.entries(productCount)
    .map(([id, v]) => ({ productId: id, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20);

  // By category — resolve each sold product's current category, then aggregate qty + revenue.
  const prodIds = Object.keys(productCount);
  const prods = prodIds.length
    ? await prisma.posProduct.findMany({ where: { id: { in: prodIds } }, select: { id: true, category: true } })
    : [];
  const catOf = new Map(prods.map((p) => [p.id, p.category || 'ไม่ระบุหมวด']));
  const catAgg: Record<string, { count: number; revenue: number }> = {};
  for (const [id, v] of Object.entries(productCount)) {
    const cat = catOf.get(id) || 'ไม่ระบุหมวด';
    if (!catAgg[cat]) catAgg[cat] = { count: 0, revenue: 0 };
    catAgg[cat].count += v.qty;
    catAgg[cat].revenue += v.revenue;
  }
  const byCategory = Object.entries(catAgg)
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  return NextResponse.json({
    from,
    to,
    totals: {
      invoiceCount: paid.length,
      voidCount,
      totalSales,
      totalRefunds,
      netSales,
      totalProduct,
      totalBooking,
      totalDiscount,
      totalVat,
      totalServiceCharge,
      totalCost,
      grossProfit,
      marginPct,
    },
    byMethod,
    byCategory,
    topProducts,
  });
}
