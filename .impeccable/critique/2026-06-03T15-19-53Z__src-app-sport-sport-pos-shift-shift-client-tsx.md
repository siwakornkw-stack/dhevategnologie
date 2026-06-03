---
target: sport/pos/shift
total_score: 34
p0_count: 0
p1_count: 3
timestamp: 2026-06-03T15-19-53Z
slug: src-app-sport-sport-pos-shift-shift-client-tsx
---
# Critique: POS "Shift" screen (sport/pos/shift)

File: `src/app/(sport)/sport/pos/shift/shift-client.tsx` (337 lines, client island; `page.tsx` server shell). Open/close cashier shift, petty-cash movements, Z-report list. Verification: read-only review + `detect.mjs --json` (1 warning: gray-on-color at line 314). POS routes auth-gated — no browser preview.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | busy state on every action button; expected-cash + diff live; OPEN badge; no spinner glyph |
| 2 | Match System / Real World | 3 | Thai-first + ฿; **no `tabular-nums`** on any money column (stats, table ตั้งต้น/นับได้, expected, diff) — figures jitter |
| 3 | User Control and Freedom | 3 | close-shift `confirm()` (destructive, acceptable); errors via inline `setMsg` red banner, not sonner toast used elsewhere in POS |
| 4 | Consistency and Standards | 2 | **One Action Color violation**: open-shift + "ค้นหา" + Z-report link use `bg-primary-600`/`text-primary-600` (brand violet) not indigo. **Off-palette `text-blue-600`** for positive diff. green vs emerald badge drift (`bg-green-100`). h1 `text-2xl` vs sale/checkout `text-xl` |
| 5 | Error Prevention | 4 | close disabled without counted cash; amount validated; movement disabled without amount |
| 6 | Recognition over Recall | 4 | expected-cash formula spelled out; method totals shown; movement history listed |
| 7 | Flexibility and Efficiency | 3 | date/status filters; no focus-visible rings on any control |
| 8 | Aesthetic and Minimalist | 4 | flat cards, calm; dense but organized |
| 9 | Help Users with Errors | 3 | inline error strings; no toast, no retry affordance |
| 10 | Help and Documentation | 4 | Z-report formula + Thai+English labels explain themselves |

**Total: 34/40** (P0=0, P1=3)

## P1 issues
1. **One Action Color** — open-shift button `bg-primary-600 hover:bg-primary-700`, "ค้นหา" filter button `bg-primary-600`, Z-report link `text-primary-600` → indigo action color (`bg-indigo-500 hover:bg-indigo-600`, links `text-indigo-600 dark:text-indigo-400`). close-shift `bg-red-600` (destructive) and addMovement `bg-gray-800` (neutral secondary) are correct.
2. **Off-palette blue** — positive diff `text-blue-600` is not a design color. Use a neutral or palette tone (emerald reads as "surplus"); keep red for shortfall.
3. **No `tabular-nums`** — every money figure (Stat values, table ตั้งต้น/นับได้, expected cash, diff, movement amounts) should be `tabular-nums` so digits align/don't jitter.

## P2 polish
- h1 `text-2xl` → `text-xl`.
- Status badges `bg-green-100 text-green-700` → emerald to match customers screen; the CLOSED `bg-gray-100 text-gray-600` triggers detect gray-on-color (line 314) — fine on light gray but bump text to gray-700 for AA.
- focus-visible rings on buttons / inputs / Z-report link.
- Consider sonner toast for errors instead of the inline red banner, to match the rest of POS.

## Projection
Resolving the 3 P1s + heading/badge/focus P2s → projected ~37-38/40.
