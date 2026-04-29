import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { SportType } from '@prisma/client';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sport = searchParams.get('sport') as SportType | null;
  const minPrice = searchParams.get('minPrice');
  const maxPrice = searchParams.get('maxPrice');
  const search = searchParams.get('search');

  const fields = await prisma.field.findMany({
    where: {
      isActive: true,
      ...(sport && { sportType: sport }),
      ...(search && {
        OR: [
          { name: { contains: search } },
          { location: { contains: search } },
        ],
      }),
      ...(minPrice || maxPrice
        ? {
            pricePerHour: {
              ...(minPrice ? { gte: Number(minPrice) } : {}),
              ...(maxPrice ? { lte: Number(maxPrice) } : {}),
            },
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(fields);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { name, description, sportType, pricePerHour, imageUrl, location, facilities, openTime, closeTime, lat, lng } = body;

  if (!name || !sportType || !pricePerHour) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const open = openTime || '08:00';
  const close = closeTime || '22:00';
  if (open >= close) {
    return NextResponse.json({ error: 'เวลาเปิดต้องน้อยกว่าเวลาปิด' }, { status: 400 });
  }

  const field = await prisma.field.create({
    data: {
      name, description, sportType, pricePerHour: Number(pricePerHour),
      imageUrl, location, facilities,
      openTime: openTime || '08:00', closeTime: closeTime || '22:00',
      lat: lat ? Number(lat) : null,
      lng: lng ? Number(lng) : null,
    },
  });

  return NextResponse.json(field, { status: 201 });
}
