import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const field = await prisma.field.findUnique({ where: { id } });
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

  const field = await prisma.field.update({
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

  await prisma.field.delete({ where: { id } });

  prisma.auditLog.create({
    data: { adminId: session.user.id, action: 'FIELD_DELETED', targetId: id },
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
