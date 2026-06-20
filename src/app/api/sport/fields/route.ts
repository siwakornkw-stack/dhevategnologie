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
      deletedAt: null,
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

  const nameTrim = typeof name === 'string' ? name.trim() : '';
  const sportTypeTrim = typeof sportType === 'string' ? sportType.trim() : '';
  const locationTrim = typeof location === 'string' ? location.trim() : location;
  const descriptionTrim = typeof description === 'string' ? description.trim() : description;
  const priceNum = Number(pricePerHour);

  if (!nameTrim || !sportTypeTrim) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (!Object.values(SportType).includes(sportTypeTrim as SportType)) {
    return NextResponse.json({ error: 'ประเภทกีฬาไม่ถูกต้อง' }, { status: 400 });
  }
  if (!Number.isFinite(priceNum) || priceNum <= 0) {
    return NextResponse.json({ error: 'ราคาต่อชั่วโมงไม่ถูกต้อง' }, { status: 400 });
  }

  const open = openTime || '08:00';
  const close = closeTime || '22:00';
  if (open === close) {
    return NextResponse.json({ error: 'เวลาเปิดต้องไม่เท่ากับเวลาปิด' }, { status: 400 });
  }

  const validRules = Array.isArray(priceRules)
    ? priceRules.filter(
        (r: { startTime?: string; endTime?: string; pricePerHour?: unknown }) =>
          r.startTime && r.endTime && r.startTime !== r.endTime && Number(r.pricePerHour) > 0,
      )
    : [];
  // Reject overlapping rules — ambiguous pricing otherwise (matches PUT behavior).
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const ranges = validRules.map((r: { startTime: string; endTime: string }) => {
    const s = toMin(r.startTime);
    let e = toMin(r.endTime);
    if (e <= s) e += 1440;
    return [s, e] as const;
  });
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const [s1, e1] = ranges[i];
      const [s2, e2] = ranges[j];
      if (s1 < e2 && s2 < e1) {
        return NextResponse.json({ error: 'ช่วงเวลาราคาซ้อนทับกัน' }, { status: 400 });
      }
    }
  }

  const field = await prisma.field.create({
    data: {
      name: nameTrim, description: descriptionTrim, sportType: sportTypeTrim as SportType, pricePerHour: priceNum,
      imageUrl, location: locationTrim, facilities,
      openTime: openTime || '08:00', closeTime: closeTime || '22:00',
      lat: lat ? Number(lat) : null,
      lng: lng ? Number(lng) : null,
      ...(validRules.length > 0
        ? {
            priceRules: {
              create: validRules
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
