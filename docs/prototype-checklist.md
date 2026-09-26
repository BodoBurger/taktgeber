# Prototype feasibility result

Status: **closed**. The PWA is viable for the basic iPhone requirements. On an iOS 27 device, the user confirmed that sound cues play, Keep screen awake works, and external music/podcasts continue playing during a workout. The device-check export recorded audio as `running`, wake lock as `active`, and lifecycle events including a return that reconciled elapsed steps. These diagnostics support the report but do not independently measure audible output or screen behavior.

The feasibility decision is to continue with the PWA. iOS may still suspend it when hidden or locked; missed sounds are not replayed, and the timer reconciles on return. The following scenarios remain useful for v1 release verification, including Safari, the installed Home Screen app, the minimum supported iOS version, different audio outputs, and desktop browsers. They are no longer a gate for continuing product development.

| Release check | Steps | Expected result |
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

For release checks, record the device model, exact iOS version, Safari vs installed mode, audio output, silent-mode setting, and outcome. Device check can export recent lifecycle events to accompany a report. Firefox, Chrome, and Safari desktop checks should also be recorded before the full v1 release.
