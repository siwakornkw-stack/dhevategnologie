---
target: sport/pos/sale
total_score: 39
p0_count: 0
p1_count: 0
timestamp: 2026-06-03T15-03-29Z
slug: src-app-sport-sport-pos-sale-page-tsx
---
# Critique: POS "Sale" screen (sport/pos/sale) — re-run #2

Files: `src/app/(sport)/sport/pos/sale/sale-client.tsx`, `src/app/api/sport/pos/tabs/[id]/items/[itemId]/route.ts`. Re-critique after adding the tab-cart qty stepper (new PATCH endpoint) and the VAT/SC help tooltips, on top of the prior layout/harden/colorize/typeset/polish + POS-wide radii normalization. Verification: `npx tsc --noEmit` exit 0 (POS routes auth-gated, no browser preview). Detector scan returned `[]` clean.

## Design Health Score

| # | Heuristic | Score | Δ | Key Issue / What Changed |
|---|-----------|-------|---|--------------------------|
| 1 | Visibility of System Status | 4 | 0 | toasts, busy states, live change/qty (aria-live) |
| 2 | Match System / Real World | 4 | 0 | Thai-first, ฿, tabular-nums, exact-cash |
| 3 | User Control and Freedom | 4 | 0 | escape/cancel everywhere, optimistic rollback on qty + void |
| 4 | Consistency and Standards | 4 | +1 | radii normalized to 8px (rounded-lg) across all 15 POS screens |
| 5 | Error Prevention | 4 | 0 | stock guards (PATCH stock-insufficient check), disabled states, discount clamp on qty change |
| 6 | Recognition Rather Than Recall | 4 | 0 | aria-labels, example placeholders, recall path |
| 7 | Flexibility and Efficiency | 4 | 0 | qty stepper in tab cart (−/+; − at 1 voids), barcode scan, exact-cash + denominations |
| 8 | Aesthetic and Minimalist Design | 4 | 0 | drawer layout, collapsible extras |
| 9 | Error Recovery | 4 | 0 | actionable toasts, atomic server rollback |
| 10 | Help and Documentation | 3 | +1 | VAT/SC labels now carry tooltips (dotted underline + title) explaining INCLUDED/EXCLUDED/service-charge; still no full help layer |
| **Total** | | **39/40** | **+2** | **Excellent — near-complete** |

## Trend

20/40 → 37/40 → 39/40. P0: 0. P1: 0.

## Remaining

- **Help layer (heuristic 10, 3/4)**: tooltips added; a fuller in-context help/onboarding layer would reach 4.
- qty stepper does not optimistically refresh the product-grid stock number (consistent with the existing void flow); server is source of truth.
- Full listbox ARIA + arrow-key nav on customer search (recognition refinement).

## Anti-Patterns Verdict

Detector clean. One Action Color, Gradient Quarantine, Flat-by-default, 14px Workhorse all respected. New PATCH endpoint mirrors the existing atomic stock pattern (transaction, StockMovement type ADJUST, ownership + tab-open guards).
