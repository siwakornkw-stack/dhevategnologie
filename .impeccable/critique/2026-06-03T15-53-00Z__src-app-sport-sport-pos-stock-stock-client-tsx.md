---
target: sport/pos/stock
total_score: 27
p0_count: 0
p1_count: 4
timestamp: 2026-06-03T15-53-00Z
slug: src-app-sport-sport-pos-stock-stock-client-tsx
---
# Critique — sport/pos/stock (stock-client.tsx)

POS stock screen: movement form + stock-take modal + movement log table. Auth-gated (no browser preview) — static analysis only.

## Design Health Score: 27/40

| Dimension | Score | Notes |
|---|---|---|
| Color discipline | 2/5 | One-Action violated: `bg-primary-600` submit + two `bg-emerald-600` stock-take buttons compete; off-palette blue/orange badges |
| Typography | 4/5 | h1 `text-2xl` (workhorse drift); otherwise consistent |
| Spacing/layout | 4/5 | grid form + modal layout sound |
| Hierarchy | 3/5 | three same-weight action buttons, no clear primary |
| Numerics | 2/5 | no tabular-nums on stock qty / delta / movement qty |
| State feedback | 2/5 | `alert()` x5 for errors/success; no toast |
| A11y | 2/5 | no focus-visible rings on stock-take inputs/buttons |
| Polish | 3/5 | inline `<style>` `.input` override duplicates global, lacks focus ring |

## P1 (high)

1. **One Action Color** — line 151 submit `bg-primary-600` (violet) → `bg-indigo-500 hover:bg-indigo-600`. Stock-take buttons (line 125, 212) `bg-emerald-600` use a status color as action → demote to neutral `bg-gray-800` / `bg-gray-200` since submit is the single primary verb on this screen.
2. **Off-palette movement badges** — lines 243-247: SALE `bg-blue-100`, VOID `bg-orange-100`, IN `bg-green-100` → emerald/red/neutral palette.
3. **alert() everywhere** — lines 65, 84, 88, 92 (stock-take) + 111 (submit) → `toast.error` / `toast.success`. Keep `confirm()` line 66 (destructive bulk adjust).
4. **Inline `<style>` `.input`** — line 154 hardcodes `#e5e7eb` border, no focus ring. Delete → inherit global `.input` (globals.css 380-405 has correct #d1d5db + indigo focus).

## P2 (medium)

5. h1 `text-2xl` → `text-xl` (line 123, workhorse rule).
6. tabular-nums missing — modal delta (193), in-system qty (183), count input, movement qty cell (250), movement-log not aligned.
7. delta/qty colors `text-green-600`/`text-green-700` (193, 250) → emerald.
8. focus-visible rings absent on stock-take count inputs (185), modal buttons (211-212), open button (125).

## Strengths
- Stock-take diff preview (computed delta per row) is genuinely good UX.
- confirm() guard on bulk adjust is correct (destructive).
- Skip-unchanged-row logic clean.
