---
target: sport/pos/sale
total_score: 20
p0_count: 1
p1_count: 2
timestamp: 2026-06-03T14-10-24Z
slug: src-app-sport-sport-pos-sale-page-tsx
---
# Critique: POS "Sale" screen (sport/pos/sale)

Files: `src/app/(sport)/sport/pos/sale/page.tsx`, `src/app/(sport)/sport/pos/sale/sale-client.tsx`. Product grid, cart, and QuickSaleModal are all inline in sale-client.tsx. Checkout is a separate screen, out of scope.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Optimistic add good; no in-app success/sync state, payment only shows text on button |
| 2 | Match System / Real World | 3 | Thai-first, but Subtotal/Coupon/TOTAL/ref no English in Thai UI |
| 3 | User Control and Freedom | 2 | Void has confirm+undo; but native prompt/alert/confirm block thread, no undo on completed sale |
| 4 | Consistency and Standards | 2 | Radii (lg/xl/2xl), font sizes, button colors all inconsistent; delete is "ลบ" vs "✕" |
| 5 | Error Prevention | 2 | pay disabled when cash<total, stock guard; but free-number discount/qty, no clamps |
| 6 | Recognition Rather Than Recall | 2 | Tab is native <select>; barcode needs remembering to focus search; mode held in memory |
| 7 | Flexibility and Efficiency | 2 | Barcode-on-Enter + cash denominations good; no hotkeys for core verbs, no exact-cash |
| 8 | Aesthetic and Minimalist Design | 2 | QuickSaleModal crams a full checkout into a 384px column |
| 9 | Error Recovery | 2 | Generic alert() errors, no guidance; optimistic rollback well done |
| 10 | Help and Documentation | 1 | None — no tooltips, no hints, VAT/SC modes unexplained |
| **Total** | | **20/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**LLM assessment:** Reads as AI-generated to a trained eye, though more functional than typical slop. Tells: stock "products-left / cart-right" POS layout with zero personality; emoji as iconography (📦 🔗 ↳ ✕) mixed with text; inconsistent radii grab-bag (lg/xl/2xl) drifting toward marketing aesthetic.

DESIGN.md rule checks:
- **One Action Color Rule — VIOLATED.** Multiple competing colored primaries: `bg-primary-600` "+ Tab ใหม่" + `bg-emerald-600` "Quick Sale" side by side (lines 147-148), plus indigo Checkout (line 271), plus more primary-600 verbs in modal. No single eye anchor.
- **Gradient Quarantine Rule — PASS.** No violet→lilac/pink. (emerald+amber dilute the one-color rule though.)
- **Flat-By-Default Rule — borderline.** QuickSaleModal `shadow-2xl` at rest (line 406) + 2px emerald border — heavy, though it's an overlay.
- **14px Workhorse Rule — VIOLATED both ways.** Stock counts `text-[10px]` (203), labels `text-[10px]` (249,539,553), hold buttons `text-[11px]` — sub-legible at counter distance.

**Deterministic scan:** `detect.mjs` returned `[]` (exit 0, clean). The bundled detector scans rendered markup for structural anti-patterns; it does not parse Tailwind className strings in tsx, so it found nothing here. Absence of detector findings is not a clean bill — the substantive issues are in the LLM review.

**Visual overlays:** Not available. POS sale screen is auth-gated (CASHIER/ADMIN + open shift + DB); no dev server was started and no browser injection was attempted. Fallback: source-based review only.

## Overall Impression

A functional-but-rough cashier terminal. The transaction bones work (optimistic add+rollback, barcode scan, cash tendering) but craft and system discipline don't. Biggest opportunity: the QuickSaleModal is doing a full checkout screen's job inside a 384px floating box — it's the root of the cognitive-load and hierarchy failures on a screen whose whole reason for existing is speed.

## What's Working

1. **Optimistic add with correct rollback** (sale-client.tsx:68-88): item + stock appear instantly, revert on API failure, temp-id reconciliation. Right pattern for a high-frequency terminal.
2. **Barcode-scan-to-add on Enter** (168-177): exact-SKU match + stock check + routes to correct cart. Real accelerator for the fixed-terminal+scanner context.
3. **Cash tendering** (559-570): denomination shortcuts + live ทอน/change, pay disabled until cash≥total (576). The one place "speed is the feature" is embodied.

## Cognitive Load

5 of 8 checklist items FAIL, 3 partial — the most serious category for a "speed is the feature" terminal. Single-focus fails (two parallel mental models: Tab flow vs Quick Sale flow; a product tap routes differently based on hidden `quickOpen` state, line 190). Grouping ≤4 fails hard (QuickSaleModal exposes ~12+ distinct groups in one column). One-thing-at-a-time fails (payment shown simultaneously with optional coupon/tax/signup). Working memory fails (tab identity lives only in a <select> label).

## Priority Issues

**[P0] No in-app payment confirmation; success depends on a popup.** `pay()` calls `window.open(...print, '_blank')` then closes the modal (400-401), with no success state/change/receipt in-app. window.open after `await` is commonly popup-blocked; if blocked the cashier sees the modal vanish with zero confirmation money was recorded — risk of re-charge/panic. **Fix:** in-modal success panel ("ชำระสำเร็จ — ทอน ฿X", invoice #, explicit พิมพ์บิล + ขายต่อ buttons); print from explicit click so it survives blockers; reset cart only after. → `harden`

**[P1] QuickSaleModal overloads one 384px column with a full checkout.** Cart+customer+new-customer+tax invoice+coupon+SC+VAT+points+payment+cash stacked (405-579), much at 10-11px. Violates ≤4-options and one-thing-at-a-time. A ฿60 water sale must skip past coupon/points/tax to reach pay. **Fix:** full panel/screen, default to minimal cash path (items→method→tender→pay), collapse extras behind one disclosure. → `layout` / `distill`

**[P1] Two competing colored primary buttons violate the One Action Color Rule.** `bg-primary-600` + `bg-emerald-600` side by side in toolbar (147-148); more primary-600 verbs in modal. No eye anchor for the 100×/day muscle-memory path. **Fix:** one indigo primary verb (Pay/Checkout); demote +Tab and Quick Sale to neutral gray; in modal only จ่าย is indigo. → `colorize` / `quieter`

**[P2] Native prompt()/alert()/confirm() for core flows.** New tab name via prompt() (50); errors via alert() (55,62,78,94,398); void via confirm() (106). OS dialogs block the thread, ignore dark mode, read as broken on a money terminal. **Fix:** in-app modal/toast components. → `harden`

**[P2] Sub-legible 10-11px text on a fixed terminal.** Stock counts (203), merge/team/VAT/earn labels (249,539,553) at text-[10px]; hold buttons text-[11px]. Violates 14px Workhorse; stock-remaining is decision-critical yet smallest text. **Fix:** standardize body to 14px, stock count ≥12px. → `typeset`

## Persona Red Flags

**Alex (impatient power-user cashier, 100×/day):** No keyboard shortcuts for core verbs (only Enter-to-scan, 168). Tab switching is a native <select> (137) — click, read list, click. Mode ambiguity: product tap routes to quick vs tab cart by hidden state (190). No bulk qty on grid (6 waters = 6 taps in tab mode, 74); tab cart has no qty stepper, only "ลบ" (243). Cash field not auto-focused, no exact/พอดี button.

**Sam (accessibility):** Icon-only buttons with no aria-label (✕ at 409,420,474; 📦 at 198). No visible focus styles anywhere (only hover:border-primary-500, 192) — keyboard user can't tell what's focused; flat-by-default permits a focus shadow, unused. Color-only status (amber พัก chip 220, emerald booking link 229, active payment method by bg fill only 556). Custom customer-search dropdown (434-446) is a div of buttons, no role=listbox/ARIA/arrow-keys. Contrast risk: text-gray-400 stock (203), text-gray-300 📦 (198) below AA, worsened by 10px.

## Minor Observations

- disabled:opacity-40 tiles (192) still look tappable; weak disabled state with no focus ring.
- "พิมพ์บิลล่าสุด" extra fetch (150-157) surfaces generic alert with no recovery.
- Coupon force-uppercase on change (508) + uppercase style (511) redundant.
- change computed (366) but ทอน shown only in CASH mode; no reassurance line for QR/TRANSFER/CARD.
- Merged-tab children render read-only, no per-item void (250-257) — may confuse.
- VAT/SC fetched per modal open (324); on failure sale silently proceeds VAT NONE (catch swallows, 332) — financial edge case, needs visible indicator.

## Questions to Consider

1. Why two sale flows (Tab + Quick Sale) on one screen? If most counter sales are walk-up cash, why isn't Quick Sale the default full-screen mode and Tabs secondary?
2. If "speed is the feature," what's the actual tap count for one-item-cash-exact? ~4+ taps plus parsing a 12-group modal. What gets that to 2?
3. Should a cash system's success ever depend on window.open surviving a popup blocker?
4. Would tappable tab cards (item count + total each) eliminate the <select> recall problem?
5. Is there any enforced component layer (Button/Card/Input), or is every POS screen re-implementing primitives by hand — the root cause of the consistency failures?
