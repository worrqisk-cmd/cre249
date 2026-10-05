# Repository Guidelines

## Current application

This repository now contains the public «Выпечка у Миланы» site on Angular 22.2.1. It uses standalone components, zoneless change detection, Signals, lazy hash routes, anime.js and static assets. There is no backend, Supabase integration or admin interface in this phase. The React prototype remains in the untouched `../milana` folder and its `react-prototype-baseline.tar.gz` archive.

## Structure

`src/app/app.ts` is the shared shell. `home.ts`, `catalog.ts` and `product-dialog.ts` implement the public journey; `product-card.ts` is shared, `navigation-state.ts` restores focus and scroll, and `data.ts` contains typed demonstration data. `src/styles.css` defines the visual system. Selected real photos are in `public/photos/`. `tests/browser-check.mjs` checks the built site with Playwright. `artifacts/react/` and `artifacts/angular/` contain baseline and result screenshots. The source archive remains at `../milana/vypech.zip` and is excluded from the site build.

## Commands

Use Node 22.22.3 and pnpm 12.8.1 (`.mise.toml`). Run `pnpm install --frozen-lockfile`, `pnpm start --port 8446` for development, `pnpm test --watch=false` for unit checks, and `pnpm build` for the production build. The production configuration sets `baseHref` to `/cre249/`; output is `dist/milana-angular/browser`. Run `pnpm preview:pages` to serve that output at `http://127.0.0.1:8447/cre249/`, then `pnpm test:e2e`. Install Chromium once with `pnpm exec playwright install chromium` if needed.

## Design and content

Follow `Milana_Figma_Make_Public_Brief.md` for approved content and flows. `guidelines/Guidelines.md` records prototype colors and motion; the Angular version omits decorative section numbers and simplifies typography. Keep semantic controls, visible focus, reduced-motion behavior and readable content without IntersectionObserver. Archive prices, availability, collection rules and contact validity are unconfirmed. Never expose them as current facts. Use real supplied photos or an explicit missing-photo placeholder; do not invent a personal Telegram contact.

## Changes and review

Work on `feat/angular-public-migration` until reviewed. Do not publish or push without authorization. Include affected routes, build and browser results, and screenshots for visible changes. `.gitattributes` keeps ordinary site photos in Git; do not reintroduce broad LFS rules for those files. Keep `../milana` and its backup intact.
