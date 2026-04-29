import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { verifySync as totpVerify } from 'otplib';
import { prisma } from '@/lib/prisma';
import { authConfig } from '@/lib/auth.config';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  totpCode: z.string().optional(),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && !process.env.GOOGLE_CLIENT_ID.startsWith('your')
      ? [Google({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET! })]
      : []),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        totpCode: { label: 'TOTP Code', type: 'text' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          select: { id: true, name: true, email: true, image: true, role: true, password: true, twoFactorEnabled: true, twoFactorSecret: true },
        });

        if (!user || !user.password) return null;

        const isValid = await bcrypt.compare(parsed.data.password, user.password);
        if (!isValid) return null;

        if (user.twoFactorEnabled && user.twoFactorSecret) {
          if (!parsed.data.totpCode) {
            throw new Error('2FA_REQUIRED');
          }
          const valid = totpVerify({ token: parsed.data.totpCode, secret: user.twoFactorSecret });
          if (!valid) throw new Error('2FA_INVALID');
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.emailVerified = (user as { emailVerified?: Date | null }).emailVerified ?? null;
        token.refreshedAt = Date.now();
        return token;
      }
      // Refresh role and emailVerified from DB once per hour to pick up permission changes
      if (token.id && Date.now() - ((token.refreshedAt as number) ?? 0) > 60 * 60 * 1000) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, emailVerified: true },
        });
        if (fresh) {
          token.role = fresh.role;
          token.emailVerified = fresh.emailVerified;
        }
        token.refreshedAt = Date.now();
      }
      return token;
    },
  },
});
