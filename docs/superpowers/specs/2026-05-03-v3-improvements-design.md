# BallsDex Spawn Commander V3 — Improvements Design

**Date:** 2026-05-03

## Overview

Overhaul the BallsDex Spawn Commander SPA to fix UX friction and add four major feature areas: keyboard shortcuts, sound/browser notifications, persistent stats/history, and ball collection tracking. The layout is restructured into a two-panel design to give each feature a proper home.

---

## 1. Layout

### Desktop (≥ 768px)

Two fixed panels side by side:

- **Left panel** (~380px, fixed width): Phase clock → phase status badge → CAUGHT! / MISS! / BREAK buttons → server size selector → icon buttons (📖 Ball List, 🔍 Identifier) → sound toggle. Never scrolls. Always visible.
- **Right panel** (fills remaining width): Content box at top (current sentence + Copy button) → tabbed area below with three tabs: **Stats**, **Collection**, **History**. Each tab scrolls independently.

A floating `?` badge in the bottom-right corner shows the keyboard shortcut legend on hover/click.

### Mobile (< 768px)

Stacked vertically: left panel content on top, right panel content below. Tabs remain at the bottom of the right section.

---

## 2. Keyboard Shortcuts

All shortcuts are disabled when focus is inside an input, textarea, or contenteditable element.

| Key | Action |
|-----|--------|
| `C` | CAUGHT! |
| `M` | MISS! |
| `Space` | BREAK / RESUME toggle |
| `I` | Open Identifier modal |
| `L` | Open Ball List modal |
| `N` | Copy last identified ball name (no-op if none identified this session) |
| `?` | Toggle shortcut legend |

The `?` legend is a small floating pill (bottom-right). It expands to show the full shortcut table.

---

## 3. Sound & Browser Notifications

### Sounds

- Soft chime when timer crosses into PRIMING (12:00)
- Louder chime when timer crosses into TRIGGERING (15:00)
- Generated via Web Audio API (no external audio files needed)
- Controlled by the existing sound toggle in the left panel

### Browser Notifications

- `Notification` API used when the tab is not focused
- Permission requested on first sound-toggle enable
- Same two trigger points: PRIMING and TRIGGERING phase transitions
- Notification body includes phase name and elapsed time

---

## 4. Stats & History

All data persists in `localStorage` under a `bd_stats` key.

### Stats Tab

Displayed counters:
- Catches (total all-time + this session)
- Misses (total all-time + this session)
- Catch rate % (catches / (catches + misses))
- Average time between catches (all-time)
- Current streak (consecutive catches without a miss)
- Best streak (all-time)

### History Tab

- Scrollable log of every CAUGHT! and MISS! event
- Each entry: event type, timestamp (HH:MM), elapsed time at moment of press
- Most recent at top
- Capped at 200 entries to avoid unbounded localStorage growth

### Reset

A "Clear stats" button at the bottom of the Stats tab wipes localStorage and resets all counters.

---

## 5. Ball Collection Tracker

Lives inside the existing Ball List modal. No new modal needed.

### Changes to Ball List Modal

- Each ball row gets a checkbox (or toggle icon) to mark as owned
- Header shows owned count: **47 / 181**
- Filter row: **All | Owned | Missing** buttons (default: All)
- Owned state persists in `localStorage` under `bd_collection` key

### Identifier Integration

No changes to the identifier UI. The `N` shortcut reads from a `lastIdentifiedName` ref that is set whenever the identifier produces a top match and persists for the rest of the session (survives modal close/reopen).

---

## 6. Content Box UX

- Larger text, more padding
- Copy button is always visible (not hidden behind hover)
- Optional auto-copy toggle: small 📋 icon button next to the Copy button; when enabled, new sentences are automatically copied to clipboard on generation

---

## Data Storage

| Key | Contents |
|-----|----------|
| `bd_stats` | `{ catches, misses, avgTime, streak, bestStreak, history[] }` |
| `bd_collection` | `{ [ballName]: true }` |

Existing keys (`bd_last_catch`, `bd_server`, `bd_sound`, `bd_standby`) are unchanged.

---

## Out of Scope

- Backend / server-side persistence
- Multi-server tracking
- Export/share features
- Any changes to the identifier image-matching algorithm
