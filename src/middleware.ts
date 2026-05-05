import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ['/sport/bookings/:path*', '/sport/admin/:path*', '/sport/profile/:path*', '/sport/chat/:path*'],
};
