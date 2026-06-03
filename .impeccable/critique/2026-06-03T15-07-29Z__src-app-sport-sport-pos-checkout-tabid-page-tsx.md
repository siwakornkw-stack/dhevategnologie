---
target: sport/pos/checkout
total_score: 26
p0_count: 0
p1_count: 3
timestamp: 2026-06-03T15-07-29Z
slug: src-app-sport-sport-pos-checkout-tabid-page-tsx
---
# Critique: POS "Checkout" screen (sport/pos/checkout/[tabId])

File: `src/app/(sport)/sport/pos/checkout/[tabId]/page.tsx` (378 lines, single client component). The payment-completion screen reached from the sale tab cart. Verification: read-only review + `detect.mjs --json` (returned `[]` clean; detector does not parse Tailwind classNames). POS routes are auth-gated — no browser preview.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | submit busy state + live change + split-sum indicator good; but errors use native `alert()`, no success toast, no loading spinner (text only) |
| 2 | Match System / Real World | 3 | Thai-first + ฿, but no `tabular-nums` on any money column; "incl/excl/Pre-VAT" English jargon in a Thai UI |
| 3 | User Control and Freedom | 3 | clear-customer, remove-split, uncheck-booking present; `alert()` blocks the thread; no focus management |
| 4 | Consistency and Standards | 2 | **One Action Color violation**: primary buttons + active method + links use `bg-primary-600` (brand violet) instead of the indigo action color. Semantic color mix: `text-green-600` / `emerald-600` / `orange-600` for the same "discount/positive" meaning. `text-2xl` h1 vs sale's `text-xl`. `✕` vs `ลบ` |
| 5 | Error Prevention | 3 | submit disabled on cash<total / split mismatch / total<=0; points clamp; coupon validate. No taxId 13-digit validation |
| 6 | Recognition Rather Than Recall | 3 | placeholders, "สูงสุด" button, points hint, member display; customer search is not a proper listbox (no ARIA, no keyboard nav); pay method held only in memory |
| 7 | Flexibility and Efficiency | 3 | cash denominations + split + points-max good; no exact-cash "พอดี" button (sale has it); no keyboard shortcuts |
| 8 | Aesthetic and Minimalist Design | 3 | clean max-w-3xl card stack, radii already 8px; reasonably calm |
| 9 | Error Recovery | 2 | `alert((await r.json()).error)` is generic and thread-blocking; no `window.open` popup-blocker handling (sale screen guides the user, this one silently fails); no inline retry |
| 10 | Help and Documentation | 1 | none — VAT INCLUDED/EXCLUDED, service charge, and split semantics unexplained |
| **Total** | | **26/40** | **Acceptable — significant gaps vs the now-polished sale screen** |

## Priority Fixes

**P1 (high):**
1. **One Action Color** — swap `bg-primary-600` → `bg-indigo-500 hover:bg-indigo-600` on the submit button (line 371), coupon "ใช้" (232), and active method buttons (329). Links `text-primary-600` (299, 361) are acceptable as brand accents but the primary verb must be indigo.
2. **Error recovery** — replace `alert()` (163) with `toast.error`; add popup-blocker guidance on `window.open` (165) like the sale screen; add `toast.success` on completion.
3. **Accessibility** — no `focus-visible` rings on any control; add them to match the sale screen; add `aria-pressed` to method buttons and `aria-label` to the `✕` split-remove.

**P2 (medium):**
4. `tabular-nums` on all money columns; normalize positive/discount color to one token (`emerald-600`); `text-2xl` h1 → `text-xl`.
5. Exact-cash "พอดี" button in the cash section.
6. VAT/SC help tooltips (mirror the sale screen treatment).

## Anti-Patterns Verdict

Detector clean, but the **Gradient Quarantine** is respected only narrowly — no gradient, yet the screen leans on brand violet (`primary-600`) for the working action color, which the design system reserves for brand moments while the product action color is indigo. This is the same gap the sale screen had before colorize. Bringing checkout in line with sale would lift it to ~36-38/40.
