# Repository Guidelines

## Current application

This repository contains the public «Выпечка у Миланы» site on Angular 22.2.1. It uses standalone components, zoneless change detection, Signals, lazy path routes and static public prerender, anime.js and static assets. The Supabase catalog and owner-only admin are developed on `feat/supabase-catalog-admin`. The React prototype remains in the untouched `../milana` folder and its `react-prototype-baseline.tar.gz` archive.

## Structure

`src/app/app.ts` is the shared shell. `home.ts`, `catalog.ts` and `product-dialog.ts` implement the public journey; `product-card.ts` is shared, `navigation-state.ts` restores focus and scroll. `catalog-store.ts` loads typed Supabase data, while `admin-panel.ts` and `admin-auth.ts` implement owner editing. `src/styles.css` defines the visual system. Selected real photos are in `public/photos/`; new uploads go to private Storage. `supabase/` holds the migration and initial import, and `SUPABASE_SETUP.md` explains setup. The source archive remains at `../milana/vypech.zip` and is excluded from the site build.

## Commands

Use Node 22.22.3 and pnpm 12.8.1 (`.mise.toml`). Run `pnpm install --frozen-lockfile`, `pnpm start --port 8446` for development, `pnpm test --watch=false` for unit checks, and `pnpm build` for the production build. Start/build generate the public runtime config from environment, `.env.local`, or `.env.example`. The production configuration sets `baseHref` to `/`; output is `dist/milana-angular/browser`. Run `pnpm preview:pages` to serve that output at `http://127.0.0.1:8447/`. `pnpm test:catalog-api` checks API states without media capture; `pnpm test:e2e` needs a seeded Supabase project. Install Chromium once with `pnpm exec playwright install chromium` if needed.

## Design and content

Follow `Milana_Figma_Make_Public_Brief.md` for approved content and flows. `guidelines/Guidelines.md` records prototype colors and motion; the Angular version omits decorative section numbers and simplifies typography. Keep semantic controls, visible focus, reduced-motion behavior and readable content without IntersectionObserver. Archive prices, availability and collection rules are unconfirmed. The owner confirmed WhatsApp +7 (964) 203-48-35 on 2026-10-06. Use real supplied photos or an explicit missing-photo placeholder; do not invent a personal Telegram contact.

## Changes and review

Work on `feat/supabase-catalog-admin` for the catalog/admin task. Do not publish or push without authorization. Do not record video or create screenshots unless the user explicitly asks for them. Include affected routes and build/browser results. `.gitattributes` keeps ordinary site photos in Git; do not reintroduce broad LFS rules for those files. Keep `../milana` and its backup intact.

Static URL generation and catalog unpublishing procedure: see `STATIC_PAGES.md`. Run `pnpm test:routing` against production without SPA fallback.
