# Product

## Register

product

## Users

Three audiences, all Thai-first:
- **Customers** — book sports fields, pay (Stripe/PromptPay), manage their bookings, chat with staff, earn loyalty points. On mobile or desktop, often in a hurry to grab a slot.
- **Cashiers** — work the POS terminal during a shift: ring up sales, run tabs, take payments, manage invoices and customers. High-frequency, repetitive task flow on a fixed terminal.
- **Admins** — manage fields, bookings, coupons, users, reports, availability, audit logs, backups, plus POS products/stock/settings/cashiers. Oversight and configuration, not transaction speed.

## Product Purpose

88ARENA is a sports-facility booking and point-of-sale system. Customers reserve fields online; staff run the on-site shop and tabs through a cashier terminal; admins configure inventory, pricing, and oversee operations. Success = a slot gets booked and paid without friction, and a cashier closes a sale in as few taps as possible.

## Brand Personality

Clean and efficient. The interface should feel calm, fast, and trustworthy — it gets out of the way so customers book and cashiers transact without thinking about the UI. Three words: **clear, quick, dependable**. Confidence over flash.

## Anti-references

- **Generic AI-starter / SaaS-template look.** No marketing-landing tropes leaking into the product: no violet hero glows, floating blobs, or decorative gradient flourishes on functional screens. The inherited starter aesthetic under `(site)/` is legacy, not the product's visual target.

## Design Principles

- **Speed is the feature.** Both booking and POS are time-sensitive. Minimize taps, surface the primary action, never make a cashier hunt.
- **Clarity over decoration.** Function-first screens. Save gradients and motion for marketing surfaces, not the app shell.
- **Trust through consistency.** Money, slots, and stock are at stake. Predictable layouts and states build confidence.
- **Thai-first.** Copy, dates (th-TH), and number formatting default to Thai; design for Thai text density.
- **State completeness.** Loading, empty, error, and success states are part of the design, not an afterthought.

## Accessibility & Inclusion

WCAG AA target: AA contrast across light and dark themes, full keyboard navigation, visible focus states. Dark mode is a first-class theme (next-themes, `[data-theme]` switching) and must hold AA contrast, not just the light theme.
