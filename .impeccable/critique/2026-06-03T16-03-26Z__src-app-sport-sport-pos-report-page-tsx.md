---
target: sport/pos/report
total_score: 29
p0_count: 0
p1_count: 2
timestamp: 2026-06-03T16-03-26Z
slug: src-app-sport-sport-pos-report-page-tsx
---
# Critique — sport/pos/report (page.tsx)

POS sales report: date range + CSV export + 12 stat cards + by-method + top-products table. Financial-data heavy. Auth-gated — static analysis only.

## Design Health Score: 29/40

| Dimension | Score | Notes |
|---|---|---|
| Color discipline | 4/5 | CSV link `bg-primary-600` violet → indigo (single action) |
| Typography | 4/5 | h1 `text-2xl` workhorse drift |
| Spacing/layout | 5/5 | stat grid + sections, clean |
| Hierarchy | 4/5 | stat cards uniform; refund/profit not colorized |
| Numerics | 1/5 | NO tabular-nums anywhere — 12 stat values, by-method amounts, top-product qty/revenue all proportional figures. Critical on a report screen. |
| State feedback | 4/5 | no native dialogs; loading state present |
| A11y | 3/5 | no focus-visible rings on date inputs / CSV link |
| Polish | 4/5 | uses raw date-input classes (not global .input) — acceptable |

## P1 (high)
1. **tabular-nums everywhere** — Stat value (line 113), by-method amount (80), top-product qty + revenue (97-98). Report figures must align.
2. CSV link `bg-primary-600` (line 56) → `bg-indigo-500 hover:bg-indigo-600` + focus ring.

## P2 (medium)
3. h1 `text-2xl` → `text-xl` (line 44).
4. Colorize signed stats: refund `-฿` → red; netSales / grossProfit → emerald (red if grossProfit < 0). Improves scan hierarchy on a money screen.
5. focus-visible rings on date inputs + CSV link.

## Strengths
- Comprehensive financials (VAT, SC, cost, margin%) in one grid.
- CSV ภพ.30 export — practical for Thai tax filing.
- Clean Stat component, no native dialogs.
