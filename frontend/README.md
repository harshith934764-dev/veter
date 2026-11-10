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


## Homepage feature-parity migration

The React homepage now includes a first migration pass of the previous `index.html` experience:

- Project overview and product destinations for VETEROS, VETER Language, VETER City, VETER World, VETER Social, VETER AI and VETER Studio.
- Download links for the existing Windows installer, native runtime ZIP and source repository.
- A React browser-learning playground with the original documented subset: `make`, `set`, `say`, `show`, arithmetic, examples, line count, reset, copy output, open `.vtr` and save `.vtr`.
- Learning library, getting-started links, FAQ and contact channels.
- Expanded navigation to the existing static project pages.
- Canonical URL, social metadata, structured organization/website data and the existing AdSense loader.

The original HTML pages and their scripts are intentionally left in place. This is a staged migration: the homepage is being brought into React first, while complex pages such as VETER Social, VETER World, VETER AI, games and the language tools still need individual integration and regression testing. Do not point production hosting at `frontend/dist` until those routes and assets have been migrated or explicitly mapped to the legacy pages.

Run locally:

```powershell
cd frontend
npm.cmd install
npm.cmd run typecheck
npm.cmd run build
npm.cmd run dev
```

The new homepage migration has not yet been run through a local build in this branch. Verify all download URLs, AdSense behavior, SEO output and the browser playground before production deployment.
