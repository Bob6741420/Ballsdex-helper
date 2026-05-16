# Calculator Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Calculator 🧮" tab to the Values modal where users type ball names (with abbreviation shortcuts) one per line, each resolves to the best match, and a totals panel sums all special values across all selected balls.

**Architecture:** Single self-contained `CalculatorTab` React component added to `index.html`. Uses the existing `scoreMatch`, `BALL_SPECIALS`, `SPECIAL_KEYS`, `SPECIAL_LABELS`, `TRADE_VALUES`, and `specialChipColor` globals. No new files or state lifted to `App`.

**Tech Stack:** React (CDN, no JSX transpiler — uses `React.useState`, `React.useMemo`), Tailwind CSS, single-file `index.html`.

---

### Task 1: Add `CalculatorTab` component

**Files:**
- Modify: `index.html` — add component between `scoreMatch` function and `ValuesModal` component

- [ ] **Step 1: Locate insertion point**

Find line ~2538 in `index.html` — the line that starts `function ValuesModal`. The `CalculatorTab` component will be inserted immediately before this function.

- [ ] **Step 2: Insert `CalculatorTab` component**

Insert this entire block immediately before `function ValuesModal`:

```jsx
    function CalculatorTab() {
      const [text, setText] = React.useState('');

      const ABBR = {ko:'kingdom of',e:'empire',r:'republic of',d:'dynasty',k:'kingdom',u:'union',c:'confederation'};

      function expandAbbr(q) {
        return q.toLowerCase().trim().split(/\s+/).map(w => ABBR[w] || w).join(' ');
      }

      function bestMatch(line) {
        const expanded = expandAbbr(line);
        let best = null, bestScore = -1;
        for (const row of BALL_SPECIALS) {
          const s = scoreMatch(expanded, row[0]);
          if (s > bestScore) { bestScore = s; best = row; }
        }
        return bestScore >= 0 ? best : null;
      }

      const resolved = React.useMemo(() => {
        return text.split('\n').filter(l => l.trim()).map(line => {
          const row = bestMatch(line.trim());
          if (!row) return { raw: line, match: null };
          const name = row[0];
          const specials = SPECIAL_KEYS
            .map((key, i) => ({ key, label: SPECIAL_LABELS[key], value: row[i + 1] }))
            .filter(s => s.value !== null);
          const tradeEntry = TRADE_VALUES.find(t => t.name === name);
          return { raw: line, match: name, specials, normalValue: tradeEntry ? tradeEntry.value : null };
        });
      }, [text]);

      const matched = resolved.filter(r => r.match);

      const totals = React.useMemo(() => {
        const sums = {};
        for (const r of matched) {
          for (const s of r.specials) {
            if (!sums[s.key]) sums[s.key] = { key: s.key, label: s.label, sum: 0, count: 0 };
            sums[s.key].sum += parseFloat(s.value);
            sums[s.key].count++;
          }
        }
        return Object.values(sums).sort((a, b) => b.sum - a.sum);
      }, [matched]);

      const normalTotal = React.useMemo(() => {
        return matched.reduce((acc, r) => acc + (r.normalValue ? parseFloat(r.normalValue) || 0 : 0), 0);
      }, [matched]);

      return (
        <div className="p-3 space-y-3">
          <textarea
            className="inp w-full text-sm resize-none"
            rows={4}
            placeholder={"One ball per line, e.g.\nroman e\nko scotland\nbrit e"}
            value={text}
            onChange={e => setText(e.target.value)}
            style={{fontFamily:'inherit'}}
          />

          {resolved.map((r, i) => (
            <div key={i} className="px-3 py-2 rounded-xl" style={{background:'var(--s2)'}}>
              {r.match ? (
                <>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-lg"
                          style={{background:'rgba(16,185,129,.15)',border:'1px solid rgba(16,185,129,.4)',color:'#34d399'}}>
                      {r.match}
                    </span>
                    {r.normalValue && <span className="text-xs text-slate-500">{r.normalValue}</span>}
                  </div>
                  {r.specials.length > 0
                    ? <div className="flex flex-wrap gap-1">
                        {r.specials.map(s => {
                          const vc = specialChipColor(s.value);
                          return (
                            <span key={s.key} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-lg border"
                                  style={{background:vc.bg,borderColor:vc.border,color:vc.color}}>
                              {s.label}: {s.value}
                            </span>
                          );
                        })}
                      </div>
                    : <p className="text-xs text-slate-600">No special values</p>
                  }
                </>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-lg"
                      style={{background:'rgba(245,158,11,.15)',border:'1px solid rgba(245,158,11,.4)',color:'#fcd34d'}}>
                  No match: {r.raw}
                </span>
              )}
            </div>
          ))}

          {matched.length > 0 ? (
            <div className="rounded-xl p-3" style={{background:'var(--s2)',border:'1px solid var(--border)'}}>
              <p className="text-xs font-semibold text-white mb-2">
                Total across {matched.length} ball{matched.length !== 1 ? 's' : ''}
              </p>
              {normalTotal > 0 && (
                <div className="mb-2">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg border"
                        style={{background:'rgba(245,158,11,.12)',borderColor:'rgba(245,158,11,.35)',color:'#fcd34d'}}>
                    {+normalTotal.toPrecision(3)} T1s (normal)
                  </span>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {totals.map(t => {
                  const vc = specialChipColor(String(t.sum));
                  return (
                    <div key={t.key} className="flex flex-col items-center gap-0.5">
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-lg border"
                            style={{background:vc.bg,borderColor:vc.border,color:vc.color}}>
                        {t.label}: {+t.sum.toPrecision(4)}
                      </span>
                      <span className="text-xs text-slate-600">{t.count}/{matched.length}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : resolved.length === 0 && (
            <p className="text-center text-slate-600 text-sm py-4">Add balls above to see totals.</p>
          )}
        </div>
      );
    }
```

---

### Task 2: Wire `CalculatorTab` into `ValuesModal`

**Files:**
- Modify: `index.html` — three small edits inside `ValuesModal`

- [ ] **Step 1: Add 'calc' to the tabs array**

Find this line (~line 2598):
```js
      const tabs = [['specials','By Ball ⚽'],['normals','Normals'],['types','Special Types']];
```

Replace with:
```js
      const tabs = [['specials','By Ball ⚽'],['normals','Normals'],['types','Special Types'],['calc','Calculator 🧮']];
```

- [ ] **Step 2: Update `resultCount` to handle 'calc' tab**

Find this line (~line 2599):
```js
      const resultCount = tab === 'normals' ? normalResults.length : tab === 'specials' ? ballSpecialResults.length : typeResults.length;
```

Replace with:
```js
      const resultCount = tab === 'normals' ? normalResults.length : tab === 'specials' ? ballSpecialResults.length : tab === 'types' ? typeResults.length : null;
```

- [ ] **Step 3: Update the result count display in the header**

Find this snippet in the header (~line 2610):
```jsx
                <p className="text-xs mt-0.5 text-slate-600">Nile's List · May 2026 · {resultCount} results</p>
```

Replace with:
```jsx
                <p className="text-xs mt-0.5 text-slate-600">{resultCount !== null ? `Nile's List · May 2026 · ${resultCount} results` : 'Calculator'}</p>
```

- [ ] **Step 4: Hide the search input on 'calc' tab**

Find this line in the search area (~line 2616):
```jsx
              <input className="inp text-sm" placeholder="Type any ball name…" value={q} onChange={e=>setQ(e.target.value)} autoFocus />
```

Replace with:
```jsx
              {tab !== 'calc' && <input className="inp text-sm" placeholder="Type any ball name…" value={q} onChange={e=>setQ(e.target.value)} autoFocus />}
```

- [ ] **Step 5: Render `CalculatorTab` inside the results div**

Find the closing comment and tag for the Special Types tab block (~line 2688–2689):
```jsx
              {tab === 'types' && typeResults.length === 0 && (
                <div className="text-center py-12 text-slate-600 text-sm">No match for "{q}"</div>
              )}
```

Immediately after this block (before the closing `</div>` of the results area), add:
```jsx
              {/* ── Calculator tab ── */}
              {tab === 'calc' && <CalculatorTab />}
```

---

### Task 3: Verify and commit

- [ ] **Step 1: Open the app in a browser**

Open `index.html` directly (or via live server). Click the Values button to open the modal. Confirm a new "Calculator 🧮" tab appears alongside the existing tabs.

- [ ] **Step 2: Test abbreviation matching**

Type the following in the calculator textarea (one per line) and verify the resolved matches:
- `roman e` → Roman Empire
- `ko scotland` → Kingdom of Scotland  
- `brit e` → British Empire
- `soviet u` → Soviet Union
- `mongol e` → Mongol Empire

Each should show a green chip with the matched name and a row of colored special value chips.

- [ ] **Step 3: Test totals panel**

With at least 2 balls entered and matched, scroll to the bottom. Confirm:
- "Total across N balls" header appears
- Each special type chip shows the summed value
- "N/M balls" count appears under each chip
- Normal T1 value total appears if any matched balls have a normal value

- [ ] **Step 4: Test no-match state**

Type `xyzabc` on its own line. Confirm a yellow "No match: xyzabc" chip appears and that ball is excluded from totals.

- [ ] **Step 5: Test empty state**

Clear the textarea. Confirm "Add balls above to see totals." placeholder appears.

- [ ] **Step 6: Commit and push**

```bash
git add index.html
git commit -m "Add Calculator tab with abbreviation matching and value totals"
git push
```
