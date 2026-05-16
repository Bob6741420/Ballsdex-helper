# Calculator Tab Design

**Date:** 2026-05-16
**Status:** Approved

## Overview

A new "Calculator" tab added to the existing Values modal. The user types ball names (with abbreviation shortcuts) one per line, each line resolves to the best-matching ball, and a totals panel sums every special type across all selected balls.

## Abbreviation Expansion

Before fuzzy matching, expand known prefix abbreviations on each word of the query:

| Abbreviation | Expands to       |
|--------------|------------------|
| `ko`         | `kingdom of`     |
| `e`          | `empire`         |
| `r`          | `republic of`    |
| `d`          | `dynasty`        |
| `k`          | `kingdom`        |
| `u`          | `union`          |
| `c`          | `confederation`  |

Expansion is case-insensitive and word-boundary-aware. After expansion the query is passed through the existing `scoreMatch` function against all ball names in `BALLS`. The ball with the highest score (minimum threshold 0) is chosen as the match.

## Component: `CalculatorTab`

New React function component placed alongside the existing tab components in `index.html`.

### State

- `lines: string[]` — raw input lines from textarea (split on newline)
- Derived (via `useMemo`): `resolved[]` — for each line: `{ raw, match: Ball|null, specials: {key, label, value}[] }`

### Layout (top to bottom)

1. **Textarea** — placeholder "One ball per line, e.g. roman e". Grows with content (min 4 rows). Dark background matching existing inputs.

2. **Resolved list** — one row per non-empty input line:
   - Green chip with matched ball name if found, yellow "No match" chip if not
   - Compact row of special value chips (same style as Values > By Ball tab)
   - Normal trade value shown as a small badge

3. **Totals panel** — shown only when ≥1 ball resolved:
   - Header: "Total across N balls"
   - Grid of chips, one per special type that has at least one non-null value across resolved balls. Value = sum of all non-null values for that type.
   - Normal trade value total: sum of numeric T1 values (e.g. "0.5 T1s" → 0.5). Displayed as "X T1s". Balls with non-numeric values (e.g. "1 T1") contribute their full value separately noted.
   - Chips with zero contributing balls for a type are hidden entirely.
   - A small grey note beneath each chip: "N/M balls" showing how many of the M resolved balls had a value for that type.

## Integration

- Added as a new tab option `['calc', 'Calculator 🧮']` in the tabs array of the existing Values modal component (the one that already has `['specials','By Ball ⚽']`, `['normals','Normals']`, `['types','Special Types']`).
- Tab state already managed by `useState('specials')` — just add `'calc'` as a valid value.
- No new state lifted to `App`. `CalculatorTab` is self-contained.

## Abbreviation Expansion Function

```js
const ABBR = {
  ko: 'kingdom of', e: 'empire', r: 'republic of',
  d: 'dynasty', k: 'kingdom', u: 'union', c: 'confederation'
};

function expandAbbr(query) {
  return query.toLowerCase().trim()
    .split(/\s+/)
    .map(w => ABBR[w] || w)
    .join(' ');
}
```

## Value Summing

- All values in `BALL_SPECIALS` are stored as strings (e.g. `"1500"`). Parse with `parseFloat`.
- Null entries are skipped (treated as 0 for the sum but not counted toward the "N/M balls" numerator).
- Normal trade values in `TRADE_VALUES` use the pattern `"0.5 T1s"` or `"1 T1"`. Extract the leading number via `parseFloat` and sum. Display as `"X T1s"` rounded to 3 significant figures.

## Error States

- Empty lines in the textarea are ignored.
- Lines with no match show a yellow "No match: [raw input]" chip and are excluded from totals.
- If no balls are resolved yet, the totals panel is hidden and a placeholder message is shown: "Add balls above to see totals."
