---
target: sport/pos/customers
total_score: 36
p0_count: 0
p1_count: 1
timestamp: 2026-06-03T15-19-53Z
slug: app-sport-sport-pos-customers-customers-client-tsx
---
# Critique: POS "Customers" screen (sport/pos/customers)

File: `src/app/(sport)/sport/pos/customers/customers-client.tsx` (145 lines, client island; `page.tsx` server shell). Debounced customer search + points/purchase-history panel. Verification: read-only review + `detect.mjs --json` (returned `[]`). POS routes auth-gated — no browser preview.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | "กำลังค้น..." + "กำลังโหลด..." states; debounce; empty-state copy distinguishes <2 chars vs no results |
| 2 | Match System / Real World | 3 | Thai-first; **no `tabular-nums`** on points / totalSpent / invoice ยอด-คืน columns |
| 3 | User Control and Freedom | 4 | search is non-destructive; autofocus; no blocking dialogs (no alert/prompt here) |
| 4 | Consistency and Standards | 3 | status badge already `emerald` (good — the target). But selected-row highlight `bg-primary-50 dark:bg-primary-900/20` + points `text-primary-600` use brand violet for active/accent; DESIGN says active state uses indigo action color. print link `text-primary-600`. h1 `text-2xl` |
| 5 | Error Prevention | 4 | read-only screen; min 2 chars guards empty search; no destructive actions |
| 6 | Recognition over Recall | 4 | result rows show name/phone/email/points; summary header shows points/paid-count/spent |
| 7 | Flexibility and Efficiency | 3 | debounced live search is efficient; no focus-visible rings on result/print buttons |
| 8 | Aesthetic and Minimalist | 4 | clean two-pane master-detail, flat, calm |
| 9 | Help Users with Errors | 3 | no error toast if fetch fails (silently shows empty) |
| 10 | Help and Documentation | 4 | subtitle explains search scope |

**Total: 36/40** (P0=0, P1=1)

## P1 issue
1. **Brand violet on active/accent** — selected-row `bg-primary-50 dark:bg-primary-900/20`, points `text-primary-600`, print link `text-primary-600`. Per DESIGN "active state uses the indigo action color, not the brand violet." Switch the selected highlight to an indigo tint (`bg-indigo-50 dark:bg-indigo-900/20`) and points/print links to `text-indigo-600 dark:text-indigo-400`.

## P2 polish
- `tabular-nums` on points, totalSpent, invoice ยอด/คืน columns.
- h1 `text-2xl` → `text-xl`.
- focus-visible rings on result-row buttons + print links.
- Optional: error toast if search/history fetch fails (currently fails silent to empty).

## Note
Cleanest of the three (already uses emerald status badges, no native dialogs). The only structural fix is violet→indigo for active/accent.

## Projection
Resolving the P1 + P2s → projected ~38-39/40.
