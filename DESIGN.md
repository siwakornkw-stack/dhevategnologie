---
name: DhevaSuite
description: Clean, fast booking + POS system for sports facilities — function-first product UI.
colors:
  primary: "#7a5af8"
  primary-50: "#f4f3ff"
  primary-100: "#ebe9fe"
  primary-300: "#bdb4fe"
  primary-600: "#6938ef"
  primary-800: "#4a1fb8"
  action-indigo: "#6366f1"
  action-indigo-hover: "#4f46e5"
  brand-gradient-from: "#725cff"
  brand-gradient-to: "#b5b1ff"
  accent-pink: "#ff57d5"
  success: "#12b76a"
  error: "#f04438"
  error-deep: "#d92d20"
  surface-light: "#f9fafb"
  surface-dark: "#171f2e"
  surface-dark-raised: "#1a2231"
  border-light: "#d1d5db"
  border-dark: "#374151"
  text-strong: "#1f2937"
  text-dark-mode: "#f9fafb"
typography:
  display:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 600
    lineHeight: "52px"
    letterSpacing: "normal"
  headline:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: "1.3"
  title:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "1.4"
  body:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "1.5"
  label:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "1.25rem"
rounded:
  md: "8px"
  pill: "9999px"
  card: "20px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "20px"
components:
  button-primary:
    backgroundColor: "{colors.action-indigo}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.action-indigo-hover}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "#e5e7eb"
    textColor: "{colors.text-strong}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-gradient:
    backgroundColor: "{colors.brand-gradient-from}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
  input-pos:
    backgroundColor: "#ffffff"
    textColor: "{colors.text-strong}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  input-pill:
    backgroundColor: "#ffffff"
    textColor: "{colors.text-strong}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
    height: "48px"
---

# Design System: DhevaSuite

## 1. Overview

**Creative North Star: "The Clean Counter"**

DhevaSuite is a well-run counter at a busy sports venue: the surface is clear, every tool is within reach, and nothing sits on the counter that doesn't earn its place. Customers grab a slot and pay; cashiers ring up sales between rallies; admins set the rules. The interface serves all three by getting out of the way. It reads fast, points at the next action, and stays quiet until you need it.

This is a **product** system, not a marketing surface. Function comes first: solid fills, predictable rectangles with gently softened corners (8px), and high-contrast text on calm neutrals. Color is used to direct, not to decorate — one action color carries the primary verb on any screen, and the rest of the palette stays out of the way. Depth is conveyed by contrast and tonal layering, not by piling on shadows.

The system explicitly rejects the **generic AI-starter / SaaS-template look** it inherited: violet hero glows, floating animated blobs, and decorative gradient flourishes belong to the legacy marketing pages under `(site)/`, not to the product. When in doubt, the product screen is flatter, calmer, and more literal than a landing page would be.

**Key Characteristics:**
- Function-first: the primary action is always the most prominent thing on screen.
- Calm neutrals, one decisive action color.
- Softly rounded rectangles (8px), not pills, in the product surface.
- Flat by default; elevation is a response to state, never ambient noise.
- First-class dark mode at AA contrast, not an afterthought.

## 2. Colors

A restrained, neutral-dominant palette where a single indigo action color does the directing. Violet is the inherited brand hue; in the product it recedes to accents and links.

### Primary
- **Action Indigo** (#6366f1): The product's working action color — primary buttons, focus rings, active states across POS and admin. Hover deepens to **Indigo Deep** (#4f46e5). This, not the brand violet, is the color a cashier's eye should land on.
- **Brand Violet** (#7a5af8): The inherited brand hue (token `primary-500`, scale `primary-50` #f4f3ff → `primary-800` #4a1fb8). Used for brand moments, links, and pill-style marketing inputs' focus rings (`primary-300` #bdb4fe). Recedes in dense product screens.

### Secondary
- **Brand Gradient** (#725cff → #b5b1ff): The legacy violet gradient. Reserved for marketing CTAs under `(site)/` and a handful of admin form submit buttons. Do not introduce it onto POS or data-dense screens.
- **Accent Pink** (#ff57d5): Appears only inside legacy gradient overlays (`tab-img-bg`, gradient borders). Not a product color; do not extend its use.

### Tertiary
- **Success Green** (#12b76a): Confirmations, paid status, positive deltas.
- **Error Red** (#f04438), deepening to **Error Deep** (#d92d20): Validation errors, destructive actions, failed payments.

### Neutral
- **Surface Light** (#f9fafb): Default app background in light mode (`bg-gray-50`).
- **Surface Dark** (#171f2e) and **Surface Dark Raised** (#1a2231): Dark-mode page background and raised panels respectively.
- **Border** (#d1d5db light / #374151 dark): Input strokes, dividers, card edges.
- **Text Strong** (#1f2937 light / #f9fafb dark): Primary text.

### Named Rules
**The One Action Color Rule.** On any product screen, the indigo action color marks exactly one primary verb. Secondary actions are neutral gray. If two buttons both shout indigo, one of them is wrong.

**The Gradient Quarantine Rule.** The violet→lilac gradient and pink accent are quarantined to `(site)/` marketing. They are forbidden on POS, admin tables, and booking flows. A gradient on a cashier screen is a bug.

## 3. Typography

**Display / Body Font:** Onest (with system-ui, sans-serif fallback)
**Label/Mono Font:** none distinct — Onest carries everything.

**Character:** Onest is a single, neutral geometric sans doing all the work. One family, weighted from 400 to 600, keeps the product calm and legible at Thai text density. No serif, no display face, no font-switching.

### Hierarchy
- **Display** (600, 44px / 52px line-height): Page-level marketing headlines and the largest dashboard numbers. Token `text-title-lg`.
- **Headline** (600, ~28px, 1.3): Section headers, modal titles.
- **Title** (600, ~18px, 1.4): Card titles, table section labels.
- **Body** (400, 14px, 1.5): Default product text, table cells, form values. This is the workhorse size.
- **Label** (500, 12px, 1.25rem): Field labels, chips, metadata, table column heads.

### Named Rules
**The 14px Workhorse Rule.** Product body text is 14px. Booking and POS screens are data-dense; oversized body copy wastes the counter. Reserve larger sizes for true headlines and dashboard figures.

## 4. Elevation

Flat by default. Surfaces sit at rest with no shadow; depth comes from tonal contrast (`surface-light` vs white cards, `surface-dark` vs `surface-dark-raised`) and 1px borders. Shadows are a **response to state**, not ambient decoration — they appear on hover, on raised overlays (modals, dropdowns, toasts), and around focus, then disappear.

### Shadow Vocabulary (when state calls for it)
- **theme-xs** (`box-shadow: 0px 1px 2px 0px rgba(16,24,40,0.05)`): Resting lift for inputs and small controls — the lightest hint.
- **theme-sm** (`box-shadow: 0px 8px 20px 0px rgba(0,0,0,0.08)`): Hovered cards, popovers.
- **theme-md** (`box-shadow: 0px 8px 30px 0px rgba(12,11,25,0.04)`): Floating panels.
- **theme-lg** (`box-shadow: 0px 12px 16px -4px rgba(16,24,40,0.08), 0px 4px 6px -2px rgba(16,24,40,0.03)`): Modals and the highest overlays.
- **ring** (`box-shadow: 0px 0px 0px 4px rgba(70,95,255,0.12)`): Focus ring, indigo-tinted.

### Named Rules
**The Flat-By-Default Rule.** A surface at rest carries no shadow. If a card has a drop shadow while doing nothing, remove it. Shadows mean "this is floating above the page right now" — hover, overlay, focus. Nothing else.

## 5. Components

### Buttons
- **Shape:** Softly rounded rectangle (8px, `rounded-lg`) in the product. Pills (9999px) belong to legacy marketing only.
- **Primary:** Solid Action Indigo (#6366f1) fill, white text, 8px 16px padding, weight 500. The single primary verb on screen.
- **Hover / Focus:** Background deepens to Indigo Deep (#4f46e5) over 0.15s; focus shows the indigo ring. Disabled drops to 50% opacity, `cursor: not-allowed`.
- **Secondary:** Neutral gray fill (#e5e7eb light / #374151 dark), strong text. For non-primary actions.
- **Gradient (legacy):** Violet→lilac pill with a position-shift hover. Marketing `(site)/` and a few admin forms only — do not add to product screens.

### Cards / Containers
- **Corner Style:** 8px for dense product cards; up to 20px (`card`) for marketing feature/benefit cards.
- **Background:** White on `surface-light`; `surface-dark-raised` (#1a2231) on dark.
- **Shadow Strategy:** Flat at rest (see Elevation). Border (#d1d5db / #374151) defines the edge.
- **Internal Padding:** 16px (`md`) default; 20px (`lg`) for roomier panels.

### Inputs / Fields
Two idioms, by surface:
- **POS / product input** (`.input`): White fill, 8px radius, gray-300 border, 0.875rem text. Focus shifts border to indigo and shows a 2px indigo ring (`rgba(99,102,241,0.2)`). Dark mode flips to #1f2937 fill / #374151 border with `color-scheme: dark`. **Use this everywhere in the product.**
- **Marketing pill input** (`Input` component): 48px tall, fully rounded (`rounded-full`), gray-300 border, `primary-300` focus ring. Legacy `(site)/` and auth pages.
- **Error:** Red border (#f04438) and red focus ring; helper text in red, 14px, 6px below the field.

### Navigation
- Onest body/label weights; default neutral text, hover to stronger text. Desktop dropdowns reveal on hover with a rotating arrow (≥1024px). Active state uses the indigo action color, not the brand violet.

## 6. Do's and Don'ts

### Do:
- **Do** make the single primary action the most prominent element using Action Indigo (#6366f1). One per screen (The One Action Color Rule).
- **Do** keep product surfaces flat at rest; add shadow only on hover, focus, or for true overlays (The Flat-By-Default Rule).
- **Do** use 8px (`rounded-lg`) corners and the 14px body size on POS, admin, and booking screens.
- **Do** ship every screen with light AND dark variants at AA contrast — dark mode is first-class.
- **Do** use neutral gray for secondary buttons so the primary verb stays unambiguous.

### Don't:
- **Don't** reproduce the **generic AI-starter / SaaS-template look**: no violet hero glows, no floating animated blobs, no decorative gradient flourishes on product screens.
- **Don't** put the brand violet→lilac gradient or accent pink (#ff57d5) on POS, admin tables, or booking flows (The Gradient Quarantine Rule). It belongs to `(site)/` only.
- **Don't** use fully-rounded pills for product buttons or inputs; pills read as marketing. Product uses 8px corners.
- **Don't** carry resting drop shadows on cards. A shadow with no state behind it is noise.
- **Don't** oversize body copy on data-dense screens; 14px is the workhorse (The 14px Workhorse Rule).
- **Don't** light up two indigo primary buttons in the same view.
