---
target: sport/pos/stock
total_score: 37
p0_count: 0
p1_count: 0
timestamp: 2026-06-03T15-55-16Z
slug: src-app-sport-sport-pos-stock-stock-client-tsx
---
# Critique (post-fix) — sport/pos/stock (stock-client.tsx)

Re-critique after applying fix set. Auth-gated — static analysis + tsc (exit 0).

## Design Health Score: 37/40

| Dimension | Score | Notes |
|---|---|---|
| Color discipline | 5/5 | submit indigo single primary; stock-take demoted neutral; modal save indigo (own context); badges emerald/red/neutral |
| Typography | 5/5 | h1 `text-xl` workhorse |
| Spacing/layout | 4/5 | unchanged, sound |
| Hierarchy | 4/5 | clear primary verb per context |
| Numerics | 5/5 | tabular-nums on qty/delta/count/movement |
| State feedback | 5/5 | toast.error/success; confirm() kept for bulk adjust |
| A11y | 5/5 | focus-visible rings on inputs + all buttons |
| Polish | 4/5 | inline `<style>` removed → inherits global `.input` w/ focus ring |

## Applied
- submit `bg-primary-600` → `bg-indigo-500 hover:bg-indigo-600`
- stock-take open button `bg-emerald-600` → neutral gray
- modal save → indigo (modal is own action context)
- alert() x5 → toast; confirm() bulk adjust kept
- deleted inline `<style>` `.input`
- movement badges blue/orange/green → emerald/red/neutral (+dark)
- tabular-nums: in-system qty, count input, delta, movement qty
- green → emerald on delta/qty
- focus-visible rings throughout
- h1 text-2xl → text-xl

## Remaining (-3)
- modal table rows lack hover state (minor)
- no empty-state when products=[] in stock-take modal
- count input width fixed w-20 (ok)
