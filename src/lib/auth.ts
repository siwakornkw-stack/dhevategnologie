import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { verifySync as totpVerify } from 'otplib';
import { prisma } from '@/lib/prisma';
import { authConfig } from '@/lib/auth.config';
import { z } from 'zod';
import { rateLimit, AUTH_RATE_LIMIT } from '@/lib/rate-limit';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  totpCode: z.string().optional(),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
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

        // Normalize email once: trim + lowercase. Use the same value for the rate-limit key
        // AND the DB lookup so attackers cannot bypass the per-email throttle by varying case
        // or whitespace (zod email validator does not normalize).
        const email = parsed.data.email.trim().toLowerCase();

        const rl = await rateLimit(`login:${email}`, AUTH_RATE_LIMIT);
        if (!rl.success) throw new Error('LOGIN_RATE_LIMITED');

        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, name: true, email: true, image: true, role: true, emailVerified: true, password: true, twoFactorEnabled: true, twoFactorSecret: true },
        });

        if (!user || !user.password) return null;

        const isValid = await bcrypt.compare(parsed.data.password, user.password);
        if (!isValid) return null;

        if (user.twoFactorEnabled && user.twoFactorSecret) {
          if (!parsed.data.totpCode) {
            throw new Error('2FA_REQUIRED');
          }
          // otplib throws on malformed tokens (non-digit / wrong length); treat as invalid.
          let valid = false;
          try {
            valid = totpVerify({ token: parsed.data.totpCode, secret: user.twoFactorSecret }).valid;
          } catch {
            valid = false;
          }
          if (!valid) throw new Error('2FA_INVALID');
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          emailVerified: user.emailVerified,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.emailVerified = (user as { emailVerified?: Date | null }).emailVerified ?? null;
        token.refreshedAt = Date.now();
        token.issuedAt = Date.now();
        return token;
      }
      // Force immediate DB refresh when session is explicitly updated (e.g. after email verification)
      if (trigger === 'update' && token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, emailVerified: true, passwordChangedAt: true },
        });
        if (fresh) {
          token.role = fresh.role;
          token.emailVerified = fresh.emailVerified;
          token.refreshedAt = Date.now();
        }
        return token;
      }
      // Refresh role and emailVerified from DB every 5 min to pick up permission/password changes
      if (token.id && Date.now() - ((token.refreshedAt as number) ?? 0) > 5 * 60 * 1000) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, emailVerified: true, passwordChangedAt: true },
        });
        if (fresh) {
          // Invalidate session if password was changed after this token was issued
          if (fresh.passwordChangedAt && token.issuedAt) {
            if (fresh.passwordChangedAt.getTime() > (token.issuedAt as number)) {
              return null;
            }
          }
          token.role = fresh.role;
          token.emailVerified = fresh.emailVerified;
        }
        token.refreshedAt = Date.now();
      }
      return token;
    },
  },
});
