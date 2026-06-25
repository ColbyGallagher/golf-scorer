# golf-scorer

Stableford golf scorer for the regular Shortland Waters foursome (Colby, Mitch, Dave, Scott). Tracks scores across 18 holes, runs several side games at once, scans paper scorecards with AI, and syncs round history to the cloud.

## Overview

The app walks through a round in stages, each mapped to a route:

1. **Setup** (`/setup`) — 3-step wizard: pick the course/tee, choose which games are active, enter player handicaps. Course pars and stroke indices can be loaded from a saved course or scanned from a photo of the scorecard.
2. **Game** (`/game`) — hole-by-hole score entry with stroke counts, 3-putt flags, closest-to-pin / longest-drive winners, and per-hole Wolf setup.
3. **Teams** (`/teams`) — assign the four players to Team A / Team B.
4. **Card** (`/card`) — full scorecard table with Stableford points per hole.
5. **Comps** (`/comps`) — live results for every active side game.
6. **History** (`/history`) — past rounds, saved to and synced from Supabase.

### Scoring & games

All scoring logic lives in [scoring.ts](next-app/lib/scoring.ts) as pure, tested functions ([scoring.test.ts](next-app/lib/scoring.test.ts)):

- **Stableford** — points per hole off net score, with stroke allocation by handicap and stroke index (supports >18 handicaps).
- **Team multiplier** — Team A points × Team B points, summed per hole.
- **Skins** — per-hole winner takes the skin; ties carry over.
- **Nassau** — front 9 / back 9 / full 18 team matches.
- **Wolf** — rotating wolf each hole; solo, partner, blind, and alone modes with different payouts.
- **Gross / Net** — straight stroke totals, net via World Handicap System course handicap (HI × Slope/113 + (CR − Par), 95% allowance).
- **CTP / LD** — closest-to-pin and longest-drive winners per hole.

### Architecture

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| State | Zustand ([gameStore.ts](next-app/store/gameStore.ts)) |
| Styling | Tailwind CSS v4 |
| Backend | Supabase (rounds, scorecards, saved courses) |
| AI scan | `/api/scan` route proxies to the Anthropic API |
| PWA | Service worker + web manifest, installable on mobile |

> **Note:** The active app is in [next-app/](next-app/). The root `index.html` is the original single-file vanilla-JS version, kept for reference. See [next-plan.md](next-plan.md) for the rebuild rationale.

## Running locally

Requires Node 20+ (developed on Node 24).

```bash
cd next-app
npm install
npm run dev
```

Open http://localhost:3000.

### Environment

Create `next-app/.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=<your supabase project url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your supabase anon key>
ANTHROPIC_API_KEY=<your anthropic api key>   # only needed for scorecard scanning
```

The app loads without these, but cloud history/courses need the Supabase keys and AI scorecard scanning needs the Anthropic key.

### Scripts

| Command | Does |
|---------|------|
| `npm run dev` | Dev server (Turbopack) on :3000 |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |
| `npm test` | Run vitest once |
| `npm run test:watch` | Vitest watch mode |
