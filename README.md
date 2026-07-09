# Workout Timer

Installable React + Vite + TypeScript workout timer PWA with offline-first IndexedDB storage and optional Supabase sync.

## Features

- Create, edit, duplicate, and soft-delete workouts.
- Store workouts locally first with Dexie.js / IndexedDB.
- Run a large, readable workout timer with rounds, progress, next exercise, pause/resume, skip, and stop controls.
- Build a flat timer sequence from exercises, optional breaks, and rounds.
- Play browser-generated sounds when exercises, breaks, and finished states start.
- Request Screen Wake Lock while the timer is running when the browser supports it.
- Sign in with Supabase email/password and sync pending local changes when online.
- Register a service worker and PWA manifest through `vite-plugin-pwa`.

## Setup

```bash
npm install
npm run dev
```

The app runs fully offline without Supabase credentials. Account sync is enabled only when the Supabase environment variables are set.

## Environment Variables

Create `.env.local` from `.env.example`:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Variables:

- `VITE_SUPABASE_URL`: Your Supabase project URL.
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous public key.

## Supabase Setup

1. Create a Supabase project.
2. Enable email/password authentication in Supabase Auth.
3. Run `supabase/schema.sql` in the Supabase SQL editor.
4. Add the environment variables above to `.env.local`.
5. Restart `npm run dev`.

The SQL creates `workouts` and `exercises` tables with Row Level Security policies. The app uses soft deletes through `deleted_at` so offline deletes can sync safely.

## Local-First Sync

Workouts are always written to IndexedDB first. Local rows include `sync_status`:

- `synced`
- `pending_create`
- `pending_update`
- `pending_delete`

When a user is signed in and online, the app pushes pending local changes to Supabase and then pulls remote rows for that user. If the browser is offline, changes remain queued locally and sync when the connection returns.

## Browser Notes

- Audio is initialized only after the user presses `Start workout`.
- Screen Wake Lock is requested only while the timer is running.
- If Wake Lock is unsupported or denied, the app shows a non-blocking warning.
- PWA installability works on localhost during development and on HTTPS in production.

## Scripts

```bash
npm run dev      # Start Vite dev server
npm run build    # Type-check and build production assets
npm run preview  # Preview the production build
```

## Project Structure

```text
src/
  components/       React screens
  lib/              Timer, storage, Supabase, sync, and utility logic
  App.tsx           App state and screen routing
  main.tsx          React entry and service worker registration
supabase/
  schema.sql        Tables, indexes, triggers, and RLS policies
public/
  favicon.svg       Browser favicon
  pwa-*.png         Manifest icons
```
