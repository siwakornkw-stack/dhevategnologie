import { prisma } from './prisma';

export async function getSetting(key: string, defaultValue = ''): Promise<string> {
  const s = await prisma.systemSetting.findUnique({ where: { key } });
  return s?.value ?? defaultValue;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function isCouponSystemEnabled(): Promise<boolean> {
  const val = await getSetting('couponSystemEnabled', 'true');
  return val === 'true';
}
