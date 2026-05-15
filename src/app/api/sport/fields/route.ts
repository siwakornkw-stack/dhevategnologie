import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { SportType } from '@prisma/client';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sportParam = searchParams.get('sport');
  const validSports = Object.values(SportType);
  const sport = sportParam && validSports.includes(sportParam as SportType) ? (sportParam as SportType) : null;
  const minPriceRaw = searchParams.get('minPrice');
  const maxPriceRaw = searchParams.get('maxPrice');
  const search = searchParams.get('search');

  const minPrice = minPriceRaw !== null && !isNaN(Number(minPriceRaw)) ? Number(minPriceRaw) : null;
  const maxPrice = maxPriceRaw !== null && !isNaN(Number(maxPriceRaw)) ? Number(maxPriceRaw) : null;

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
      ...(minPrice !== null || maxPrice !== null
        ? {
            pricePerHour: {
              ...(minPrice !== null ? { gte: minPrice } : {}),
              ...(maxPrice !== null ? { lte: maxPrice } : {}),
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
  const { name, description, sportType, pricePerHour, imageUrl, location, facilities, openTime, closeTime, lat, lng, priceRules } = body;

  if (!name || !sportType || !pricePerHour) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const open = openTime || '08:00';
  const close = closeTime || '22:00';
  if (open === close) {
    return NextResponse.json({ error: 'เวลาเปิดต้องไม่เท่ากับเวลาปิด' }, { status: 400 });
  }

  const field = await prisma.field.create({
    data: {
      name, description, sportType, pricePerHour: Number(pricePerHour),
      imageUrl, location, facilities,
      openTime: openTime || '08:00', closeTime: closeTime || '22:00',
      lat: lat ? Number(lat) : null,
      lng: lng ? Number(lng) : null,
      ...(Array.isArray(priceRules) && priceRules.length > 0
        ? {
            priceRules: {
              create: priceRules
                .filter((r: { startTime?: string; endTime?: string; pricePerHour?: unknown }) =>
                  r.startTime && r.endTime && r.startTime !== r.endTime && Number(r.pricePerHour) > 0,
                )
                .map((r: { startTime: string; endTime: string; pricePerHour: unknown; label?: string }) => ({
                  startTime: r.startTime,
                  endTime: r.endTime,
                  pricePerHour: Number(r.pricePerHour),
                  label: r.label || null,
                })),
            },
          }
        : {}),
    },
  });

  prisma.auditLog.create({
    data: { adminId: session.user.id, action: 'FIELD_CREATED', targetId: field.id, details: { name: field.name, sportType: field.sportType } },
  }).catch(() => {});

  return NextResponse.json(field, { status: 201 });
}
