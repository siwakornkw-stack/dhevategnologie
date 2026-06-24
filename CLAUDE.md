# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app is

Despite the `package.json` name (`ai-starter-kit-oss`) and the template-derived `README.md`, this repo is **DhevaSuite** (formerly 88ARENA), a Thai-language sports-facility booking + point-of-sale (POS) system. The original AI-starter-kit marketing site survives only under `src/app/(site)/` (landing/pricing/auth pages); the real product lives under `src/app/(sport)/`. UI copy is Thai by default.

## Commands

```bash
npm run dev              # next dev (http://localhost:3000)
npm run build            # prisma generate && prisma migrate deploy && next build
npm run lint             # next lint (NOTE: build ignores eslint errors, see next.config.ts)

npm test                 # vitest run (unit, node env, *.test.ts under src/)
npm run test:watch       # vitest watch
npx vitest run src/lib/booking.test.ts            # single unit test file
npx vitest run -t "name of test"                  # single test by name

npm run test:e2e         # playwright (specs in e2e/, serial, 1 worker, auto-starts dev server)
npm run test:e2e:ui      # playwright UI mode

npm run db:migrate       # prisma migrate dev (create + apply migration)
npm run db:push          # prisma db push (no migration file)
npm run db:seed          # ts-node prisma/seed.ts
npm run db:studio        # prisma studio
npm run stripe:listen    # forward Stripe webhooks to localhost:3000/api/webhooks/stripe
```

`build` runs `prisma migrate deploy` against `DATABASE_URL`, so a build needs a reachable DB. Unit tests run in the `node` environment (not jsdom) — they exercise `src/lib` pure logic, not React. E2E (Playwright) reuses an existing dev server if one is up.

## Architecture

**Stack:** Next.js 15 App Router (React 19), Prisma 7 on PostgreSQL via the `@prisma/adapter-pg` driver adapter, NextAuth v5 (beta), Tailwind v4, next-intl, Sentry. Hosted on Vercel.

### Route groups (`src/app`)
- `(site)/` — marketing/landing pages inherited from the AI starter template. Mostly static.
- `(sport)/sport/` — the actual app. Three audiences:
  - public/customer: field browsing, `bookings/`, `chat/`, `profile/`
  - `admin/` — ADMIN-only: fields, bookings, coupons, users, reports, availability, audit-logs, backup, chat
  - `pos/` — cashier terminal: `sale/`, `tabs/`, `shift/`, `invoices/`, `customers/`, plus ADMIN-only `products/`, `stock/`, `settings/`, `cashiers/`, `report/`
- `api/` — route handlers. App APIs are under `api/sport/`; Stripe webhook at `api/webhooks/stripe`; cron endpoints at `api/cron/*`.

Pages are server components by default; the `*-client.tsx` / `*-form.tsx` files colocated in each route are the client islands.

### Auth & authorization (read these together)
Auth is split into two files so the edge middleware stays light:
- `src/lib/auth.config.ts` — edge-safe config. Its `authorized()` callback is the **route gatekeeper** and encodes the full role matrix (USER / CASHIER / ADMIN). `src/middleware.ts` re-exports this and only matches `/sport/{bookings,admin,pos,profile,chat}`. Path-level access rules live here, not in pages.
- `src/lib/auth.ts` — full NextAuth instance (Credentials + optional Google, Prisma adapter, JWT sessions). The `jwt` callback re-reads role/`emailVerified` from the DB every 5 min, on explicit `update` triggers, and invalidates the session if `passwordChangedAt` is newer than the token. Credentials login enforces per-email rate limiting and TOTP 2FA.

Server-side, POS routes call `requirePosRole()` from `src/lib/pos.ts` for role checks; don't rely on middleware alone for API authorization.

### `src/lib` — business logic lives here (not in route handlers)
- `prisma.ts` — singleton client built on a `pg` Pool + `PrismaPg` adapter; cached on `globalThis` outside production.
- `booking.ts` — time-slot generation, availability, pricing, points; date helpers format in `th-TH`. Has unit tests.
- `pos.ts` — POS core: role guard, `getPosSettings()` (singleton `PosSettings` row id `default`), invoice numbering (`INV-YYYYMMDD-NNNN`), VAT math (`calcVat`, NONE/INCLUDED/EXCLUDED).
- `rate-limit.ts` — Upstash Redis limiter with in-memory fallback. `getClientIp()` deliberately trusts `x-real-ip` and the *rightmost* `x-forwarded-for` entry to resist spoofing — do not "simplify" this to the leftmost value.
- Others: `stripe.ts`, `email.ts` (Resend), `web-push.ts` (VAPID), `line-notify.ts`, `cloudinary.ts`, `backup.ts`, `settings.ts`, `token.ts`, `cron-auth.ts`, `zod/` schemas.

### Concurrency & idempotency invariants (don't regress these)
- **Stripe webhook dedup:** `api/webhooks/stripe` inserts a `ProcessedStripeEvent` row (PK = event id) and treats an insert failure as a duplicate, so side effects (mark-paid, points, emails) run once. It also ignores `checkout.session.completed` until `payment_status === 'paid'` (PromptPay settles async).
- **POS shift:** unique constraint enforces at most one OPEN shift (migration `pos_shift_unique_open`).
- Recent commit history shows deliberate security/concurrency hardening across booking + POS — prefer DB-level constraints and atomic writes over read-then-write.

### Data model (Prisma)
One schema, `prisma/schema.prisma`, two domains:
- **Booking:** `Field` (with `FieldBlockedDate`, `FieldPriceRule`), `Booking` (Stripe fields, coupons, points, recurring groups), `Coupon`, `WaitingList`, `Review`, plus loyalty (`PointTransaction`, `User.points`) and referrals.
- **POS:** `PosProduct` + `PosStockMovement`, `PosTab` + `PosOrderItem` (tabs can merge via `parentTabId`), `PosInvoice` + `PosPayment`/`PosInvoiceSplit`/`PosRefund`, `PosShift` + `PosCashMovement`, `PosSettings`.
- Shared/platform: `User` (Role USER/ADMIN/CASHIER, 2FA, referrals), NextAuth `Account`/`Session`/`VerificationToken`, `Notification`, `Conversation`/`Message` (customer-admin chat), `PushSubscription`, `AuditLog`, `SystemSetting`.

### Cron (vercel.json)
`/api/cron/cleanup-bookings` (02:00), `/api/cron/booking-reminders` (01:00), `/api/cron/backup` (19:00). Protect with `CRON_SECRET` (see `cron-auth.ts`).

### i18n
next-intl configured via `src/i18n/request.ts`. Message catalogs in `src/messages/{th,en,my}.json`; Thai is primary.

### Env
Copy `.env.example` to `.env`. Required for core flows: `DATABASE_URL`, `AUTH_SECRET`, Stripe keys + `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`. Optional: Google OAuth, Upstash Redis (rate limiting falls back to in-memory — single-instance only), VAPID, LINE Notify, Cloudinary, OpenAI, Sentry, `CRON_SECRET`.

---

## Coding profile (project conventions)

- Read existing files before writing. Thorough in reasoning, concise in output.
- Do not guess APIs, versions, flags, commit SHAs, or package names — verify by reading code or docs first.
- Simplest working solution. No abstractions for single-use operations. No speculative features. Three similar lines beat a premature abstraction.
- No error handling for scenarios that cannot happen. Comments only where logic is non-obvious; no docstrings/type annotations on code not being changed.
- Reviews: state the bug, show the fix, stop. No out-of-scope suggestions, no compliments.
- Debugging: read the relevant code before speculating. State what/where/fix in one pass; if cause is unclear, say so.
- Formatting: plain hyphens and straight quotes, no em dashes / smart quotes / decorative Unicode / emojis. Code output must be copy-paste safe.
