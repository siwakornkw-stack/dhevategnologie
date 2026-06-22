---
target: sport/pos/settings
total_score: 31
p0_count: 0
p1_count: 3
timestamp: 2026-06-03T15-57-00Z
slug: c-app-sport-sport-pos-settings-settings-client-tsx
---
# Critique — sport/pos/settings (settings-client.tsx)

POS settings form (single column, sectioned). Auth-gated — static analysis only. detect.mjs → [].

## Design Health Score: 31/40

| Dimension | Score | Notes |
|---|---|---|
| Color discipline | 3/5 | submit `bg-primary-600` violet → indigo |
| Typography | 4/5 | h1 `text-2xl` workhorse drift |
| Spacing/layout | 5/5 | sectioned form, clean |
| Hierarchy | 4/5 | section labels clear, single primary |
| Numerics | 4/5 | number inputs (no display columns) — n/a mostly |
| State feedback | 2/5 | `alert()` x2 (save success + error) → toast |
| A11y | 3/5 | no focus-visible rings on submit/checkboxes |
| Polish | 3/5 | inline `<style>` `.input` duplicates global, no focus ring |

## P1 (high)
1. submit `bg-primary-600` (line 138) → `bg-indigo-500 hover:bg-indigo-600` + focus ring.
2. `alert()` (lines 59, 60) → `toast.error` / `toast.success`.
3. inline `<style>` `.input` (line 141) → delete, inherit global.

## P2 (medium)
4. h1 `text-2xl` → `text-xl` (line 70).
5. focus-visible ring on submit.

## Strengths
- Clean sectioned layout (ร้าน / VAT / Stock-Shift / Points / SC / Printer).
- Helper labels explain each numeric field well.
- No native prompt(); only the two alert() to swap.
