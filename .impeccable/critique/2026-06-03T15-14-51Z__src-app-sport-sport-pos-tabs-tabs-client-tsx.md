---
target: sport/pos/tabs
total_score: 26
p0_count: 0
p1_count: 3
timestamp: 2026-06-03T15-14-51Z
slug: src-app-sport-sport-pos-tabs-tabs-client-tsx
---
# Critique: POS "Tabs" screen (sport/pos/tabs)

File: `src/app/(sport)/sport/pos/tabs/tabs-client.tsx` (197 lines, client island; `page.tsx` is a 55-line server shell). The open-tabs list: link/unlink bookings, merge tabs, route to checkout, void. Verification: read-only review + `detect.mjs --json` (returned `[]`; detector does not parse Tailwind classNames). POS routes are auth-gated — no browser preview.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | row subtotal + booking/merged badges good; no busy/loading state on merge/link/void; full `load()` refetch with no spinner |
| 2 | Match System / Real World | 3 | Thai-first + ฿; no `tabular-nums` on the ฿ subtotal; raw `t.id` shown as `<code>` leaks DB ids to cashier |
| 3 | User Control and Freedom | 2 | merge/void/unlink confirm via native `confirm()`; teamLabel via `prompt()` — blocks thread, no cancel affordance, no undo |
| 4 | Consistency and Standards | 2 | **One Action Color violation**: Checkout button uses `bg-primary-600` (brand violet) not indigo action color. **Off-palette amber-600** for Merge button + merged badge (amber is not in the design palette — only indigo/emerald/red/violet). h1 `text-2xl` vs sale/checkout `text-xl` |
| 5 | Error Prevention | 3 | merge disabled <2 selected; void/unlink confirm; but `alert()` on validation, no guard against merging tabs with mixed bookings |
| 6 | Recognition over Recall | 3 | booking picker shows date/time/field/name; but merge master chosen by raw tab name only, no item preview |
| 7 | Flexibility and Efficiency | 3 | bulk merge via checkboxes is efficient; no keyboard focus rings; no select-all |
| 8 | Aesthetic and Minimalist | 3 | flat list, 8px radii, calm; emoji 🔗 in product surface reads casual; `<code>` id row is visual noise |
| 9 | Help Users with Errors | 2 | errors surface via native `alert()` with terse strings; no toast, no retry |
| 10 | Help and Documentation | 3 | merge modal has explanatory subtext; rest self-evident |

**Total: 26/40** (P0=0, P1=3)

## P1 issues
1. **One Action Color** — Checkout `bg-primary-600` (brand violet) → indigo action color `bg-indigo-500 hover:bg-indigo-600`. Per-row repeat of the same verb is fine; the color is wrong.
2. **Off-palette amber** — Merge button + merged badge use `bg-amber-600` / `text-amber-600`. Amber is not a design-system color. Use a neutral/secondary for the Merge button and a palette color (or neutral) for the merged badge.
3. **Native dialogs** — `alert()` / `confirm()` / `prompt()` block the JS thread and clash with sonner toasts used elsewhere in POS. Replace alerts with `toast.error`; keep `confirm()` for destructive void (acceptable) or move to a styled modal; replace teamLabel `prompt()` with an inline input.

## P2 polish
- `tabular-nums` on the ฿ subtotal.
- h1 `text-2xl` → `text-xl` to match sale/checkout.
- focus-visible rings + `aria-label` on icon/text-only action buttons; checkboxes need accessible labels.
- Hide or shorten the raw `t.id` `<code>` row (DB id exposure + noise).
- Loading/busy state on merge/link/void before `load()` resolves.

## Projection
Resolving the 3 P1s + the money/heading/a11y P2s would bring tabs in line with the polished sale (39) and checkout (38) screens — projected ~36-38/40.
