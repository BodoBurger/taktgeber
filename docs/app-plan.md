# Taktgeber app plan

Status: feasibility prototype implemented locally; physical iOS 26 validation pending. See `README.md` for the implemented subset and `docs/prototype-checklist.md` for device checks. The full v1 scope below remains the product plan.

## Development policy

The app is in active development. Apply a hard-cut mentality: backward compatibility with earlier development versions is not required. Implement each change as part of one coherent current design, replacing superseded behavior and removing obsolete code, dependencies, configuration, tests, and documentation in the same change. Avoid legacy paths, compatibility shims, dual implementations, and speculative abstractions.

Breaking development interfaces and file formats is acceptable; identify affected persisted state and any necessary recovery steps without assuming permission to delete user-owned or shared data. Current platform capability handling and the small interfaces intended for future Capacitor integration remain part of the design. Repository-wide implementation instructions are in `AGENTS.md`.

## Confirmed direction

- React PWA for iPhone and laptop browsers, structured for a possible Capacitor iOS app later.
- Minimum iOS version: iOS 26. Laptop browser targets: Firefox, Chrome, and Safari. Use current stable browser releases as the proposed test baseline.
- Supabase backend with emailed one-time codes for authentication.
- Local use works before login; an account enables cloud synchronization.
- Multiple saved workouts, composed of ordered exercises and optional breaks.
- Sets per exercise and rounds for the whole workout; nested circuits are deferred.
- Timed exercises advance automatically. Rep-based exercises show a target and wait for the user to tap Done, with an option to adjust actual reps.
- Optional weight tracking, with kg as the default and kg/lb selectable per workout; explicit exercise-level weight conventions as described below.
- Short reusable instruction notes per exercise and session-specific exercise notes, grouped across rounds.
- Session history includes duration, completed exercises, actual reps, optional weight, and exercise notes. Skipped exercises do not appear as completed work.
- Displayed session duration excludes explicit pauses; retain total wall-clock duration separately.
- Selectable countdown, transition, and final sounds; mute and vibration where supported.
- Music and podcasts from other apps should continue playing during workouts.
- Wake lock and recovery of correct timing after tab changes or screen locking, subject to the platform constraints below.
- Portable text-file export using JSON.
- Sharing, charts, and nested circuits are later features.

## Platform constraints

A PWA can reconstruct elapsed time after suspension, but cannot guarantee that JavaScript runs or sounds play at the scheduled instant while iOS has locked or backgrounded it. Wake lock keeps a visible app awake when the system permits it; it is not a background execution entitlement.

The user accepts correcting timing when returning to the app. Proposed v1 behavior: offer a Keep screen awake toggle, enabled by default during an active session, and reconcile the timeline when the app becomes visible again. Screen-off countdown and transition sounds are not guaranteed.

Standard vibration is unavailable in iOS Safari. Show vibration controls only where supported. Native capabilities may be added later through Capacitor plugins, but wrapping the app alone does not resolve background execution restrictions.

Audio coexistence is a requirement to test on real iPhones, both in Safari and as an installed PWA. Use short cues initialized by the Start gesture, and test interruption/recovery with music, podcasts, headphones, and screen locking. Do not promise background cues or uninterrupted external playback before this validation. If browser behavior prevents the desired experience, resolve the tradeoff before building out the app.

References:

- [WebKit background behavior](https://webkit.org/blog/8970/how-web-content-can-affect-power-usage/)
- [Wake lock in iOS Home Screen apps](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)
- [Browser capability data](https://github.com/mdn/browser-compat-data/blob/main/api/Navigator.json)
- [Capacitor architecture](https://capacitorjs.com/docs)

## Proposed user experience

### Workout library and editor

Create, rename, duplicate, delete, and reorder workouts and their steps. An exercise has a name, mode (timed or reps), duration or target reps, set count, and optional short instruction note. The workout has a round count. Optional rests between sets, exercises, and rounds must expand into a predictable sequence without accidental duplicate breaks.

Proposed default: no trailing rest after the final set or final round. The editor should preview the actual sequence so rest placement is clear. Exact rest-editing controls remain a design decision.

### Active workout

Show the current exercise, its instruction note, current set and round, the timer or rep target, and what comes next. Provide large Start, Pause/Resume, Done, Skip, and Finish controls. Support keyboard operation on a laptop.

For a rep-based set, Done records the target as actual reps unless adjusted. Allow an optional weight and a short exercise note. Keep normal completion to one tap by making adjustments optional and editable afterward.

Data granularity:

- Target reps and optional default weight belong to the workout exercise.
- Actual reps and optional weight belong to each completed set, identified by exercise, round, and set.
- A reusable instruction note belongs to the workout exercise.
- A session note belongs to the exercise within that session, with the rounds grouped together.

Both note types are confirmed: reusable exercise instructions and session observations such as “left shoulder felt tight today.”

### History

Show session date, workout name, duration, completion status, and completed exercise results. Include actual reps, weights, and exercise notes, editable after the session. Skipped sets must not contribute to completed counts, reps, or weight totals. An exercise with some completed sets should show those results without implying that every planned set was completed.

Preserve interrupted/unfinished sessions separately from completed sessions. Retain internal skip events for recovery and accurate progress, without listing skipped exercises as completed work.

Display session duration excluding explicit pauses and retain total elapsed wall-clock duration separately. Time spent with the screen locked or app backgrounded is not automatically a pause.

Recommend including offline history in v1. Session records already need local persistence for tracking and recovery, so reading them offline adds little incremental complexity. Show sessions recorded on this device and cloud sessions already downloaded; history available only in the cloud requires a connection before it can be viewed locally. Queue offline edits to reps, weights, and notes using the same synchronization mechanism as other local changes. Preserve conflicting session edits rather than silently overwriting them.

## Architecture

| Layer | Responsibility |
| --- | --- |
| React + TypeScript + Vite | Responsive screens and interaction |
| Domain modules | Workout validation, set/round expansion, session transitions, result aggregation |
| Timer engine | Timestamp-based progression, explicit pauses, manual completion boundaries |
| Platform interfaces | Clock, lifecycle, audio, haptics, screen-awake requests, persistence, file export/import |
| Web implementations | Browser APIs, IndexedDB, PWA app shell and cached sound assets |
| Supabase | Authentication, user-owned workout/session storage, synchronization |

Keep domain modules free of React, DOM, and Supabase dependencies. Use small platform interfaces only at actual platform boundaries. A future Capacitor app can reuse the UI and domain logic while replacing selected browser implementations with native plugins.

No custom application server is proposed for ordinary workout operations. Supabase access policies must enforce user ownership for every read and write; privileged credentials must never be shipped to the client.

## Timer and recovery rules

- Calculate elapsed time from clock anchors and pause records; do not count interval callbacks as seconds.
- Use a monotonic clock during active execution and persisted wall-clock anchors for recovery, with explicit handling for clock changes.
- Persist meaningful transitions and the active session locally.
- Reconcile elapsed timed steps after suspension, stopping at the first step that requires manual completion.
- Never invent completion of a manual rep set or replay a backlog of missed sounds.
- Distinguish a timer ending from proof that an exercise was performed. Flag results inferred across suspension for review rather than silently treating them as confirmed exercise results.
- Editing a saved workout must not alter an in-progress session or historical results.
- Defer PWA update activation until the active workout is finished.

## Data and synchronization

Proposed entities:

- Workout: owner, ID, name, revision, timestamps, and a versioned JSON definition with stable exercise IDs.
- Session: owner, ID, immutable workout snapshot, start/end and pause records, status, and per-set results with per-exercise notes.
- Preferences: sound choices, countdown settings, mute, supported haptics, screen-awake preference, and weight unit.

Store numeric weight with its unit; an absent weight is distinct from zero. The confirmed default is kg, with kg or lb selectable per workout, inherited by its exercises and snapshotted in each session. Changing the unit must convert existing values, never merely relabel them, and must not rewrite historical records.

Confirmed exercise-level weight conventions: per dumbbell for dumbbell exercises, total bar-plus-plates for barbells, the single implement's weight for a goblet squat or similar movement, and added load for weighted bodyweight exercises. Label the entry explicitly and allow the convention to be changed per exercise. Record that convention with historical results; do not infer training volume or double weights automatically. For unilateral exercises, use an explicit reps-per-side convention rather than silently doubling reps.

Proposed offline behavior: cached workouts, editing, active sessions, and history remain usable locally; queue changes for synchronization when the app opens or connectivity returns. Initial login requires a connection. Do not depend on background sync to complete uploads on iOS.

Local editing and tracking are saved in IndexedDB on the current device/browser profile, not just held in memory. Guest use is confirmed; guest records remain local until the user chooses to import them into an account. Signed-in records are saved locally and synchronized to Supabase when possible. Show whether changes are saved on this device, pending upload, or synchronized. Request persistent browser storage where supported; browser data can still be cleared by the user, and best-effort storage may be evicted. Cloud synchronization and JSON exports provide recovery for saved data. See [browser storage persistence](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

Use stable IDs and idempotent writes to avoid duplicate sessions after retries or guest-to-account import. Detect concurrent workout and session edits using revisions and preserve both versions for resolution. Scope local records to their account and define explicit cleanup behavior on sign-out; signed-in data must not become visible in the guest workspace or another account.

## Authentication and portability

Use an email code entry flow with resend, expiry, and error states. Configure a production SMTP provider and test delivery outside the Supabase project team.

Export JSON containing a schema version, export timestamp, workout definitions, and optional history/preferences. Exclude authentication secrets. Include units and stable IDs. JSON import is recommended for v1 so exports can restore data; validate files and offer duplicate handling before applying changes.

- [Supabase email codes](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Production email delivery](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase ownership policies](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Delivery sequence and acceptance

1. **iPhone feasibility prototype:** validate wake lock, short cues alongside external music/podcasts, app switching, screen locking, and timestamp recovery in Safari and installed mode. Timing reconciliation on return is accepted; evaluate audio coexistence and foreground cues on actual devices.
2. **Workout and session engine:** implement timed/manual steps, sets, rounds, rest placement, pause/resume, skip, and finish. Verify deterministic transitions with controlled-clock tests, including long suspension and manual boundaries.
3. **Local application:** implement library, editor, workout screen, results/history, notes, optional weights, sounds, and JSON portability. Verify that skipped work never appears as completed and editing a workout preserves history.
4. **Accounts and synchronization:** add email OTP, ownership policies, local persistence by account, queued synchronization, retry protection, and conflict handling. Test isolation between two users and duplicate-free retry behavior.
5. **PWA and release polish:** verify offline startup after initial loading, reload recovery, deferred updates, installation guidance, touch targets, safe areas, keyboard controls, and accessibility on iOS 26 and supported newer releases, plus Firefox, Chrome, and Safari on laptops. Proposed desktop baseline: current stable versions at release. Verify guest-to-account import, cached history access offline, and synchronization of offline result edits.

## Remaining recommendations

Include offline editing and history in v1 alongside local tracking. Offline history adds local queries and offline UI states; the larger synchronization and conflict-handling work is already part of the planned local-first architecture. This remains a recommendation in response to the user's overhead question, rather than an explicitly confirmed requirement.

The product decisions about guest use, weight options, note granularity, duration, and target platforms are confirmed. Keep the remaining interface defaults described above as proposals until refined during design.
