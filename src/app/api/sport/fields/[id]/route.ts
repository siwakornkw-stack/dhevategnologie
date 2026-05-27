import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const field = await prisma.field.findFirst({
    where: { id, deletedAt: null },
    include: { priceRules: { orderBy: { startTime: 'asc' } } },
  });
  if (!field) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(field);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  if (body.openTime && body.closeTime && body.openTime === body.closeTime) {
    return NextResponse.json({ error: 'เวลาเปิดต้องไม่เท่ากับเวลาปิด' }, { status: 400 });
  }

  if (body.isActive === false) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activeCount = await prisma.booking.count({
      where: { fieldId: id, status: { in: ['PENDING', 'APPROVED'] }, date: { gte: today } },
    });
    if (activeCount > 0) {
      return NextResponse.json(
        { error: `ไม่สามารถปิดสนามได้ มีการจองในอนาคตที่ยังใช้งานอยู่ ${activeCount} รายการ` },
        { status: 409 },
      );
    }
  }

  const priceRulesInput = Array.isArray(body.priceRules) ? body.priceRules : null;

  const field = await prisma.$transaction(async (tx) => {
    const updated = await tx.field.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        sportType: body.sportType,
        pricePerHour: body.pricePerHour ? Number(body.pricePerHour) : undefined,
        imageUrl: body.imageUrl,
        images: Array.isArray(body.images) ? body.images.filter(Boolean) : undefined,
        location: body.location,
        facilities: body.facilities,
        openTime: body.openTime,
        closeTime: body.closeTime,
        isActive: body.isActive,
        lat: body.lat !== undefined ? (body.lat ? Number(body.lat) : null) : undefined,
        lng: body.lng !== undefined ? (body.lng ? Number(body.lng) : null) : undefined,
      },
    });
    if (priceRulesInput !== null) {
      await tx.fieldPriceRule.deleteMany({ where: { fieldId: id } });
      const validRules = priceRulesInput.filter(
        (r: { startTime?: string; endTime?: string; pricePerHour?: unknown }) =>
          r.startTime && r.endTime && r.startTime !== r.endTime && Number(r.pricePerHour) > 0,
      );
      // Reject overlapping rules — ambiguous pricing otherwise. Compare as
      // minute offsets so "23:00-01:00" overnight wraps consistently.
      const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
      const ranges = validRules.map((r: { startTime: string; endTime: string }) => {
        let s = toMin(r.startTime);
        let e = toMin(r.endTime);
        if (e <= s) e += 1440;
        return [s, e] as const;
      });
      for (let i = 0; i < ranges.length; i++) {
        for (let j = i + 1; j < ranges.length; j++) {
          const [s1, e1] = ranges[i];
          const [s2, e2] = ranges[j];
          if (s1 < e2 && s2 < e1) throw new Error('PRICE_RULE_OVERLAP');
        }
      }
      if (validRules.length > 0) {
        await tx.fieldPriceRule.createMany({
          data: validRules.map((r: { startTime: string; endTime: string; pricePerHour: unknown; label?: string }) => ({
            fieldId: id,
            startTime: r.startTime,
            endTime: r.endTime,
            pricePerHour: Number(r.pricePerHour),
            label: r.label || null,
          })),
        });
      }
    }
    return updated;
  }).catch((err: unknown) => {
    if (err instanceof Error && err.message === 'PRICE_RULE_OVERLAP') return null;
    throw err;
  });
  if (field === null) {
    return NextResponse.json({ error: 'ช่วงเวลาราคาซ้อนทับกัน' }, { status: 400 });
  }

  prisma.auditLog.create({
    data: { adminId: session.user.id, action: 'FIELD_UPDATED', targetId: id, details: { name: field.name } },
  }).catch(() => {});

  return NextResponse.json(field);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const activeCount = await prisma.booking.count({
    where: { fieldId: id, status: { in: ['PENDING', 'APPROVED'] }, date: { gte: today } },
  });
  if (activeCount > 0) {
    return NextResponse.json(
      { error: `ไม่สามารถลบสนามได้ มีการจองในอนาคตที่ยังใช้งานอยู่ ${activeCount} รายการ` },
      { status: 409 },
    );
  }

  await prisma.field.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  prisma.auditLog.create({
    data: { adminId: session.user.id, action: 'FIELD_DELETED', targetId: id },
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
