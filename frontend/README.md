# VETER React frontend (migration phase 1)

This folder contains the new React + TypeScript + Vite frontend foundation. It is intentionally isolated from the current static website while the migration is reviewed, so the existing production homepage and legacy pages remain untouched.

## Stack

- React 19 + TypeScript
- Vite 6
- Tailwind CSS 4
- shadcn/ui-inspired primitives (Button, Card, Badge) with accessible focus states
- Lucide icons

## Run locally

From this folder:

```bash
npm install
npm run dev
```

Create a production build:

```bash
npm run typecheck
npm run build
npm run preview
```

## Migration safety

- The new homepage links to existing legacy pages (language, docs, games, VETER World, VETER AI, VETER Social, downloads and community).
- Existing HTML pages, backend services, assets, authentication flows, game code, analytics and AdSense are not moved or removed in this phase.
- This is a parallel frontend preview, not yet the live root website. Do not change the production hosting root until all routes, integrations, SEO, analytics, downloads and mobile behavior have been migrated and tested.
- Next phases: move shared navigation/layout, migrate high-traffic pages one by one, add route-level smoke tests, then prepare a deployment configuration for review.
