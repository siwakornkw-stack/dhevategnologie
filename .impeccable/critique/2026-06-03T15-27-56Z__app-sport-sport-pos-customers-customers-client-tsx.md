---
target: sport/pos/customers
total_score: 39
p0_count: 0
p1_count: 0
timestamp: 2026-06-03T15-27-56Z
slug: app-sport-sport-pos-customers-customers-client-tsx
---
# Critique: POS "Customers" screen (sport/pos/customers) — re-run

File: `src/app/(sport)/sport/pos/customers/customers-client.tsx` (client island; `page.tsx` server shell). Verification: read-only review + `detect.mjs --json` + `npx tsc --noEmit` (exit 0). POS routes auth-gated — no browser preview.

This re-run follows the violet→indigo + tabular-nums + a11y fix set.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | "กำลังค้น..." + "กำลังโหลด..." states; debounce; empty-state copy distinguishes <2 chars vs no results |
| 2 | Match System / Real World | 4 | Thai-first; `tabular-nums` on points / totalSpent / invoice ยอด-คืน |
| 3 | User Control and Freedom | 4 | search non-destructive; autofocus; no blocking dialogs |
| 4 | Consistency and Standards | 4 | active/accent now indigo: selected-row `bg-indigo-50 dark:bg-indigo-900/20`, points + print links `text-indigo-600`; status badge emerald; h1 `text-xl` |
| 5 | Error Prevention | 4 | read-only; min 2 chars guards empty search; no destructive actions |
| 6 | Recognition over Recall | 4 | result rows show name/phone/email/points; summary header |
| 7 | Flexibility and Efficiency | 4 | debounced live search; focus-visible rings on result rows + print links |
| 8 | Aesthetic and Minimalist | 4 | clean two-pane master-detail, flat, calm |
| 9 | Help Users with Errors | 3 | fetch failure still falls silent to empty (no error toast) |
| 10 | Help and Documentation | 4 | subtitle explains search scope |

**Total: 39/40** (P0=0, P1=0)

## Resolved since 36/40
- Brand violet → indigo: selected-row `bg-primary-50 dark:bg-primary-900/20` → `bg-indigo-50 dark:bg-indigo-900/20`; points `text-primary-600` → `text-indigo-600 dark:text-indigo-400`; print link `text-primary-600` → indigo.
- `tabular-nums`: list points, header points/paid-count/spent, invoice ยอด/คืน.
- h1 `text-2xl` → `text-xl`; focus-visible rings (ring-inset on result rows) + print links.

## Remaining (minor, P2)
- Search/history fetch failure falls silent to empty state — no error toast.
