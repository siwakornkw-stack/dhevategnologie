---
target: sport/pos/products
total_score: 28
p0_count: 0
p1_count: 3
timestamp: 2026-06-03T15-48-00Z
slug: c-app-sport-sport-pos-products-products-client-tsx
---
# Critique: POS "Products" screen (sport/pos/products) — ADMIN

File: `src/app/(sport)/sport/pos/products/products-client.tsx` (245 lines, client island; `page.tsx` server shell). Product CRUD: search, add/edit inline form with image upload, delete, low-stock highlight. Verification: read-only review + `detect.mjs --json` (1 warning: gray-on-color line 229, the inactive badge — benign). POS routes auth-gated — no browser preview.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | list loading state + upload "กำลังอัปโหลด..."; no busy state on save/delete, no success toast |
| 2 | Match System / Real World | 3 | Thai-first; **no `tabular-nums`** on ราคา/ทุน/Stock columns |
| 3 | User Control and Freedom | 2 | save/upload errors via native `alert()`; delete `confirm()` (destructive, acceptable); no toast feedback |
| 4 | Consistency and Standards | 2 | **One Action Color violation**: "+ เพิ่มสินค้า" + form "บันทึก" + "แก้" link use `bg-primary-600`/`text-primary-600` (brand violet) not indigo. **Off-palette `text-amber-600`** low-stock. green vs emerald badge drift. status badge is `rounded-full` pill (product surface should be 8px, not pills). h1 `text-2xl` |
| 5 | Error Prevention | 3 | required fields on name/price; delete confirm; no validation messaging beyond browser default |
| 6 | Recognition over Recall | 4 | inline form prefilled on edit; image preview; low-stock visually flagged |
| 7 | Flexibility and Efficiency | 3 | live search; inline add/edit; no focus-visible rings; no keyboard submit hint |
| 8 | Aesthetic and Minimalist | 3 | clean table + form; injected `<style>` block for `.input` is an outlier (hardcoded `#e5e7eb`, no indigo focus ring per the POS-input spec) |
| 9 | Help Users with Errors | 2 | `alert()` terse strings; no toast, no inline field errors |
| 10 | Help and Documentation | 3 | placeholders label fields; no broader help |

**Total: 28/40** (P0=0, P1=3)

## P1 issues
1. **One Action Color** — "+ เพิ่มสินค้า" `bg-primary-600 hover:bg-primary-700`, form "บันทึก" `bg-primary-600`, "แก้" link `text-primary-600` → indigo action color (`bg-indigo-500 hover:bg-indigo-600`, link `text-indigo-600 dark:text-indigo-400`). Delete=red (destructive) and ยกเลิก=neutral border are correct.
2. **Native dialogs** — `alert()` on upload + save failures → sonner `toast.error`; add `toast.success` on save. Matches POS pattern. Keep `confirm()` for destructive delete.
3. **`.input` lacks the POS-input focus spec** — injected `<style>` hardcodes `#e5e7eb` (should be token `#d1d5db`) and has no focus state. DESIGN POS-input requires indigo focus border + 2px ring. Either drop the inline `<style>` and use the project `.input` global (if it carries focus styling) or add `:focus` indigo border + ring.

## P2 polish
- `tabular-nums` on ราคา/ทุน/Stock columns.
- Off-palette amber low-stock → a palette warning treatment (or error red if "out/critical"); document the warning color since the system lacks one.
- Status badge `bg-green-100` → emerald; switch `rounded-full` → `rounded` (8px) to match product (non-pill) idiom.
- h1 `text-2xl` → `text-xl`.
- focus-visible rings on add/save/edit/delete buttons + file-picker label.
- busy state on save button.

## Projection
Resolving the 3 P1s + money/badge/heading P2s → projected ~36-37/40.
