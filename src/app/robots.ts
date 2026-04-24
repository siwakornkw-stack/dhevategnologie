import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://88arena.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/sport', '/sport/fields'],
        disallow: ['/api/', '/sport/admin', '/sport/profile', '/sport/bookings'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
