import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🌱 Seeding database...');

  // ลบ seed fields เก่าที่ใช้ภาษาไทยเป็น ID
  await prisma.field.deleteMany({
    where: { id: { startsWith: 'seed-field-' } },
  });

  const adminPassword = await bcrypt.hash('admin1234', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@dhevategnologie.com' },
    update: {},
    create: { name: 'Admin Dhevategnologie', email: 'admin@dhevategnologie.com', password: adminPassword, role: 'ADMIN' },
  });
  console.log('✅ Admin:', admin.email);

  const userPassword = await bcrypt.hash('user1234', 12);
  const user = await prisma.user.upsert({
    where: { email: 'user@dhevategnologie.com' },
    update: {},
    create: { name: 'สมชาย ใจดี', email: 'user@dhevategnologie.com', password: userPassword, role: 'USER' },
  });
  console.log('✅ User:', user.email);

  const fields = [
    { id: 'field-001', name: 'สนามฟุตบอล A', sportType: 'FOOTBALL' as const, pricePerHour: 300, location: 'ถนนสุขุมวิท กรุงเทพฯ', openTime: '08:00', closeTime: '22:00', facilities: 'ที่จอดรถ, ห้องน้ำ, ตู้น้ำ, แสงสว่าง' },
    { id: 'field-002', name: 'สนามบาสเกตบอล Pro', sportType: 'BASKETBALL' as const, pricePerHour: 250, location: 'ถนนรัชดาภิเษก กรุงเทพฯ', openTime: '07:00', closeTime: '21:00', facilities: 'ที่จอดรถ, ห้องอาบน้ำ' },
    { id: 'field-003', name: 'สนามแบดมินตัน Premium', sportType: 'BADMINTON' as const, pricePerHour: 150, location: 'ลาดพร้าว กรุงเทพฯ', openTime: '06:00', closeTime: '22:00', facilities: 'ห้องน้ำ, เครื่องดื่ม, ล็อกเกอร์' },
    { id: 'field-004', name: 'สนามเทนนิส Central', sportType: 'TENNIS' as const, pricePerHour: 400, location: 'พระโขนง กรุงเทพฯ', openTime: '08:00', closeTime: '20:00', facilities: 'ที่จอดรถ, ห้องน้ำ, ร้านอาหาร' },
    { id: 'field-005', name: 'สนามวอลเลย์บอล Beach Style', sportType: 'VOLLEYBALL' as const, pricePerHour: 200, location: 'บางนา กรุงเทพฯ', openTime: '09:00', closeTime: '21:00', facilities: 'ห้องน้ำ, ตู้น้ำ' },
    { id: 'field-006', name: 'สระว่ายน้ำ Olympic', sportType: 'SWIMMING' as const, pricePerHour: 500, location: 'สีลม กรุงเทพฯ', openTime: '06:00', closeTime: '20:00', facilities: 'ที่จอดรถ, ห้องอาบน้ำ, ล็อกเกอร์, ร้านอาหาร' },
    { id: 'field-007', name: 'สนามฟุตบอล B (Mini)', sportType: 'FOOTBALL' as const, pricePerHour: 200, location: 'มีนบุรี กรุงเทพฯ', openTime: '08:00', closeTime: '22:00', facilities: 'ที่จอดรถ, ห้องน้ำ' },
    { id: 'field-008', name: 'สนามแบดมินตัน City', sportType: 'BADMINTON' as const, pricePerHour: 120, location: 'อ่อนนุช กรุงเทพฯ', openTime: '07:00', closeTime: '22:00', facilities: 'ห้องน้ำ, เครื่องดื่ม' },
  ];

  for (const field of fields) {
    await prisma.field.upsert({
      where: { id: field.id },
      update: { name: field.name, sportType: field.sportType, pricePerHour: field.pricePerHour, location: field.location, openTime: field.openTime, closeTime: field.closeTime, facilities: field.facilities },
      create: field,
    });
  }
  console.log(`✅ Created ${fields.length} fields`);

  console.log('\n🎉 Seed complete!');
  console.log('📧 Admin: admin@dhevategnologie.com / admin1234');
  console.log('📧 User:  user@dhevategnologie.com  / user1234');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
