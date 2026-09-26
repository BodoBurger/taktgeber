# Taktgeber

A React + TypeScript workout timer prototype, built with Vite. Designed for iOS 26 and laptop browsers, with browser services separated from the timer domain for a possible Capacitor app later.

## Run locally

Use Node 22.12+ (tested with Node 24).

```sh
npm ci
npm run dev
```

Development runs at `http://localhost:5173`. To test the actual PWA, including its service worker and offline assets:

```sh
npm run build
npm run preview
```

The production preview runs at `http://localhost:4173`. Fonts, icons, and application assets are bundled locally. The service worker is intentionally disabled in development mode. Updates are offered explicitly and cannot be applied through the app while a workout is active.

For an iPhone, serve `dist/` from a **trusted HTTPS origin**, then open it in Safari and use Share → Add to Home Screen. A plain HTTP LAN address can display the interface but does not provide the secure context needed to validate the PWA and wake lock. This repository does not deploy publicly or configure certificates automatically.

## Prototype scope

- One configurable sample circuit: timed squats, manual dumbbell rows, timed plank.
- Adjustable exercise/rest duration, reps, sets, rounds, and kg/lb; a five-second lead-in.
- Start, pause/resume, skip, early finish, and automatic timed transitions.
- Timestamp-based recovery after a hidden tab, lock, delayed callback, or reload. Manual sets always wait for Done. Recovered timed sets require review before counting as completed.
- Optional actual reps, dumbbell weight, and session notes. Skipped sets are excluded from completed history.
- IndexedDB persistence for the active session, settings, and history; JSON export.
- Three synthesized sound themes with different countdown, transition, and finish cues, volume, mute, and optional supported vibration.
- Wake-lock status, transient audio-session hint where available, and an in-app device checklist/event export.
- Responsive layout, native keyboard-operable controls, and an installable/offline production build.

This is the feasibility prototype, not the complete v1. Workout-library editing, editable reusable instructions, history-result editing beyond recovery confirmation, JSON import, Supabase login, and cloud synchronization are still planned. Manual rep/weight inputs are saved when Done is tapped; exercise notes save as entered. No user data is transmitted to a server.

### Timing and audio

The domain engine uses explicit deadlines. During visible execution the browser clock uses a monotonic anchor; on return it reconciles with wall time. If wall time has moved backward relative to the saved/hidden checkpoint, the workout pauses with a notice. Forward clock changes while hidden cannot be distinguished from elapsed real time. Active duration excludes explicit pauses and includes time spent in the background.

iOS can suspend a PWA in the background. Screen-off sounds are not guaranteed, and missed cues are not replayed. Wake lock is a request that the system can release. The audio implementation identifies cues as transient so they can mix with other apps when Safari supports the Audio Session API. Sound cues, screen awake, and music/podcast coexistence were confirmed by the user on an iOS 27 PWA; broader release checks remain. Vibration is unavailable in iOS Safari. See [the feasibility result and release checks](docs/prototype-checklist.md).

Browser data may be cleared or evicted. The prototype requests persistent storage where available and provides JSON export. It does not reset existing data if loading or validation fails. Development formats are subject to the hard-cut policy in [AGENTS.md](AGENTS.md).

## Verification

```sh
npm test
npx playwright install chromium
npm run test:e2e
```

To use an existing Chromium instead of the Playwright download:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

The browser suite builds the production PWA and checks manual results, skipped sets, delayed-timer review, pause/reload recovery, mobile width, and offline history. Automated Chromium tests do not establish Safari/iPhone hardware compatibility.

## Structure

- `src/domain/`: validated workout definitions and deterministic session transitions; no React or browser dependencies.
- `src/platform/`: browser clock, audio, wake lock, downloads, and local storage.
- `src/useWorkout.ts`: lifecycle, persistence, and cue coordination.
- `src/App.tsx`: prototype screens and controls.
- `docs/app-plan.md`: full product scope and decisions.
