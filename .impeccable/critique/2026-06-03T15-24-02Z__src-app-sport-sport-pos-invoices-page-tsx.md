---
target: sport/pos/invoices
total_score: 37
p0_count: 0
p1_count: 0
timestamp: 2026-06-03T15-24-02Z
slug: src-app-sport-sport-pos-invoices-page-tsx
---
# Critique: POS "Invoices" screen (sport/pos/invoices) — re-run

File: `src/app/(sport)/sport/pos/invoices/page.tsx` (single client component). Verification: read-only review + `detect.mjs --json` (returned `[]`) + `npx tsc --noEmit` (exit 0). POS routes auth-gated — no browser preview.

This re-run follows the harden + de-amber + colorize + tabular-nums fix set, bringing invoices in line with sale (39) / checkout (38) / tabs (36).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | void now shows busy state + success toast; list still has no loading row |
| 2 | Match System / Real World | 4 | Thai-first + ฿; `tabular-nums` on all 4 money columns + refund delta |
| 3 | User Control and Freedom | 4 | native `prompt()`/`alert()` replaced by a styled void-reason modal (Esc/overlay to cancel, Enter to confirm) + sonner toasts |
| 4 | Consistency and Standards | 4 | One Action Color satisfied: print link indigo, refund link neutral gray, void red (destructive); off-palette amber removed (refunded delta → red); status badge emerald; h1 `text-xl` |
| 5 | Error Prevention | 4 | void ADMIN-gated; modal requires non-empty reason (button disabled); confirm distinct from list |
| 6 | Recognition over Recall | 4 | columns labelled; status color-coded; refund delta inline |
| 7 | Flexibility and Efficiency | 3 | date + status filters; focus-visible rings added; no pagination affordance |
| 8 | Aesthetic and Minimalist | 4 | clean table, flat, calm |
| 9 | Help Users with Errors | 4 | toast errors carry server messages |
| 10 | Help and Documentation | 3 | self-evident table; no broader help affordance |

**Total: 37/40** (P0=0, P1=0)

## Resolved since 28/40
- Native dialogs: `prompt('เหตุผลที่ void:')` + `alert()` → styled void-reason modal + `toast.error`/`toast.success`.
- Off-palette amber removed: refunded delta `text-amber-600` → `text-red-600`; refund link `text-amber-600` → neutral gray.
- One Action Color: print link `text-primary-600` (violet) → `text-indigo-600 dark:text-indigo-400`.
- `tabular-nums` on สินค้า/สนาม/VAT/รวม + refund delta.
- Status badge `bg-green-100` → emerald (+ dark variants); h1 `text-2xl` → `text-xl`.
- focus-visible rings on void button + print/refund links + modal controls.

## Remaining (minor, P2)
- No loading row / skeleton during list fetch.
- No pagination affordance for large result sets.
