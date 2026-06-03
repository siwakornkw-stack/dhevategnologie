---
target: sport/pos/invoices
total_score: 28
p0_count: 0
p1_count: 3
timestamp: 2026-06-03T15-19-53Z
slug: src-app-sport-sport-pos-invoices-page-tsx
---
# Critique: POS "Invoices" screen (sport/pos/invoices)

File: `src/app/(sport)/sport/pos/invoices/page.tsx` (110 lines, single client component). Invoice history table with date/status filter, print, refund (ADMIN), void (ADMIN). Verification: read-only review + `detect.mjs --json` (returned `[]`). POS routes auth-gated — no browser preview.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | no loading state during `load()`; no busy state on void; no toast feedback on success |
| 2 | Match System / Real World | 3 | Thai-first + ฿; **no `tabular-nums`** on the 4 money columns (สินค้า/สนาม/VAT/รวม) |
| 3 | User Control and Freedom | 2 | void reason via native `prompt()`, error via native `alert()` — block the thread, clash with sonner used elsewhere |
| 4 | Consistency and Standards | 2 | **Off-palette `text-amber-600`** for refunded badge + refund link. Print/refund links `text-primary-600` (brand violet) not indigo. green vs emerald badge drift (`bg-green-100`). h1 `text-2xl` |
| 5 | Error Prevention | 3 | void is ADMIN-gated + requires reason; but `prompt()` empty-string cancels silently; no confirm distinct from reason entry |
| 6 | Recognition over Recall | 4 | columns labelled; status color-coded; refund delta shown inline |
| 7 | Flexibility and Efficiency | 3 | date + status filters; no focus rings; no pagination affordance for >N rows |
| 8 | Aesthetic and Minimalist | 4 | clean table, flat, calm |
| 9 | Help Users with Errors | 2 | `alert()` with terse server string; no toast, no retry |
| 10 | Help and Documentation | 3 | self-evident table; no help affordance |

**Total: 28/40** (P0=0, P1=3)

## P1 issues
1. **Native dialogs** — `prompt('เหตุผลที่ void:')` + `alert(...)` → replace with a small styled reason modal (or inline prompt) and `toast.error`/`toast.success`. Matches the sonner pattern used in sale/checkout/tabs.
2. **One Action Color + off-palette** — print/refund links `text-primary-600`/`text-amber-600` → indigo for the neutral print action; refund is a money-reversing action, keep it distinct but use a palette tone (not amber). refunded delta `text-amber-600` → neutral or emerald. void stays red (destructive).
3. **No `tabular-nums`** — สินค้า/สนาม/VAT/รวม + refund delta columns must be `tabular-nums` for right-aligned figures.

## P2 polish
- h1 `text-2xl` → `text-xl`.
- Status badge `bg-green-100 text-green-700` → emerald (match customers screen).
- focus-visible rings on void button + print/refund links.
- Loading row / skeleton during fetch.

## Projection
Resolving the 3 P1s + heading/badge/focus P2s → projected ~37/40.
