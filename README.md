# 88ARENA

88ARENA is a Thai-language sports-facility **booking** and **point-of-sale (POS)** system, built with Next.js 15 (App Router) and PostgreSQL. UI copy is Thai by default (with English and Burmese message catalogs).

> This repo was bootstrapped from an AI SaaS starter template. The original marketing site survives only under `src/app/(site)/`; the real product lives under `src/app/(sport)/`. The `package.json` name (`ai-starter-kit-oss`) is a leftover from that template.

## Features

### Booking
- Field browsing by sport type, price, and location; time-slot availability and pricing rules
- Customer bookings with Stripe checkout (card + PromptPay), coupons, loyalty points, referrals
- Recurring bookings, waiting list, reviews
- Admin: fields, bookings, coupons, users, reports, availability, calendar, audit logs, backup, customer chat

### POS (cashier terminal)
- Sales, open tabs (mergeable), invoices, split payments, refunds, customers
- Cash shifts (at most one open shift at a time), cash movements
- Admin-only: products, stock movements, settings, cashiers, reports

### Platform
- Auth: NextAuth v5 (Credentials + optional Google), JWT sessions, TOTP 2FA, per-email login rate limiting
- Roles: USER / CASHIER / ADMIN, enforced at the route layer and re-checked server-side
- Notifications: email (Resend), web push (VAPID), LINE Notify
- i18n via next-intl (`th` primary, `en`, `my`)
- Sentry, Vercel Analytics / Speed Insights

## Tech stack

- **Next.js 15.2.6** App Router, **React 19**
- **Prisma 7** on **PostgreSQL** via the `@prisma/adapter-pg` driver adapter
- **NextAuth v5** (beta)
- **Tailwind CSS v4**, next-intl, next-themes
- **Stripe** payments, **Resend** email, **Upstash Redis** rate limiting (in-memory fallback), **Cloudinary** / **Vercel Blob** media
- **Vitest** (unit) + **Playwright** (e2e)
- Hosted on **Vercel**

## Getting started

Requires Node.js and a reachable PostgreSQL database.

1. Install dependencies

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and set the environment variables. Required for core flows: `DATABASE_URL`, `AUTH_SECRET`, Stripe keys + `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`. Optional: Google OAuth, Upstash Redis, VAPID, LINE Notify, Cloudinary, OpenAI, Sentry, `CRON_SECRET`.

3. Set up the database and start the dev server

   ```bash
   npm run db:migrate   # create + apply migrations
   npm run db:seed      # seed sample data
   npm run dev          # http://localhost:3000
   ```

## Commands

```bash
npm run dev              # next dev
npm run build            # prisma generate && prisma migrate deploy && next build
npm run lint             # next lint

npm test                 # vitest run (unit, src/**/*.test.ts)
npm run test:watch       # vitest watch
npm run test:e2e         # playwright (specs in e2e/)
npm run test:e2e:ui      # playwright UI mode

npm run db:migrate       # prisma migrate dev
npm run db:push          # prisma db push (no migration file)
npm run db:seed          # ts-node prisma/seed.ts
npm run db:studio        # prisma studio
npm run stripe:listen    # forward Stripe webhooks to localhost:3000/api/webhooks/stripe
```

> `build` runs `prisma migrate deploy` against `DATABASE_URL`, so building needs a reachable database.

## Project structure

```
src/
  app/
    (site)/            # leftover marketing/landing pages from the template
    (sport)/sport/     # the actual app: customer, admin/, pos/
    api/sport/         # app route handlers
    api/webhooks/stripe
    api/cron/*         # cron endpoints (protected by CRON_SECRET)
  lib/                 # business logic: booking.ts, pos.ts, auth*, prisma.ts, rate-limit.ts, ...
  messages/            # th / en / my translation catalogs
  middleware.ts        # edge route gatekeeper (re-exports auth.config.ts)
prisma/schema.prisma   # Booking + POS + platform models
```

## Cron jobs (`vercel.json`)

- `/api/cron/cleanup-bookings` — 02:00
- `/api/cron/booking-reminders` — 01:00
- `/api/cron/backup` — 19:00

All cron endpoints are protected by `CRON_SECRET`.

## License

MIT
