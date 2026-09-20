import { useCallback, useEffect, useRef, useState } from "react";
import {
  completeManual,
  currentStep,
  finish,
  pause,
  reconcile,
  remainingMs,
  resume,
  skip,
  startSession,
  type Session,
} from "./domain/timer";
import type { WorkoutConfig } from "./domain/workout";
import {
  BrowserAudio,
  BrowserClock,
  BrowserWakeLock,
  type Cue,
  type WakeStatus,
} from "./platform/browser";
import {
  loadSnapshot,
  saveSnapshot,
  type Preferences,
  type Snapshot,
} from "./platform/storage";

export function useWorkout() {
  const [data, setData] = useState<Snapshot | null>(null);
  const ref = useRef<Snapshot | null>(null);
  const clock = useRef(new BrowserClock());
  const audio = useRef(new BrowserAudio());
  const [now, setNow] = useState(clock.current.now());
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [saveStatus, setSaveStatus] = useState("Loading local data");
  const [wakeStatus, setWakeStatus] = useState<WakeStatus>("off");
  const wake = useRef<BrowserWakeLock | null>(null);
  const lastTick = useRef(0);
  const lastCue = useRef("");
  const hiddenAt = useRef<number | null>(null);
  const [audioState, setAudioState] = useState("not enabled");
  const [events, setEvents] = useState<{ at: string; message: string }[]>([]);
  const log = useCallback(
    (message: string) =>
      setEvents((items) =>
        [{ at: new Date().toISOString(), message }, ...items].slice(0, 30),
      ),
    [],
  );

  const commit = useCallback((next: Snapshot) => {
    const stamped = { ...next, savedAt: clock.current.now() };
    ref.current = stamped;
    setData(stamped);
    setSaveStatus("Saving…");
    void saveSnapshot(stamped)
      .then(() => {
        if (ref.current === stamped) setSaveStatus("Saved on this device");
      })
      .catch(() => {
        setSaveStatus("Not saved");
        setError(
          "Local storage could not save your changes. Export your data before closing.",
        );
      });
  }, []);

  const setSession = useCallback(
    (session: Session) => {
      const state = ref.current;
      if (!state) return;
      const history =
        session.status === "finished"
          ? [session, ...state.history.filter((item) => item.id !== session.id)]
          : state.history;
      commit({ ...state, session, history });
    },
    [commit],
  );

  const cue = useCallback((kind: Cue) => {
    const prefs = ref.current?.preferences;
    if (!prefs || document.hidden) return;
    if (!prefs.muted && prefs.volume > 0) {
      void audio.current
        .play(kind, prefs.sound, prefs.volume)
        .then((played) => {
          setAudioState(audio.current.state);
          if (!played)
            setError("Sound is not ready. Tap Test sound to enable it.");
        });
    }
    if (prefs.vibration && "vibrate" in navigator)
      navigator.vibrate(kind === "finish" ? [80, 60, 80] : 50);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadSnapshot()
      .then((saved) => {
        if (cancelled) return;
        const backwards = clock.current.reanchor(saved.savedAt);
        const at = clock.current.now();
        let session = saved.session;
        if (session?.status === "running") {
          session = backwards
            ? pause(session, at)
            : reconcile(session, at, true);
          setNotice(
            backwards
              ? "Your device clock moved backward. The workout is paused; resume when ready."
              : "Workout restored. Timing is up to date; missed sounds were not replayed.",
          );
          log("Recovered saved workout");
        }
        const history =
          session?.status === "finished"
            ? [
                session,
                ...saved.history.filter((item) => item.id !== session!.id),
              ]
            : saved.history;
        commit({ ...saved, session, history });
        setNow(at);
        lastTick.current = at;
      })
      .catch(() => {
        if (!cancelled)
          setLoadError(
            "Your local data could not be opened. It has not been overwritten. Check browser storage permissions and reload.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [commit, log]);

  useEffect(() => {
    const service = new BrowserWakeLock(setWakeStatus);
    wake.current = service;
    return () => {
      void service.setWanted(false);
    };
  }, []);
  const needsWake =
    data?.session?.status === "running" && data.preferences.wakeLock;
  useEffect(() => {
    void wake.current?.setWanted(Boolean(needsWake));
  }, [needsWake]);

  useEffect(() => {
    const tick = (recover = false) => {
      if (document.hidden) return;
      const at = clock.current.now();
      const recovered =
        recover || (lastTick.current > 0 && at - lastTick.current > 2000);
      lastTick.current = at;
      setNow(at);
      setAudioState(audio.current.state);
      const session = ref.current?.session;
      if (!session || session.status !== "running") return;
      const next = reconcile(session, at, recovered);
      if (next !== session) {
        setSession(next);
        if (!recovered) cue(next.status === "finished" ? "finish" : "change");
        else {
          setNotice(
            "Timing recovered. Review any sets that ended while you were away.",
          );
          log("Reconciled elapsed steps without replaying cues");
        }
      }
      const step = currentStep(next);
      const seconds = Math.ceil(remainingMs(next, at) / 1000);
      const key = `${next.id}-${next.index}-${seconds}`;
      if (
        !recovered &&
        next === session &&
        step?.kind === "timed" &&
        seconds > 0 &&
        seconds <= 3 &&
        ref.current?.preferences.countdown &&
        lastCue.current !== key
      )
        cue("countdown");
      lastCue.current = key;
    };
    const visibility = () => {
      if (document.hidden) {
        hiddenAt.current = clock.current.now();
        audio.current.silence();
        if (ref.current) commit(ref.current);
        log("App hidden — cues suspended");
      } else {
        const backwards = clock.current.reanchor(hiddenAt.current ?? 0);
        if (backwards && ref.current?.session?.status === "running") {
          setSession(pause(ref.current.session, clock.current.now()));
          setNotice(
            "Your device clock moved backward. The workout is paused; resume when ready.",
          );
        }
        tick(true);
        const state = ref.current;
        void wake.current?.setWanted(
          Boolean(
            state?.preferences.wakeLock && state.session?.status === "running",
          ),
        );
        log("App visible — clock synchronized");
        hiddenAt.current = null;
      }
    };
    const interval = window.setInterval(() => tick(), 100);
    document.addEventListener("visibilitychange", visibility);
    const pageShow = (event: PageTransitionEvent) => {
      if (event.persisted) visibility();
    };
    window.addEventListener("pageshow", pageShow);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pageshow", pageShow);
      audio.current.silence();
    };
  }, [commit, cue, log, setSession]);

  const enableAudio = async () => {
    try {
      await audio.current.unlock();
      setAudioState(audio.current.state);
      setError("");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not enable sound.");
      return false;
    }
  };
  const start = () => {
    const state = ref.current;
    if (!state || (state.session && state.session.status !== "finished"))
      return;
    if (!state.preferences.muted) void enableAudio();
    void navigator.storage?.persist?.().catch(() => {});
    const at = clock.current.now();
    setSession(startSession(state.config, at, crypto.randomUUID()));
    setNotice("");
    log("Workout started");
  };
  const act = (action: "pause" | "resume" | "skip" | "finish") => {
    const session = ref.current?.session;
    if (!session) return;
    const at = clock.current.now();
    if (action === "resume" && !ref.current?.preferences.muted)
      void enableAudio();
    const next = { pause, resume, skip, finish }[action](session, at);
    setSession(next);
    setNow(at);
    if (action === "pause" || action === "finish") audio.current.silence();
    if (action === "skip" && next.index !== session.index)
      cue(next.status === "finished" ? "finish" : "change");
    log(`Workout ${action}`);
  };

  return {
    data,
    now,
    notice,
    error,
    loadError,
    saveStatus,
    wakeStatus,
    audioState,
    events,
    start,
    act,
    dismissNotice: () => setNotice(""),
    dismissError: () => setError(""),
    configure: (config: WorkoutConfig) => {
      if (ref.current) commit({ ...ref.current, config });
    },
    preferences: (changes: Partial<Preferences>) => {
      if (!ref.current) return;
      if (changes.muted) audio.current.silence();
      commit({
        ...ref.current,
        preferences: { ...ref.current.preferences, ...changes },
      });
    },
    testSound: async () => {
      if (await enableAudio()) {
        cue("finish");
        log("Sound test played");
      }
    },
    done: (reps: number, weight?: number) => {
      const session = ref.current?.session;
      if (!session) return;
      const next = completeManual(session, clock.current.now(), reps, weight);
      setSession(next);
      cue(next.status === "finished" ? "finish" : "change");
    },
    note: (exerciseId: string, value: string) => {
      const session = ref.current?.session;
      if (session)
        setSession({
          ...session,
          notes: { ...session.notes, [exerciseId]: value },
        });
    },
    reviewResult: (sessionId: string, stepId: string, completed: boolean) => {
      const state = ref.current;
      if (!state) return;
      const update = (s: Session): Session =>
        s.id !== sessionId
          ? s
          : {
              ...s,
              results: s.results.map((r) =>
                r.stepId === stepId
                  ? { ...r, outcome: completed ? "completed" : "skipped" }
                  : r,
              ),
            };
      commit({
        ...state,
        session: state.session ? update(state.session) : null,
        history: state.history.map(update),
      });
    },
    newWorkout: () => {
      if (ref.current) commit({ ...ref.current, session: null });
      setNotice("");
    },
  };
}
