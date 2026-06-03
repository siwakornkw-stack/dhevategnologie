---
target: sport/pos/shift
total_score: 38
p0_count: 0
p1_count: 0
timestamp: 2026-06-03T15-27-56Z
slug: src-app-sport-sport-pos-shift-shift-client-tsx
---
# Critique: POS "Shift" screen (sport/pos/shift) — re-run

File: `src/app/(sport)/sport/pos/shift/shift-client.tsx` (client island; `page.tsx` server shell). Verification: read-only review + `detect.mjs --json` + `npx tsc --noEmit` (exit 0). POS routes auth-gated — no browser preview.

This re-run follows the colorize + de-blue + tabular-nums + a11y fix set, bringing shift in line with sale (39) / checkout (38) / invoices (37) / tabs (36).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | busy state on every action; expected-cash + diff live; OPEN badge; no spinner glyph |
| 2 | Match System / Real World | 4 | Thai-first + ฿; `tabular-nums` now on all money (stats, table, expected, diff, movements) |
| 3 | User Control and Freedom | 3 | close-shift `confirm()` (destructive, acceptable); errors still via inline `setMsg` banner (kept — deliberate, not native dialogs) |
| 4 | Consistency and Standards | 4 | One Action Color satisfied: open-shift + ค้นหา indigo, Z-report link indigo; off-palette `text-blue-600` diff → emerald; badges emerald; h1 `text-xl`. close=red, addMovement=neutral gray (correct) |
| 5 | Error Prevention | 4 | close disabled without counted cash; amount validated; movement disabled without amount |
| 6 | Recognition over Recall | 4 | expected-cash formula spelled out; method totals + movement history |
| 7 | Flexibility and Efficiency | 4 | date/status filters; focus-visible rings on all buttons + Z-report link |
| 8 | Aesthetic and Minimalist | 4 | flat cards, calm, organized |
| 9 | Help Users with Errors | 3 | inline error banner; no toast/retry |
| 10 | Help and Documentation | 4 | Z-report formula + bilingual labels self-explain |

**Total: 38/40** (P0=0, P1=0)

## Resolved since 34/40
- One Action Color: open-shift `bg-primary-600 hover:bg-primary-700` + ค้นหา `bg-primary-600` → `bg-indigo-500 hover:bg-indigo-600`; Z-report link `text-primary-600` → indigo.
- Off-palette blue: positive diff `text-blue-600` → `text-emerald-600`.
- `tabular-nums`: Stat values, table ตั้งต้น/นับได้, expected cash, diff, movement amounts/times.
- Badges `bg-green-100` (OPEN current + table) → emerald (+ dark); CLOSED `text-gray-600` → gray-700 for AA.
- h1 `text-2xl` → `text-xl`; focus-visible rings on open/movement/close/search/clear buttons + Z-report link.

## Remaining (minor, P2)
- Errors use inline red banner (`setMsg`) rather than sonner toast used elsewhere — kept deliberately; could unify later.
- No spinner glyph on busy buttons (text "..." only).
