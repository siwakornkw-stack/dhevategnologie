import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { init } = await import('@sentry/nextjs');
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    const isValidDsn = Boolean(dsn && !dsn.includes('your-key') && dsn.startsWith('https://'));
    init({
      dsn: isValidDsn ? dsn : undefined,
      tracesSampleRate: 1.0,
      enabled: process.env.NODE_ENV === 'production' && isValidDsn,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
