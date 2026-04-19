# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: BallsDex Spawn Commander

A single-page web application (SPA) to optimize spawning cycles for the Discord bot "BallsDex." It tracks a 15-minute cooldown timer, manages user activity phases, and generates unique "high-entropy" text content to trigger spawns.

## Stack

Single-file HTML/JS with Tailwind CSS (via CDN), or React with Tailwind — prefer the single-file approach for simplicity unless complexity demands React.

## Core State

- `lastSpawnTime` — timestamp of the most recent catch (resets on CAUGHT/MISS)
- `appState` — one of: `RESTING` | `PRIMING` | `TRIGGERING` | `PAUSED`
- `serverSize` — `small` (1–5 users) | `medium` (6–20) | `large` (21–100+)

## Spawn Phase Logic

| Phase | Time Window | Behavior |
|---|---|---|
| RESTING | 0:00 – 12:00 | Countdown only, no prompts |
| PRIMING | 12:00 – 15:00 | One high-entropy sentence every 60 s |
| TRIGGERING | 15:00+ | One sentence + one `/balls` command every 60 s |
| PAUSED | Any | Timer frozen, no prompts |

Transitions: CAUGHT! and MISS! both reset timer to 0 → RESTING. BREAK/RESUME toggles PAUSED.

## Content Engine

Generates sentences 15–25 words long on topics: minor tech inconveniences, confusing kitchen appliances, grocery store struggles, paradoxical social norms. Vary punctuation to avoid Discord spam detection. `serverSize` affects sentence complexity (small = simpler, large = more elaborate).

## BallsDex Reference Data

- Tier list: T1 (rarest) to T100 (common)
- Quick commands: `/balls completion`, `/balls info`, `/balls list`

## UI Layout

- Large digital clock: "Time Since Last Catch"
- Status indicator with phase label and color
- Content box with current sentence/command + Copy button
- Buttons: CAUGHT! (green, large), MISS!, BREAK/RESUME toggle
- Settings: server size selector, sound notification toggle
- Reference sidebar or modal for tier list and commands
