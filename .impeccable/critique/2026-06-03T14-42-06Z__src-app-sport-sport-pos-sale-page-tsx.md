---
target: sport/pos/sale
total_score: 37
p0_count: 0
p1_count: 0
timestamp: 2026-06-03T14-42-06Z
slug: src-app-sport-sport-pos-sale-page-tsx
---
# Critique: POS "Sale" screen (sport/pos/sale) — re-run

Files: `src/app/(sport)/sport/pos/sale/page.tsx`, `src/app/(sport)/sport/pos/sale/sale-client.tsx`. Re-critique after the layout/harden/colorize/typeset/polish action plan. Checkout is a separate screen, out of scope. Verification: `npx tsc --noEmit` only (POS routes are auth-gated: CASHIER/ADMIN + open shift, no browser preview possible). Detector scan (`detect.mjs --json`) returned `[]` clean.

## Design Health Score

| # | Heuristic | Score | Δ | Key Issue / What Changed |
|---|-----------|-------|---|--------------------------|
| 1 | Visibility of System Status | 4 | +2 | sonner toast.success/error on pay, create-tab, add-item; busy states ("...", "กำลังบันทึก..."); change shown live; HELD badge; "• มีการปรับ" indicator when extras collapsed |
| 2 | Match System / Real World | 4 | +1 | Thai-first copy, ฿ symbols, tabular-nums money columns, "พอดี" exact-change matches cashier mental model; residual product-noun English (Subtotal/TOTAL/Coupon) kept intentionally |
| 3 | User Control and Freedom | 4 | +2 | Escape closes tab form, ยกเลิก buttons, ✕ close, aria-labelled remove/void, optimistic rollback on failure; native confirm kept for void (matches sibling POS screens) |
| 4 | Consistency and Standards | 3 | +1 | One Action Color now enforced (indigo-500 primary / gray secondary across all verbs), unified focus rings; residual radii drift (rounded-xl tiles, rounded-2xl cart vs 8px product spec) deferred as app-wide change |
| 5 | Error Prevention | 4 | +2 | pay disabled when cash<total / cart empty; checkout disabled when no items or HELD; stock-out disables tiles + "หมดสต๊อก"; "เลือก Tab ก่อน" guard |
| 6 | Recognition Rather Than Recall | 4 | +2 | aria-labels on all controls; example placeholders ("โต๊ะ 5"/"ทีมแดง"); max-points hint; collapsed-extras indicator; "พิมพ์บิลล่าสุด" recall path |
| 7 | Flexibility and Efficiency | 4 | +2 | barcode scan+Enter, "พอดี" exact-cash + denomination quick keys, Quick Sale fast path, collapsible extras keeps the common path clean |
| 8 | Aesthetic and Minimalist Design | 4 | +2 | QuickSaleModal restructured into a flex drawer (header/cart/extras-disclosure/footer); advanced fields hidden behind disclosure by default; flat-by-default surfaces |
| 9 | Error Recovery | 4 | +2 | actionable toast errors ("ตรวจ popup blocker แล้วกด พิมพ์บิลล่าสุด", 8s), inline coupon error msg, optimistic rollback |
| 10 | Help and Documentation | 2 | +1 | contextual hints/placeholders added ("กดสินค้าด้านหลังเพื่อเพิ่ม"); still no real help layer, VAT/SC modes unexplained |
| **Total** | | **37/40** | **+17** | **Strong — minor polish remaining** |

## Trend

20/40 → 37/40 (+17). P0: 1 → 0. P1: 2 → 0.

## Remaining (deferred, not regressions)

- **Radii normalization** (heuristic 4): rounded-xl/2xl on tiles/cart vs 8px product spec. Should be an app-wide pass across all POS screens, not a one-file change.
- **Qty stepper in tab cart** (flexibility): blocked — no PATCH endpoint at `api/sport/pos/tabs/[id]/items/[itemId]` (only DELETE). Feature, not polish.
- **Full listbox ARIA + arrow-key nav** on customer search (recognition): larger interaction work.
- **Help layer** (heuristic 10, still 2): no tooltips explaining VAT/SC modes.

## Anti-Patterns Verdict

Detector clean. One Action Color Rule satisfied (single indigo primary verb per region). Gradient Quarantine respected (no brand gradient on POS). Flat-by-default respected (shadow only on drawer overlay). 14px Workhorse respected.
