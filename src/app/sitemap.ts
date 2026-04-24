import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://88arena.vercel.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fields = await prisma.field.findMany({
    where: { isActive: true },
    select: { id: true, updatedAt: true },
  });

  const fieldUrls: MetadataRoute.Sitemap = fields.map((f) => ({
    url: `${BASE_URL}/sport/fields/${f.id}`,
    lastModified: f.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [
    { url: `${BASE_URL}/sport`, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/sport/auth/signin`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/sport/auth/signup`, changeFrequency: 'monthly', priority: 0.5 },
    ...fieldUrls,
  ];
}
