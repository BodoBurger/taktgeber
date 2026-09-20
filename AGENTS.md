# Project development policy

Taktgeber is in active development. Apply a hard-cut approach until the user explicitly changes this policy.

- Implement changes as a coherent part of the intended design, as though the current requirements had been planned from the beginning.
- When behavior is superseded, replace it completely and keep one canonical implementation.
- Backward compatibility with earlier development versions is not required. Do not retain legacy branches, deprecated APIs, aliases, old schema readers, dual writes, or compatibility flags for them.
- Remove obsolete code, dependencies, configuration, tests, fixtures, and documentation as part of the same change.
- Update affected callers, types, validation, persistence definitions, and tests together. Do not layer workarounds over an outdated design.
- Keep abstractions small and justified by current requirements. Do not add speculative compatibility or migration frameworks.
- Current browser capability handling and purposeful platform interfaces for a future Capacitor app are legitimate requirements, not legacy compatibility. Keep them focused; do not implement unused native layers.
- Breaking development interfaces or formats is acceptable. Document affected persisted state and any reset or conversion steps; this policy does not authorize deleting or resetting user-owned or shared data.
- Keep any explicitly required one-time data conversion separate from the runtime implementation. Do not retain the superseded runtime path.
- Verify the canonical behavior with appropriate checks and remove tests that only preserve obsolete behavior.

The product scope and confirmed decisions are recorded in `docs/app-plan.md`.
