import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  if (!token) {
    return <VerifyResult error="ลิงก์ไม่ถูกต้อง" />;
  }

  const record = await prisma.verificationToken.findFirst({
    where: { token, identifier: { not: { startsWith: 'reset:' } } },
  });

  if (!record) {
    return <VerifyResult error="ลิงก์ยืนยันไม่ถูกต้องหรือใช้งานแล้ว" />;
  }

  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier: record.identifier, token } },
    });
    return <VerifyResult error="ลิงก์หมดอายุแล้ว กรุณาขอลิงก์ใหม่" expired />;
  }

  await Promise.all([
    prisma.user.update({ where: { email: record.identifier }, data: { emailVerified: new Date() } }),
    prisma.verificationToken.delete({
      where: { identifier_token: { identifier: record.identifier, token } },
    }),
  ]);

  redirect('/sport/auth/email-verified');
}

function VerifyResult({ error, expired }: { error: string; expired?: boolean }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <a href="/sport" className="text-4xl">🏟️</a>
        <div className="mt-6 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-700/50 shadow-theme-sm p-8 space-y-4">
          <div className="text-5xl">❌</div>
          <p className="text-gray-900 dark:text-white font-semibold">{error}</p>
          {expired && (
            <a
              href="/sport/auth/resend-verification"
              className="inline-block w-full gradient-btn text-white font-semibold h-12 rounded-full text-sm leading-[3rem]"
            >
              ขอลิงก์ยืนยันใหม่
            </a>
          )}
          <a href="/sport" className="block text-sm text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition">
            กลับหน้าหลัก
          </a>
        </div>
      </div>
    </div>
  );
}
