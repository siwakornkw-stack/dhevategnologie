import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isCloudinaryEnabled, uploadToCloudinary } from '@/lib/cloudinary';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { rateLimit, UPLOAD_RATE_LIMIT } from '@/lib/rate-limit';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const rl = await rateLimit(`upload:${ip}`, UPLOAD_RATE_LIMIT);
  if (!rl.success) return NextResponse.json({ error: 'คุณอัปโหลดมากเกินไป' }, { status: 429 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'รองรับเฉพาะไฟล์รูปภาพ (jpg, png, webp, gif)' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'ไฟล์ต้องมีขนาดไม่เกิน 5MB' }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = file.name.split('.').pop() ?? 'jpg';
  const prefix = session.user.role === 'ADMIN' ? 'field' : 'profile';
  const baseName = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  if (isCloudinaryEnabled()) {
    try {
      const url = await uploadToCloudinary(buffer, baseName);
      return NextResponse.json({ url });
    } catch {
      return NextResponse.json({ error: 'อัปโหลดรูปภาพไม่สำเร็จ' }, { status: 500 });
    }
  }

  // Fallback: local filesystem (dev only) — ephemeral on Vercel, block in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'กรุณาตั้งค่า Cloudinary ก่อนอัปโหลดรูปภาพ' }, { status: 500 });
  }
  const filename = `${baseName}.${ext}`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), buffer);
  return NextResponse.json({ url: `/uploads/${filename}` });
}
