# iOS 26 prototype check

Status: real-device tests pending. Automated Chromium checks cover the timer flow, persistence, offline history, and mobile layout; they cannot validate iOS audio routing or physical wake behavior.

Run this checklist in both Safari and the installed Home Screen app using a trusted HTTPS origin. Use the production build. In Device check, wait for “Offline app shell: Ready” before testing offline startup.

| Check | Steps | Expected result |
| --- | --- | --- |
| Short circuit | Set work/rest to 5 seconds, one set and one round. Start. | Five-second preparation; squats; rest; rows waiting for Done; rest; plank; finish. No final rest. |
| Sounds | Test all three sound choices; start with countdown enabled. | Distinct countdown, change, and finish patterns. No burst of stale cues after returning. |
| Music/podcasts | Play audio in another app. Test a cue and run a workout. Repeat with headphones and the phone speaker. | External playback continues; note any pause, ducking, volume change, or missing cue. Also record silent-mode behavior. |
| Wake lock | Enable Keep screen awake and start. Leave the visible app untouched beyond the usual auto-lock period. | Status says active and the screen stays on when iOS grants the request. Pause/finish releases it. |
| App switching | Leave during squats for 20 seconds, then return. | Rows are waiting for Done. Squats require completion review. No fake reps are recorded. |
| Screen lock | Lock during a timed interval, then return. | Timestamp recovery behaves like app switching. No expectation of sounds while locked. |
| Pause | Pause halfway through a set. Lock for 30 seconds and return. | Remaining duration is unchanged; resume continues it. Pause time is excluded from active duration. |
| Reload | Reload during a workout and during a pause. | Current workout restores; paused state stays paused. Completed history is preserved. |
| Results | Record 8 rows per side at 12.5 kg; add a note; finish. | History shows those values and the note. Skip a set in another session and verify it is excluded. |
| Offline | After caching, enable airplane mode and reopen. Run a short session. | App shell, settings, saved history, and new local results work without a network. |
| Export | Export history and the device check. | JSON files are saved/shared through the browser and contain the expected data. |
| Layout | Use portrait/landscape and focus numeric/note fields. | No clipped controls, horizontal scrolling, or automatic input zoom. |

Record the device model, exact iOS version, Safari vs installed mode, audio output, silent-mode setting, and outcome. Device check can export recent lifecycle events to accompany a report. Firefox, Chrome, and Safari desktop checks should also be recorded before the full v1 release.
