---
target: sport/pos/products
total_score: 37
p0_count: 0
p1_count: 0
timestamp: 2026-06-03T15-50-10Z
slug: c-app-sport-sport-pos-products-products-client-tsx
---
# Critique: POS "Products" screen (sport/pos/products) — ADMIN — re-run

File: `src/app/(sport)/sport/pos/products/products-client.tsx` (client island; `page.tsx` server shell). Verification: read-only review + `detect.mjs --json` + `npx tsc --noEmit` (exit 0). POS routes auth-gated — no browser preview.

This re-run follows the colorize + harden + input-focus + P2 fix set, bringing products in line with sale (39) / customers (39) / shift (38) / checkout (38) / invoices (37) / tabs (36).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | list loading + upload state; save now has busy state + success toast |
| 2 | Match System / Real World | 4 | Thai-first; `tabular-nums` on ราคา/ทุน/Stock |
| 3 | User Control and Freedom | 4 | save/upload errors via sonner toast; delete `confirm()` (destructive, acceptable) |
| 4 | Consistency and Standards | 4 | One Action Color satisfied: add/save indigo, แก้ link indigo; off-palette amber low-stock → red; status badge emerald + `rounded` (no longer pill); h1 `text-xl`. delete=red, cancel=neutral correct |
| 5 | Error Prevention | 3 | required name/price; delete confirm; no inline field error messaging |
| 6 | Recognition over Recall | 4 | inline form prefilled on edit; image preview; low-stock flagged |
| 7 | Flexibility and Efficiency | 4 | live search; inline add/edit; focus-visible rings on buttons + search input |
| 8 | Aesthetic and Minimalist | 4 | inline `<style>` removed — form inputs now use the global `.input` (indigo focus border + 2px ring, correct `#d1d5db` border, dark mode) |
| 9 | Help Users with Errors | 3 | toast errors carry server strings; no inline field errors |
| 10 | Help and Documentation | 3 | placeholders label fields; no broader help |

**Total: 37/40** (P0=0, P1=0)

## Resolved since 28/40
- One Action Color: "+ เพิ่มสินค้า" `bg-primary-600 hover:bg-primary-700` + form "บันทึก" `bg-primary-600` → `bg-indigo-500 hover:bg-indigo-600`; "แก้" link `text-primary-600` → indigo.
- Native dialogs: `alert()` (upload + save) → `toast.error`; added `toast.success` on save. `confirm()` kept for delete.
- Inline `<style>` `.input` removed → form fields inherit the global `.input` (DESIGN POS-input spec: indigo focus border + 2px ring, `#d1d5db` border, dark mode).
- `tabular-nums` on ราคา/ทุน/Stock; off-palette amber low-stock → `text-red-600`.
- Status badge `bg-green-100` → emerald (+ dark); `rounded-full` → `rounded` (8px product idiom).
- h1 `text-2xl` → `text-xl`; busy state on save; focus-visible rings on add/save/cancel/edit/delete + search input.

## Remaining (minor, P2)
- No inline per-field validation messaging (relies on browser-native required).
- Low-stock uses error red — a dedicated warning color is not defined in the design system; acceptable but worth documenting.
