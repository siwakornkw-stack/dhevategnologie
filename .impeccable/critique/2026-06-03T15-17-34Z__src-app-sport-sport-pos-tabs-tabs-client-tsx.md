---
target: sport/pos/tabs
total_score: 36
p0_count: 0
p1_count: 0
timestamp: 2026-06-03T15-17-34Z
slug: src-app-sport-sport-pos-tabs-tabs-client-tsx
---
# Critique: POS "Tabs" screen (sport/pos/tabs) — re-run

File: `src/app/(sport)/sport/pos/tabs/tabs-client.tsx` (client island; `page.tsx` server shell). Verification: read-only review + `detect.mjs --json` (returned `[]`; detector does not parse Tailwind classNames) + `npx tsc --noEmit` (exit 0). POS routes are auth-gated — no browser preview.

This re-run follows the colorize + de-amber + harden + a11y fix set, bringing tabs in line with sale (39) and checkout (38).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | row subtotal + booking/merged badges; still full `load()` refetch with no spinner on merge/link/void |
| 2 | Match System / Real World | 4 | Thai-first + ฿; `tabular-nums` on subtotal; raw `t.id` `<code>` row removed |
| 3 | User Control and Freedom | 4 | merge/void/unlink confirm; native `alert()`/`prompt()` replaced — link uses inline teamLabel input, errors use sonner toast. `confirm()` retained only for destructive void |
| 4 | Consistency and Standards | 4 | One Action Color satisfied: Checkout + modal Merge use indigo action color; off-palette `amber-600` removed (Merge button neutral gray, merged badge neutral); h1 `text-xl` matches sale/checkout |
| 5 | Error Prevention | 3 | merge disabled <2; void/unlink confirm; toast on validation; no guard against merging mixed-booking tabs |
| 6 | Recognition over Recall | 3 | booking picker shows date/time/field/name; merge master still chosen by name only |
| 7 | Flexibility and Efficiency | 4 | bulk merge via checkboxes; focus-visible rings throughout; no select-all |
| 8 | Aesthetic and Minimalist | 4 | flat list, 8px radii, calm; emoji 🔗 removed; id noise gone |
| 9 | Help Users with Errors | 4 | errors via sonner toast with server messages |
| 10 | Help and Documentation | 3 | merge modal explanatory subtext; rest self-evident |

**Total: 36/40** (P0=0, P1=0)

## Resolved since 26/40
- One Action Color: Checkout `bg-primary-600` (violet) → `bg-indigo-500 hover:bg-indigo-600`; modal Merge `bg-amber-600` → indigo.
- Off-palette amber removed: header Merge button → neutral gray; merged badge → neutral gray.
- Native dialogs: `alert()` → `toast.error` (openMerge/doMerge/linkBooking/unlinkBooking); teamLabel `prompt()` → inline input in the booking picker. `confirm()` kept for destructive void.
- A11y: focus-visible rings on checkboxes / link / checkout / void / merge buttons + booking-picker rows; `aria-label` on checkbox + teamLabel input.
- `tabular-nums` on subtotal; h1 `text-2xl` → `text-xl`; raw `t.id` `<code>` row removed.

## Remaining (minor, P2)
- No spinner/busy state during `load()` refetch after merge/link/void.
- Merge-master selection shows tab name + item count only, no item preview.
- No select-all for bulk merge.
