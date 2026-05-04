# BallsDex Spawn Commander V3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add keyboard shortcuts, persistent stats/history, ball collection tracking, auto-copy toggle, and a tabbed right panel to the BallsDex Spawn Commander SPA.

**Architecture:** All changes are in `index.html` (single-file SPA). New state goes in the `App` component. Stats and collection persist via two new `localStorage` keys. The right panel gains a tab strip (Stats | History | Collection) below the content box. The left panel gets the phase clock moved into it. A `keydown` listener in `App` handles all shortcuts. The Collection tab is extracted as a `CollectionTab` component to allow its own `useState`/`useMemo` hooks. Sound and browser notifications are already implemented in the existing codebase (no changes needed).

**Tech Stack:** React 18 (CDN), Babel JSX, Tailwind CDN, Web Audio API, localStorage.

---

## File Map

| File | Change |
|------|--------|
| `index.html` | All changes — constants, App state, BallModal, IdentifierModal, layout |

---

### Task 1: Add storage constants and stats/collection state

**Files:**
- Modify: `index.html` — CONSTANTS block (~line 318) and App state (~line 2008)

- [ ] **Step 1: Add two new LS keys to CONSTANTS block**

Find the line:
```js
const LS_KEY = 'bdx-v2';
```
Add immediately after:
```js
const LS_STATS      = 'bdx-stats';
const LS_COLLECTION = 'bdx-coll';
```

- [ ] **Step 2: Add stats and collection state to App**

Find the existing state block in `App` (the group of `useState` calls starting with `lastCatch`). Add these two lines after `const [toast, setToast] = useState(null);`:

```js
const [stats,      setStats]      = useState(() => {
  try { const s = JSON.parse(localStorage.getItem(LS_STATS)||'{}');
        return { catches:0, misses:0, streak:0, bestStreak:0, history:[], ...s }; }
  catch(_) { return { catches:0, misses:0, streak:0, bestStreak:0, history:[] }; }
});
const [collection, setCollection] = useState(() => {
  try { return JSON.parse(localStorage.getItem(LS_COLLECTION)||'{}'); }
  catch(_) { return {}; }
});
const [rightTab,   setRightTab]   = useState('stats'); // 'stats'|'history'|'collection'
const [showKeys,   setShowKeys]   = useState(false);
const [autoCopy,   setAutoCopy]   = useState(() => {
  try { return localStorage.getItem('bdx-autocopy') === 'true'; } catch(_){ return false; }
});
```

- [ ] **Step 3: Add persistence effects for stats, collection, autoCopy**

Find the existing persist effect:
```js
useEffect(() => {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ lastCatch, serverName, memberCount, sentSize, sound })); } catch(_) {}
}, [lastCatch, serverName, memberCount, sentSize, sound]);
```
Add these three effects immediately after it:
```js
useEffect(() => {
  try { localStorage.setItem(LS_STATS, JSON.stringify(stats)); } catch(_) {}
}, [stats]);
useEffect(() => {
  try { localStorage.setItem(LS_COLLECTION, JSON.stringify(collection)); } catch(_) {}
}, [collection]);
useEffect(() => {
  try { localStorage.setItem('bdx-autocopy', String(autoCopy)); } catch(_) {}
}, [autoCopy]);
```

- [ ] **Step 4: Add refs needed by new features**

Find the existing refs block (lines with `lastSentR`, `cmdIdxR`, etc.). Add these refs at the end of that block:
```js
const lastCatchR         = useRef(lastCatch);
const lastIdentifiedNameR = useRef('');
const autoCopyR          = useRef(autoCopy);
```
Then find the group of `useEffect` calls that sync refs (e.g. `useEffect(() => { soundR.current = sound; }, [sound]);`). Add:
```js
useEffect(() => { lastCatchR.current = lastCatch; }, [lastCatch]);
useEffect(() => { autoCopyR.current  = autoCopy;  }, [autoCopy]);
```

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add stats/collection/shortcut state and storage keys"
```

---

### Task 2: Wire caught/miss to stats + replace feed with history

The current `caught` and `miss` handlers just call `reset()`. We extend them to append to `stats.history` and update counters. The existing `feed` state (in-memory last 8 sentences) is replaced by entries in `stats.history`.

**Files:**
- Modify: `index.html` — handlers (~line 2175), interval (~line 2106), state declarations (~line 2023)

- [ ] **Step 1: Remove the `feed` state declaration and `setFeed` calls**

Remove this line from the state block:
```js
const [feed,        setFeed]        = useState([]);
```

- [ ] **Step 2: Replace the caught handler**

Find:
```js
const caught = useCallback(() => { playSound('caught', soundR.current); reset(); }, [reset]);
```
Replace with:
```js
const caught = useCallback(() => {
  const el = Math.floor((Date.now() - lastCatchR.current) / 1000);
  playSound('caught', soundR.current);
  setStats(prev => {
    const newStreak = prev.streak + 1;
    const entry = { type:'caught', ts:Date.now(), elapsed:el };
    return { ...prev, catches: prev.catches+1, streak: newStreak,
             bestStreak: Math.max(prev.bestStreak, newStreak),
             history: [entry, ...prev.history].slice(0,200) };
  });
  reset();
}, [reset]);
```

- [ ] **Step 3: Replace the miss handler**

Find:
```js
const miss   = useCallback(() => reset(), [reset]);
```
Replace with:
```js
const miss = useCallback(() => {
  const el = Math.floor((Date.now() - lastCatchR.current) / 1000);
  setStats(prev => {
    const entry = { type:'miss', ts:Date.now(), elapsed:el };
    return { ...prev, misses: prev.misses+1, streak:0,
             history: [entry, ...prev.history].slice(0,200) };
  });
  reset();
}, [reset]);
```

- [ ] **Step 4: Update sentence generation in the interval to use stats history**

Inside the interval, find the sentence generation block that currently calls `setFeed`:
```js
const s = generateSentence(sizeR.current);
setSentence(s);
const ts = new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
setFeed(prev => [{ts, s, c:'', ph}, ...prev].slice(0,8));
```
Replace with:
```js
const sent = generateSentence(sizeR.current);
setSentence(sent);
if (autoCopyR.current) navigator.clipboard.writeText(sent).catch(()=>{});
const ts = new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
setStats(prev => ({
  ...prev,
  history: [{ type:'sentence', ts:Date.now(), wallTs:ts, elapsed:el, content:sent, ph }, ...prev.history].slice(0,200)
}));
```

Also find the command generation block that calls `setFeed`:
```js
const c = CMDS[cmdIdxR.current % CMDS.length];
cmdIdxR.current++;
setCommand(c);
const ts = new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
setFeed(prev => [{ts, s:'', c, ph}, ...prev].slice(0,8));
```
Replace with:
```js
const c = CMDS[cmdIdxR.current % CMDS.length];
cmdIdxR.current++;
setCommand(c);
const ts = new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
setStats(prev => ({
  ...prev,
  history: [{ type:'command', ts:Date.now(), wallTs:ts, elapsed:el, content:c, ph }, ...prev.history].slice(0,200)
}));
```

Note: `el` is already computed at the top of the interval: `const el = Math.floor((Date.now() - lastCatch) / 1000);` — verify this is set before the sentence/command blocks; if not, compute it there.

- [ ] **Step 5: Remove all remaining references to `feed` in JSX**

Search for `feed` in the render section. You will find a `{feed.length > 0 && ...}` section that renders the live feed. Remove the entire section — from `{/* Live feed */}` comment to the closing `)}`. It will be replaced by the History tab in Task 4.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: wire stats history to caught/miss/sentence, remove feed state"
```

---

### Task 3: Update BallModal with collection tracking

`BallModal` currently takes only `{ onClose }`. We add `collection` and `onToggleOwned` props plus filter UI.

**Files:**
- Modify: `index.html` — `BallModal` function (~line 1711), App render (~line 2436)

- [ ] **Step 1: Update BallModal signature and add filter state**

Find:
```js
function BallModal({ onClose }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const lq = q.trim().toLowerCase();
    return lq ? BALLS.filter(b => b.name.toLowerCase().includes(lq) || String(b.tier).includes(lq) || b.rarity.toLowerCase().includes(lq)) : BALLS;
  }, [q]);
```
Replace with:
```js
function BallModal({ onClose, collection, onToggleOwned }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all'); // 'all'|'owned'|'missing'
  const list = useMemo(() => {
    const lq = q.trim().toLowerCase();
    let base = lq ? BALLS.filter(b => b.name.toLowerCase().includes(lq) || String(b.tier).includes(lq) || b.rarity.toLowerCase().includes(lq)) : BALLS;
    if (filter === 'owned')   base = base.filter(b => collection?.[b.name]);
    if (filter === 'missing') base = base.filter(b => !collection?.[b.name]);
    return base;
  }, [q, filter, collection]);
  const ownedCount = useMemo(() => BALLS.filter(b => collection?.[b.name]).length, [collection]);
```

- [ ] **Step 2: Update BallModal header to show owned count**

Find inside BallModal's return:
```js
<p className="text-xs mt-0.5 text-slate-600">{list.length} of {BALLS.length} balls</p>
```
Replace with:
```js
<p className="text-xs mt-0.5 text-slate-600">{ownedCount} / {BALLS.length} owned · {list.length} shown</p>
```

- [ ] **Step 3: Add filter buttons below the search input**

Find inside BallModal:
```js
<div className="px-4 py-3 border-b" style={{borderColor:'var(--border)'}}>
  <input className="inp text-sm" placeholder="Search name, tier, rarity…" value={q} onChange={e=>setQ(e.target.value)} autoFocus />
</div>
```
Replace with:
```js
<div className="px-4 py-3 border-b space-y-2" style={{borderColor:'var(--border)'}}>
  <input className="inp text-sm" placeholder="Search name, tier, rarity…" value={q} onChange={e=>setQ(e.target.value)} autoFocus />
  <div className="flex gap-1">
    {[['all','All'],['owned','Owned'],['missing','Missing']].map(([v,lbl]) => (
      <button key={v} onClick={()=>setFilter(v)}
              className="btn px-3 py-1 text-xs"
              style={{background:filter===v?'var(--indigo-dim)':'var(--s2)',
                      border:`1px solid ${filter===v?'rgba(99,102,241,.4)':'var(--border)'}`,
                      color:filter===v?'#818cf8':'var(--fg2)'}}>
        {lbl}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 4: Add owned toggle to each ball row**

Find inside BallModal:
```js
{list.map(b => (
  <div key={b.name+b.tier} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors">
    <span className="font-mono text-xs w-10 text-center px-1.5 py-0.5 rounded text-slate-600" style={{background:'var(--s2)'}}>T{b.tier}</span>
    <span className="flex-1 text-sm text-white font-medium">{b.name}</span>
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg border ${rarityStyle(b.rarity)}`}>{b.rarity}</span>
  </div>
))}
```
Replace with:
```js
{list.map(b => {
  const owned = !!collection?.[b.name];
  return (
    <div key={b.name+b.tier} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors">
      <span className="font-mono text-xs w-10 text-center px-1.5 py-0.5 rounded text-slate-600" style={{background:'var(--s2)'}}>T{b.tier}</span>
      <span className="flex-1 text-sm text-white font-medium">{b.name}</span>
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg border ${rarityStyle(b.rarity)}`}>{b.rarity}</span>
      <button onClick={()=>onToggleOwned?.(b.name)}
              className="btn w-7 h-7 flex items-center justify-center text-sm flex-shrink-0"
              style={{background:owned?'var(--emerald-dim)':'var(--s2)',
                      border:`1px solid ${owned?'rgba(16,185,129,.4)':'var(--border)'}`}}
              title={owned?'Mark missing':'Mark owned'}>
        {owned ? '✓' : '·'}
      </button>
    </div>
  );
})}
```

- [ ] **Step 5: Pass collection and onToggleOwned to BallModal in App render**

Find:
```js
{showBalls && <BallModal onClose={()=>setShowBalls(false)} />}
```
Replace with:
```js
{showBalls && <BallModal onClose={()=>setShowBalls(false)}
                         collection={collection}
                         onToggleOwned={name => setCollection(prev => {
                           const next = {...prev};
                           if (next[name]) delete next[name]; else next[name] = true;
                           return next;
                         })} />}
```

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: ball collection tracking in BallModal with owned filter"
```

---

### Task 4: IdentifierModal — onIdentify callback

When the identifier finds a top match, it calls `onIdentify(name)` so the `N` shortcut in App can copy it.

**Files:**
- Modify: `index.html` — `IdentifierModal` function, App render

- [ ] **Step 1: Add onIdentify prop to IdentifierModal**

Find:
```js
function IdentifierModal({ onClose }) {
```
Replace with:
```js
function IdentifierModal({ onClose, onIdentify }) {
```

- [ ] **Step 2: Call onIdentify when topMatch is set**

Inside `IdentifierModal`, the `identify` function calls `setScores(newScores)`. After that call, add:
```js
setScores(newScores);
// notify parent of top match for N shortcut
const sorted = Object.entries(newScores).sort((a,b)=>b[1]-a[1]);
if (sorted[0]) onIdentify?.(sorted[0][0]);
```
The full updated `identify` callback after the `setScores` call should look like:
```js
setScores(newScores);
const sorted = Object.entries(newScores).sort((a,b)=>b[1]-a[1]);
if (sorted[0]) onIdentify?.(sorted[0][0]);
```

- [ ] **Step 3: Pass onIdentify to IdentifierModal in App render**

Find:
```js
{showIdentifier && <IdentifierModal onClose={()=>setShowIdentifier(false)} />}
```
Replace with:
```js
{showIdentifier && <IdentifierModal onClose={()=>setShowIdentifier(false)}
                                    onIdentify={name => { lastIdentifiedNameR.current = name; }} />}
```

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: IdentifierModal onIdentify callback for N shortcut"
```

---

### Task 5: Keyboard shortcuts

Add a single `keydown` listener in App that handles C, M, Space, I, L, N, ?. Disabled when focus is in an input/select/textarea.

**Files:**
- Modify: `index.html` — App component, after the existing `useEffect` hooks

- [ ] **Step 1: Add the shortcut useEffect in App**

Add this effect after the existing `useEffect` hooks (e.g. after the SW visibility effect). Insert it before the `// ── Handlers` comment:

```js
// ── Keyboard shortcuts ───────────────────────────────────────
useEffect(() => {
  const onKey = e => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    switch(e.key.toLowerCase()) {
      case 'c': e.preventDefault(); caught(); break;
      case 'm': e.preventDefault(); miss();   break;
      case ' ': e.preventDefault(); setStandby(v => !v); break;
      case 'i': e.preventDefault(); setShowIdentifier(true); break;
      case 'l': e.preventDefault(); setShowBalls(true); break;
      case 'n':
        e.preventDefault();
        if (lastIdentifiedNameR.current) {
          navigator.clipboard.writeText(lastIdentifiedNameR.current).catch(()=>{});
          setToast({ msg: `📋 Copied: ${lastIdentifiedNameR.current}`, type:'prime', key:Date.now() });
        }
        break;
      case '?': e.preventDefault(); setShowKeys(v => !v); break;
      default: break;
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [caught, miss]);
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: keyboard shortcuts C/M/Space/I/L/N/?"
```

---

### Task 6: Left panel — add phase clock card

Move the Phase+Clock section from the right panel into the top of the left panel, and widen the left panel.

**Files:**
- Modify: `index.html` — the `<aside>` (left panel) and `<main>` (right panel) in App render

- [ ] **Step 1: Widen the left panel**

Find:
```js
<aside className="w-64 xl:w-72 flex-shrink-0 flex flex-col overflow-y-auto border-r gap-3 p-3"
```
Replace with:
```js
<aside className="w-80 xl:w-96 flex-shrink-0 flex flex-col overflow-y-auto border-r gap-3 p-3"
```

- [ ] **Step 2: Add the clock card at the top of the left panel**

Find the first `<section>` inside `<aside>` — the Server Info section that starts with `{/* Server Info */}`. Insert this block immediately before it (after the `<aside>` opening tag):

```jsx
{/* Phase Clock */}
<section className={`glass rounded-xl p-4 card-lift text-center ${phase==='TRIGGERING'?'trig-ring':''}`}
         style={{boxShadow: phase==='TRIGGERING' ? '0 0 0 1px rgba(16,185,129,0.3),0 4px 20px rgba(16,185,129,0.1)'
                          : phase==='PRIMING'    ? '0 0 0 1px rgba(245,158,11,0.25),0 4px 20px rgba(245,158,11,0.08)'
                          : '0 0 0 1px rgba(139,92,246,0.15),0 4px 20px rgba(0,0,0,0.3)'}}>
  <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border mb-2 ${cfg.badge}`}>
    <span className={`phase-dot ${phase !== 'RESTING' ? 'pulsing' : ''}`} style={{background:cfg.color}} />
    <span className="uppercase tracking-widest text-xs">{cfg.label}</span>
  </div>
  <div className="font-mono font-bold leading-none mb-1"
       style={{fontSize:'clamp(2.4rem,5vw,3.2rem)',letterSpacing:'0.08em',
               color: phase==='TRIGGERING'?'#34D399':phase==='PRIMING'?'#FCD34D':'#E2E8F0',
               textShadow: phase==='TRIGGERING'?'0 0 24px rgba(52,211,153,0.7)':phase==='PRIMING'?'0 0 24px rgba(252,211,77,0.6)':'0 0 30px rgba(139,92,246,0.25)'}}>
    {fmt(elapsed)}
  </div>
  <p className="text-xs uppercase tracking-widest mb-3" style={{color:'var(--muted)',letterSpacing:'0.12em',fontSize:'0.6rem'}}>Time Since Last Catch</p>
  {phase==='RESTING'    && <Bar pct={coolPct}  color="linear-gradient(90deg,#6366F1,#8B5CF6)" glow="rgba(139,92,246,0.7)"  label="Cooling down"  sub={`Priming in ${fmtDown(restDown)}`} />}
  {phase==='PRIMING'    && <Bar pct={primePct} color="linear-gradient(90deg,#F59E0B,#F97316)" glow="rgba(245,158,11,0.8)"  label="Priming phase" sub={`Trigger in ${fmtDown(primDown)}`} />}
  {phase==='TRIGGERING' && <Bar pct={sentPct}  color="linear-gradient(90deg,#10B981,#34D399)" glow="rgba(16,185,129,0.8)"  label="Next sentence" sub={`${tick}s`} />}
</section>
```

- [ ] **Step 3: Remove the Phase+Clock section from the right panel**

In `<main>`, find and delete the entire section from `{/* Phase + Clock card */}` through its closing `</section>` tag (the large block that starts with `<section className={`glass rounded-2xl p-6 text-center` and ends before `{/* Resting hint */}`).

Also remove the Resting hint section:
```jsx
{/* Resting hint */}
{phase === 'RESTING' && (
  <section className="glass rounded-xl px-5 py-3.5 text-center anim-slide-up">
    <p className="text-sm text-slate-500">
      No action needed. Priming begins at <span className="font-mono text-white">12:00</span>.
    </p>
  </section>
)}
```

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: move phase clock to left panel"
```

---

### Task 7: Right panel tabs — Stats, History, Collection

Replace the right panel's Live feed section with a tab strip (Stats | History | Collection) and tab content panels.

**Files:**
- Modify: `index.html` — `<main>` section in App render

- [ ] **Step 1: Add tab strip and Stats tab content after the content box**

The right panel `<main>` currently ends after the content box section (since we removed Live feed in Task 2 and Phase+Clock in Task 6). After the closing `)}` of the content box section (`{showContent && ...}`), add:

```jsx
{/* Right panel tabs */}
<section className="glass rounded-xl flex flex-col flex-1 min-h-0 overflow-hidden" style={{minHeight:'260px'}}>
  {/* Tab strip */}
  <div className="flex border-b flex-shrink-0" style={{borderColor:'var(--border)'}}>
    {[['stats','Stats'],['history','History'],['collection','Collection']].map(([v,lbl]) => (
      <button key={v} onClick={()=>setRightTab(v)}
              className="flex-1 py-2.5 text-xs font-semibold transition-colors"
              style={{color: rightTab===v?'#A78BFA':'var(--muted)',
                      borderBottom: rightTab===v?'2px solid #8B5CF6':'2px solid transparent',
                      background:'transparent'}}>
        {lbl}
      </button>
    ))}
  </div>

  {/* Stats tab */}
  {rightTab === 'stats' && (() => {
    const catchCount  = stats.catches;
    const missCount   = stats.misses;
    const total       = catchCount + missCount;
    const rate        = total > 0 ? ((catchCount/total)*100).toFixed(1) : '—';
    const caughtItems = stats.history.filter(h=>h.type==='caught');
    const avgSec      = caughtItems.length > 1
      ? Math.round(caughtItems.slice(0,-1).reduce((sum,h,i)=>{
          const next = caughtItems[i+1]; return sum + (h.ts - next.ts)/1000;
        },0) / (caughtItems.length-1))
      : null;
    const avgFmt      = avgSec ? (avgSec>=60 ? `${Math.floor(avgSec/60)}m ${avgSec%60}s` : `${avgSec}s`) : '—';
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {[['Catches',catchCount,'text-emerald-400'],['Misses',missCount,'text-rose-400'],
            ['Catch Rate',rate+'%','text-amber-400'],['Avg Time',avgFmt,'text-indigo-400'],
            ['Streak',stats.streak,'text-violet-400'],['Best Streak',stats.bestStreak,'text-cyan-400'],
          ].map(([label,val,color]) => (
            <div key={label} className="rounded-xl p-3 text-center" style={{background:'var(--s1)',border:'1px solid var(--border)'}}>
              <p className={`text-xl font-bold font-mono ${color}`}>{val}</p>
              <p className="text-xs text-slate-600 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
        <button onClick={()=>setStats({ catches:0, misses:0, streak:0, bestStreak:0, history:[] })}
                className="btn btn-ghost w-full py-2 text-xs text-slate-700 hover:text-rose-400">
          Clear all stats
        </button>
      </div>
    );
  })()}

  {/* History tab */}
  {rightTab === 'history' && (
    <div className="flex-1 overflow-y-auto p-3 space-y-1">
      {stats.history.length === 0 && (
        <p className="text-center py-12 text-slate-600 text-sm">No history yet.</p>
      )}
      {stats.history.map((h,i) => {
        const time = new Date(h.ts).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
        const typeIcon = h.type==='caught'?'✅':h.type==='miss'?'❌':h.type==='command'?'⚡':'💬';
        const typeColor = h.type==='caught'?'text-emerald-500':h.type==='miss'?'text-rose-500':h.type==='command'?'text-indigo-400':'text-slate-400';
        return (
          <div key={i} className="flex items-start gap-2.5 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors"
               style={{background:'var(--s0)',border:'1px solid var(--border)',opacity:Math.max(0.35,1-i*0.03)}}>
            <span className="text-sm flex-shrink-0 mt-0.5">{typeIcon}</span>
            <div className="flex-1 min-w-0">
              {h.content
                ? <p className="text-xs text-slate-400 truncate">{h.content}</p>
                : <p className={`text-xs font-semibold ${typeColor}`}>{h.type.charAt(0).toUpperCase()+h.type.slice(1)}</p>}
              <p className="text-xs text-slate-700 mt-0.5">at {time} · {h.elapsed != null ? fmt(h.elapsed)+' elapsed' : ''}</p>
            </div>
          </div>
        );
      })}
    </div>
  )}

  {/* Collection tab — uses CollectionTab component (defined before App) */}
  {rightTab === 'collection' && (
    <CollectionTab collection={collection} setCollection={setCollection} />
  )}
</section>
```

Note: The Collection tab uses an IIFE (`(() => { ... })()`) to allow local `useState` calls. This is a React anti-pattern — local state inside render. **Instead**, promote `collFilter` and `collQ` to App-level state alongside `rightTab`:

Add to App state (in Task 1 or now):
```js
const [collFilter, setCollFilter] = useState('all');
const [collQ,      setCollQ]      = useState('');
```
Then remove the local `React.useState` calls inside the Collection tab IIFE and reference the App state variables directly. Remove the IIFE wrapper (just use a plain fragment). The `toggleOwned` function is already defined inline — it can stay.

- [ ] **Step 2: Add CollectionTab component before the App function**

Find the line `function App() {` and insert this entire component definition immediately before it:

```jsx
function CollectionTab({ collection, setCollection }) {
  const [collFilter, setCollFilter] = useState('all');
  const [collQ,      setCollQ]      = useState('');

  const ownedCount = useMemo(() => BALLS.filter(b => collection[b.name]).length, [collection]);

  const collList = useMemo(() => {
    let list = BALLS;
    if (collQ.trim()) {
      const lq = collQ.toLowerCase();
      list = list.filter(b => b.name.toLowerCase().includes(lq));
    }
    if (collFilter === 'owned')   list = list.filter(b =>  collection[b.name]);
    if (collFilter === 'missing') list = list.filter(b => !collection[b.name]);
    return list;
  }, [collFilter, collQ, collection]);

  const toggleOwned = name => setCollection(prev => {
    const next = {...prev};
    if (next[name]) delete next[name]; else next[name] = true;
    return next;
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="px-3 pt-3 pb-2 flex-shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">{ownedCount} / {BALLS.length} owned</p>
          <div className="flex gap-1">
            {[['all','All'],['owned','✓'],['missing','—']].map(([v,lbl]) => (
              <button key={v} onClick={()=>setCollFilter(v)}
                      className="btn px-2 py-0.5 text-xs"
                      style={{background:collFilter===v?'var(--indigo-dim)':'var(--s2)',
                              border:`1px solid ${collFilter===v?'rgba(99,102,241,.4)':'var(--border)'}`,
                              color:collFilter===v?'#818cf8':'var(--fg2)'}}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
        <input className="inp text-xs" placeholder="Search balls…"
               value={collQ} onChange={e=>setCollQ(e.target.value)} />
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-px">
        {collList.map(b => {
          const owned = !!collection[b.name];
          return (
            <div key={b.name}
                 className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                 onClick={()=>toggleOwned(b.name)}>
              <div className="w-5 h-5 rounded flex items-center justify-center text-xs flex-shrink-0"
                   style={{background:owned?'var(--emerald-dim)':'var(--s2)',
                           border:`1px solid ${owned?'rgba(16,185,129,.4)':'var(--border)'}`}}>
                {owned && <span className="text-emerald-400">✓</span>}
              </div>
              <span className="flex-1 text-xs text-white font-medium truncate">{b.name}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded border ${rarityStyle(b.rarity)}`}
                    style={{fontSize:'0.6rem'}}>{b.rarity}</span>
            </div>
          );
        })}
        {collList.length === 0 && (
          <p className="text-center py-8 text-slate-600 text-xs">No results</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: right panel tabs with stats, history, collection"
```

---

### Task 8: Content box — auto-copy toggle

Add a small toggle button in the content box header. When enabled, new sentences are automatically copied to clipboard (the `autoCopyR` ref and interval logic were already wired in Task 2).

**Files:**
- Modify: `index.html` — content box section in App render

- [ ] **Step 1: Add toggle button to content box header**

Find in the content box section:
```jsx
<div className="flex items-center justify-between mb-3">
  <p className="text-xs font-semibold uppercase tracking-widest text-slate-600">
    {showCmd ? '🟢 Send This Now' : '🟡 Send This Sentence'}
  </p>
  <span className="text-xs font-mono text-slate-700">Next in {tick}s</span>
</div>
```
Replace with:
```jsx
<div className="flex items-center justify-between mb-3">
  <p className="text-xs font-semibold uppercase tracking-widest text-slate-600">
    {showCmd ? '🟢 Send This Now' : '🟡 Send This Sentence'}
  </p>
  <div className="flex items-center gap-2">
    <button onClick={()=>setAutoCopy(v=>!v)}
            className="btn px-2 py-1 text-xs flex items-center gap-1 transition-colors"
            style={{background:autoCopy?'var(--indigo-dim)':'var(--s2)',
                    border:`1px solid ${autoCopy?'rgba(99,102,241,.4)':'var(--border)'}`,
                    color:autoCopy?'#818cf8':'var(--muted)'}}
            title="Auto-copy new sentences to clipboard">
      📋 {autoCopy ? 'Auto' : 'Auto'}
    </button>
    <span className="text-xs font-mono text-slate-700">Next in {tick}s</span>
  </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: auto-copy toggle in content box"
```

---

### Task 9: Keyboard legend floating badge

Add a floating `?` pill in the bottom-right corner. Clicking it shows a shortcut reference overlay.

**Files:**
- Modify: `index.html` — App render, just before the closing `</div>` of the root flex container

- [ ] **Step 1: Add the floating ? badge and overlay**

Find near the end of App's return, before the final closing `</div>` (the root container div):
```jsx
{/* Modals */}
```
Insert before the Modals comment:
```jsx
{/* Keyboard legend */}
<button onClick={()=>setShowKeys(v=>!v)}
        className="fixed bottom-4 right-4 z-30 btn w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center"
        style={{background:'var(--s2)',border:'1px solid var(--border)',color:'var(--muted)',boxShadow:'0 2px 12px rgba(0,0,0,0.4)'}}>
  ?
</button>
{showKeys && (
  <div className="fixed bottom-14 right-4 z-30 glass2 rounded-xl p-4 anim-slide-up"
       style={{width:'220px',border:'1px solid var(--border)'}}>
    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Keyboard Shortcuts</p>
    <div className="space-y-1.5">
      {[['C','CAUGHT!'],['M','MISS!'],['Space','Break / Resume'],['I','Open Identifier'],
        ['L','Open Ball List'],['N','Copy identified name'],['?','Toggle this legend']
      ].map(([key,action]) => (
        <div key={key} className="flex items-center justify-between gap-3">
          <kbd className="text-xs font-mono px-2 py-0.5 rounded text-slate-300"
               style={{background:'var(--s2)',border:'1px solid var(--border)'}}>{key}</kbd>
          <span className="text-xs text-slate-500 text-right flex-1">{action}</span>
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: floating keyboard legend badge"
```

---

### Task 10: Final review and deploy

- [ ] **Step 1: Open the app in a browser and verify**

Open `index.html` locally (or via `npx serve .`). Check:
- Left panel shows the phase clock card at the top
- CAUGHT! / MISS! buttons work and increment stats in the Stats tab
- History tab shows entries after catching or missing
- Collection tab shows all balls with checkboxes; clicking toggles owned status
- BallModal (📖) shows owned count and filter buttons
- Keyboard shortcuts: press C (CAUGHT!), M (MISS!), Space (standby toggle), I (open identifier), L (open ball list), ? (show legend)
- After identifying a ball in the Identifier, press N to copy the name
- Auto-copy toggle in content box: enable it, wait for PRIMING phase, verify sentences auto-copy

- [ ] **Step 2: Reload the page and verify persistence**

Reload the page. Verify:
- Stats (catches, misses, streak) are restored from localStorage
- Owned collection is restored
- autoCopy toggle state is restored

- [ ] **Step 3: Commit and push to deploy**

```bash
git add index.html
git commit -m "feat: BallsDex Spawn Commander V3 — shortcuts, stats, collection, layout"
git push
```
