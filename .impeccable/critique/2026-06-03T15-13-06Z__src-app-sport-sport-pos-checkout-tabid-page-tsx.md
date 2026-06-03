---
target: sport/pos/checkout
total_score: 38
p0_count: 0
p1_count: 0
timestamp: 2026-06-03T15-13-06Z
slug: src-app-sport-sport-pos-checkout-tabid-page-tsx
---
# Critique: POS "Checkout" screen (sport/pos/checkout/[tabId]) — re-run

File: `src/app/(sport)/sport/pos/checkout/[tabId]/page.tsx` (single client component, payment-completion screen). Verification: read-only review + `detect.mjs --json` (returned `[]`; detector does not parse Tailwind classNames) + `npx tsc --noEmit` (exit 0). POS routes are auth-gated — no browser preview.

This re-run follows the colorize + harden + a11y + P2 fix set, bringing checkout in line with the polished sale screen (39/40).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | submit busy state + live change + split-sum indicator; native `alert()` replaced by sonner toasts (error + success "ทอน"), popup-blocker guard toast. Still no spinner glyph (text only) |
| 2 | Match System / Real World | 4 | Thai-first + ฿; `tabular-nums` now on every money column; VAT/SC carry `title` tooltips explaining incl/excl |
| 3 | User Control and Freedom | 4 | clear-customer, remove-split, uncheck-booking; toasts no longer block the thread; "พอดี" exact-cash shortcut added |
| 4 | Consistency and Standards | 4 | One Action Color now satisfied: all primary verbs + active method + text links use indigo action color; positive amounts unified on `emerald-600`; h1 `text-xl` matches sale. `✕` split-remove now has aria-label |
| 5 | Error Prevention | 4 | submit disabled on zero total / split mismatch / cash-short; qty/discount clamps server-side |
| 6 | Recognition over Recall | 4 | denomination + "พอดี" shortcuts; method labels visible; customer/points context shown |
| 7 | Flexibility and Efficiency | 3 | keyboard focus rings added throughout; no hotkeys for method select |
| 8 | Aesthetic and Minimalist | 4 | flat-by-default, 8px radii, calm neutrals; dense but legible |
| 9 | Help Users with Errors | 4 | toast errors carry server messages; popup-blocker guidance with 8s duration |
| 10 | Help and Documentation | 3 | VAT/SC tooltips added; no broader help affordance |

**Total: 38/40** (P0=0, P1=0)

## Resolved since 26/40
- One Action Color: `bg-primary-600` (brand violet) → `bg-indigo-500 hover:bg-indigo-600` on submit/coupon/active-method; text links → `text-indigo-600 dark:text-indigo-400`.
- Semantic color: `text-green-600` / `text-orange-600` → `text-emerald-600` for all positive/discount amounts.
- `alert()` → sonner `toast.error` / `toast.success`; popup-blocker guard toast.
- A11y: focus-visible rings on all interactive controls; `aria-pressed` on method toggles; `aria-label` on `✕` split-remove.
- `tabular-nums` on all money columns; h1 `text-2xl` → `text-xl`.
- "พอดี" exact-cash shortcut.

## Remaining (minor, P2)
- No spinner glyph on submit (text-only busy state).
- English VAT jargon ("incl/excl/Pre-VAT") remains in tooltips.
- No keyboard hotkeys for payment-method selection.
