import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from 'next-themes';
import { Onest } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import { ToasterProvider } from './providers/toaster';
import { PWARegister } from '@/components/pwa-register';
import { RouteLoadingOverlay } from '@/components/route-loading-overlay';
import { Suspense } from 'react';

const onest = Onest({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  title: {
    default: 'DhevaSuite - จองสนามกีฬา',
    template: '%s | DhevaSuite',
  },
  description: 'ระบบจองสนามกีฬาออนไลน์ ง่าย สะดวก รวดเร็ว',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'DhevaSuite',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#6366f1',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="DhevaSuite" />
      </head>
      <body
        className={`bg-gray-50 dark:bg-dark-secondary min-h-screen flex flex-col ${onest.className}`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem disableTransitionOnChange>
            {/* ToasterProvider must render before the children components */}
            {/* https://github.com/emilkowalski/sonner/issues/168#issuecomment-1773734618 */}
            <ToasterProvider />
            <Suspense fallback={null}>
              <RouteLoadingOverlay />
            </Suspense>

            <div className="isolate flex flex-col flex-1">{children}</div>
            <PWARegister />
            <Analytics />
            <SpeedInsights />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
