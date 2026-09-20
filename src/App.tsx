import { useEffect, useState, type CSSProperties } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  AudioLines,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Dumbbell,
  Headphones,
  History,
  Leaf,
  MonitorSmartphone,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  ShieldCheck,
  SkipForward,
  Smartphone,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import {
  currentStep,
  durationMs,
  remainingMs,
  type Session,
} from "./domain/timer";
import {
  buildSteps,
  exercises,
  type Step,
  type WorkoutConfig,
} from "./domain/workout";
import { downloadJson } from "./platform/browser";
import { useWorkout } from "./useWorkout";

const time = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
};
type Tab = "workout" | "history" | "device";

export default function App() {
  const workout = useWorkout();
  const { data, now } = workout;
  const [tab, setTab] = useState<Tab>("workout");
  const [editing, setEditing] = useState(false);
  const [ending, setEnding] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [installHelp, setInstallHelp] = useState(false);
  const {
    needRefresh: [updateAvailable],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!data)
    return (
      <main className="loading">
        <AudioLines size={40} />
        <h1>Taktgeber</h1>
        <p role={workout.loadError ? "alert" : "status"}>
          {workout.loadError || "Getting your space ready…"}
        </p>
        {workout.loadError && (
          <button className="button primary" onClick={() => location.reload()}>
            Try again
          </button>
        )}
      </main>
    );
  const session = data.session;
  const active = Boolean(session && session.status !== "finished");
  const complete = session?.status === "finished";
  const step = session && !complete ? currentStep(session) : undefined;
  const config = active && session ? session.config : data.config;
  const isRest = step?.kind === "timed" && step.phase === "rest";
  const isManual = step?.kind === "manual";
  const paused = session?.status === "paused";
  const seconds = session ? remainingMs(session, now) : config.seconds * 1000;
  const progress =
    step?.kind === "timed" ? 1 - seconds / (step.seconds * 1000) : 0;
  const allSteps = session?.steps ?? buildSteps(config);
  const nextExercise = allSteps
    .slice(session ? session.index + 1 : 1)
    .find((s) => s.exerciseId);
  const totalSets = allSteps.filter((s) => s.exerciseId).length;
  const completedSets =
    session?.results.filter((r) => r.outcome === "completed").length ?? 0;
  const viewedConfig = session?.config ?? config;

  return (
    <div className="app-shell">
      <header className="app-header">
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            setTab("workout");
          }}
          aria-label="Taktgeber home"
        >
          <span className="brand-icon">
            <AudioLines size={24} strokeWidth={2.4} />
          </span>
          taktgeber<span className="brand-dot">.</span>
        </a>
        <nav aria-label="Main navigation">
          {(
            [
              ["workout", "Workout", Activity],
              ["history", "History", History],
              ["device", "Device check", MonitorSmartphone],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              className={tab === id ? "nav-item selected" : "nav-item"}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => setTab(id)}
            >
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="header-status">
          <span className="prototype-tag">PROTOTYPE</span>
          <span
            className="connection"
            title={
              online
                ? "Online · data stays on this device"
                : "Offline · data stays on this device"
            }
          >
            {online ? <Wifi size={17} /> : <WifiOff size={17} />}
            <span>Local mode</span>
          </span>
        </div>
      </header>

      <main className="main-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">A LITTLE MOVEMENT. A BETTER DAY.</p>
            <h1>
              {tab === "workout"
                ? "Find your rhythm."
                : tab === "history"
                  ? "Every effort counts."
                  : "Ready for real life."}
            </h1>
            <p className="subtitle">
              {tab === "workout"
                ? "A clear mind. A steady pace. One set at a time."
                : tab === "history"
                  ? "Your sessions, saved right here on this device."
                  : "A few small checks before you find your flow."}
            </p>
          </div>
          <button
            className="button subtle install"
            onClick={() => setInstallHelp(!installHelp)}
            aria-expanded={installHelp}
          >
            <Smartphone size={17} /> Install app <ArrowRight size={15} />
          </button>
        </div>
        {installHelp && (
          <div className="notice">
            <Smartphone size={20} />
            <div>
              <strong>Take Taktgeber with you</strong>
              <p>
                On iPhone, open this site over HTTPS in Safari, tap Share, then
                Add to Home Screen. On a supported laptop browser, use its
                install option. The production build supports offline use after
                the first visit.
              </p>
            </div>
            <button
              className="icon-button"
              aria-label="Dismiss installation help"
              onClick={() => setInstallHelp(false)}
            >
              <X size={18} />
            </button>
          </div>
        )}
        {workout.notice && (
          <div className="notice" role="status">
            <RotateCcw size={19} />
            <p>{workout.notice}</p>
            <button
              className="icon-button"
              aria-label="Dismiss recovery notice"
              onClick={workout.dismissNotice}
            >
              <X size={18} />
            </button>
          </div>
        )}
        {workout.error && (
          <div className="notice warning" role="alert">
            <CircleHelp size={20} />
            <p>{workout.error}</p>
            <button
              className="icon-button"
              aria-label="Dismiss error"
              onClick={workout.dismissError}
            >
              <X size={18} />
            </button>
          </div>
        )}
        {updateAvailable && (
          <div className="notice">
            <ArrowDownToLine size={20} />
            <p>
              {active
                ? "An update is ready. Finish your workout before updating."
                : "A new version is ready."}
            </p>
            <button
              className="button small"
              disabled={active}
              onClick={() => void updateServiceWorker(true)}
            >
              Update app
            </button>
          </div>
        )}

        {tab === "workout" && (
          <div className="workout-layout">
            <section
              className={`timer-card ${isRest ? "resting" : ""}`}
              aria-label="Workout timer"
            >
              <div className="timer-top">
                <span className="pill">
                  <span
                    className={`status-dot ${active && !paused ? "live" : ""}`}
                  />
                  {complete
                    ? "SESSION SAVED"
                    : paused
                      ? "PAUSED"
                      : isRest
                        ? "RECOVERY"
                        : active
                          ? "IN YOUR FLOW"
                          : "READY WHEN YOU ARE"}
                </span>
                <button
                  className="icon-button"
                  onClick={() =>
                    workout.preferences({ muted: !data.preferences.muted })
                  }
                  aria-label={
                    data.preferences.muted ? "Unmute sounds" : "Mute sounds"
                  }
                >
                  {data.preferences.muted ? (
                    <VolumeX size={20} />
                  ) : (
                    <Volume2 size={20} />
                  )}
                </button>
              </div>
              {complete && session ? (
                <div className="complete-panel">
                  <div className="complete-mark">
                    <Check size={44} />
                  </div>
                  <p className="eyebrow">TIME WELL SPENT</p>
                  <h2>
                    {session.index === session.steps.length
                      ? "You found your rhythm."
                      : "Every bit counts."}
                  </h2>
                  <p>Your session is saved on this device.</p>
                  <div className="summary-stats">
                    <div>
                      <strong>{time(durationMs(session, now))}</strong>
                      <span>active time</span>
                    </div>
                    <div>
                      <strong>{completedSets}</strong>
                      <span>completed sets</span>
                    </div>
                  </div>
                  <button
                    className="button primary"
                    onClick={workout.newWorkout}
                  >
                    <RotateCcw size={17} /> Back to workout
                  </button>
                  <button
                    className="button text"
                    onClick={() => setTab("history")}
                  >
                    View session <ArrowRight size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="timer-title">
                    <p className="eyebrow">
                      {active
                        ? `ROUND ${step?.round ?? 1} OF ${config.rounds} · SET ${step?.set ?? 1} OF ${config.sets}`
                        : "FULL BODY · YOUR PACE"}
                    </p>
                    <h2>{step?.name ?? "Everyday strength"}</h2>
                    <p>
                      {step?.instruction ??
                        "A simple circuit to reconnect with your body."}
                    </p>
                  </div>
                  <div
                    className={`timer-dial ${isManual ? "manual" : ""}`}
                    style={
                      { "--progress": `${progress * 360}deg` } as CSSProperties
                    }
                  >
                    <div className="dial-inner">
                      {isManual ? (
                        <Dumbbell size={23} className="dial-symbol" />
                      ) : (
                        <span className="dial-marker" />
                      )}
                      <span
                        className="timer-number"
                        role="timer"
                        aria-label={
                          isManual
                            ? `${step.reps} target reps per side`
                            : `${time(seconds)} remaining`
                        }
                      >
                        {isManual ? step.reps : time(seconds)}
                      </span>
                      <span className="timer-caption">
                        {isManual
                          ? "REPS PER SIDE"
                          : active
                            ? paused
                              ? "TAKE YOUR TIME"
                              : "SECONDS REMAINING"
                            : "SECONDS PER EXERCISE"}
                      </span>
                      {!active && (
                        <span className="dial-sub">
                          No rush. Just progress.
                        </span>
                      )}
                    </div>
                  </div>
                  {isManual && session && (
                    <ManualEntry
                      key={step.id}
                      step={step}
                      session={session}
                      paused={paused}
                      onDone={workout.done}
                    />
                  )}
                  {!active ? (
                    <button
                      className="button primary start-button"
                      onClick={workout.start}
                    >
                      <Play size={19} fill="currentColor" /> Start workout{" "}
                      <span>5s to get ready</span>
                    </button>
                  ) : (
                    <div className="run-controls">
                      <button
                        className="button primary"
                        onClick={() => workout.act(paused ? "resume" : "pause")}
                      >
                        {paused ? <Play size={19} /> : <Pause size={19} />}
                        {paused ? "Resume" : "Pause"}
                      </button>
                      <button
                        className="button secondary"
                        disabled={paused}
                        onClick={() => workout.act("skip")}
                      >
                        <SkipForward size={19} /> Skip
                      </button>
                    </div>
                  )}
                  <div className="up-next">
                    <span>{active ? "UP NEXT" : "FIRST UP"}</span>
                    <strong>
                      {nextExercise?.name ?? "A well-earned finish"}
                    </strong>
                    <ChevronRight size={16} />
                  </div>
                  {active && step?.exerciseId && session && (
                    <label className="exercise-note">
                      A note for this exercise{" "}
                      <textarea
                        maxLength={240}
                        rows={2}
                        placeholder="How does it feel today?"
                        value={session.notes[step.exerciseId] ?? ""}
                        onChange={(e) =>
                          workout.note(step.exerciseId, e.target.value)
                        }
                      />
                    </label>
                  )}
                  {active && (
                    <div className="end-controls">
                      {ending ? (
                        <>
                          <span>Save your progress and finish?</span>
                          <button
                            className="button small"
                            onClick={() => {
                              workout.act("finish");
                              setEnding(false);
                            }}
                          >
                            Finish session
                          </button>
                          <button
                            className="button text small"
                            onClick={() => setEnding(false)}
                          >
                            Keep going
                          </button>
                        </>
                      ) : (
                        <button
                          className="button text small"
                          onClick={() => setEnding(true)}
                        >
                          Finish early
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
              <div className="timer-footer">
                <ShieldCheck size={14} />
                <span>{workout.saveStatus}</span>
                {session && (
                  <span className="elapsed">
                    <Clock3 size={13} />
                    {time(durationMs(session, now))} elapsed
                  </span>
                )}
              </div>
            </section>

            <aside className="workout-sidebar">
              <section className="panel circuit-panel">
                <div className="section-heading">
                  <h2>Your circuit</h2>
                  <span className="count-label">{config.rounds} rounds</span>
                </div>
                <p className="panel-subtitle">
                  Three movements. A little space for you.
                </p>
                <div className="circuit-list">
                  {exercises.map((exercise, i) => {
                    const selected = active && step?.exerciseId === exercise.id;
                    const count =
                      session?.results.filter(
                        (r) =>
                          r.outcome === "completed" &&
                          session.steps.find((s) => s.id === r.stepId)
                            ?.exerciseId === exercise.id,
                      ).length ?? 0;
                    return (
                      <div
                        key={exercise.id}
                        className={`circuit-item ${selected ? "current" : ""}`}
                      >
                        <span className="exercise-number">
                          {selected ? (
                            <Activity size={18} />
                          ) : (
                            `${i + 1}`.padStart(2, "0")
                          )}
                        </span>
                        <div>
                          <strong>{exercise.name}</strong>
                          <span>
                            {exercise.kind === "manual"
                              ? `${config.reps} reps / side`
                              : `${config.seconds} seconds`}
                            <span className="inline-dot">·</span>
                            {config.sets} {config.sets === 1 ? "set" : "sets"}
                          </span>
                        </div>
                        {count > 0 ? (
                          <span
                            className="exercise-count"
                            title="Completed sets"
                          >
                            <Check size={13} />
                            {count}
                          </span>
                        ) : (
                          <span className="step-kind">
                            {exercise.kind === "manual" ? (
                              <Dumbbell size={17} />
                            ) : (
                              <Clock3 size={17} />
                            )}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="circuit-meta">
                  <span>
                    <Clock3 size={15} />
                    {config.rest
                      ? `${config.rest}s rest between sets`
                      : "No rest between sets"}
                  </span>
                  <span>
                    <RotateCcw size={15} />
                    {config.rounds} {config.rounds === 1 ? "round" : "rounds"} ·{" "}
                    {config.sets * 3 * config.rounds} sets total
                  </span>
                </div>
                {!active && (
                  <button
                    className="button outline full-width"
                    aria-expanded={editing}
                    onClick={() => setEditing(!editing)}
                  >
                    <Settings2 size={16} />
                    {editing ? "Close settings" : "Make it your own"}
                  </button>
                )}
                {editing && !active && (
                  <ConfigForm
                    config={data.config}
                    onChange={workout.configure}
                  />
                )}
                {active && (
                  <div className="circuit-progress">
                    <div>
                      <span>Completed sets</span>
                      <strong>
                        {completedSets} / {totalSets}
                      </strong>
                    </div>
                    <progress value={completedSets} max={totalSets} />
                  </div>
                )}
              </section>
              <section className="panel preferences-panel">
                <div className="section-heading">
                  <h2>Set the mood</h2>
                  <Headphones size={18} />
                </div>
                <div className="sound-select">
                  <label htmlFor="sound">Sound cue</label>
                  <select
                    id="sound"
                    value={data.preferences.sound}
                    onChange={(e) =>
                      workout.preferences({
                        sound: e.target.value as "soft" | "bright" | "wood",
                      })
                    }
                  >
                    <option value="soft">Soft chime</option>
                    <option value="bright">Bright bell</option>
                    <option value="wood">Wood tap</option>
                  </select>
                </div>
                <label className="volume-control">
                  <Volume2 size={16} />
                  <span className="sr-only">Cue volume</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={data.preferences.volume}
                    onChange={(e) =>
                      workout.preferences({ volume: Number(e.target.value) })
                    }
                  />
                  <span>{Math.round(data.preferences.volume * 100)}%</span>
                </label>
                <Toggle
                  label="Countdown beeps"
                  detail="A gentle 3, 2, 1"
                  checked={data.preferences.countdown}
                  onChange={(value) =>
                    workout.preferences({ countdown: value })
                  }
                />
                <Toggle
                  label="Keep screen awake"
                  detail={
                    workout.wakeStatus === "active"
                      ? "Active · screen stays on"
                      : workout.wakeStatus === "unavailable"
                        ? "Unavailable in this browser or mode"
                        : workout.wakeStatus === "released"
                          ? "Released by the system"
                          : "While your workout is running"
                  }
                  checked={data.preferences.wakeLock}
                  onChange={(value) => workout.preferences({ wakeLock: value })}
                />
                {"vibrate" in navigator && (
                  <Toggle
                    label="Vibration"
                    detail="On supported devices"
                    checked={data.preferences.vibration}
                    onChange={(value) =>
                      workout.preferences({ vibration: value })
                    }
                  />
                )}
                <button
                  className="button text sound-test"
                  disabled={
                    data.preferences.muted || data.preferences.volume === 0
                  }
                  onClick={() => void workout.testSound()}
                >
                  <Volume2 size={16} />
                  {data.preferences.muted
                    ? "Unmute to test sound"
                    : "Test sound"}
                  <Play size={13} />
                </button>
              </section>
              <div className="gentle-note">
                <Leaf size={20} />
                <p>
                  Your pace is the right pace.
                  <br />
                  <span>
                    Keep the app open for sound cues. Timing catches up when you
                    return.
                  </span>
                </p>
              </div>
            </aside>
          </div>
        )}

        {tab === "history" && (
          <section className="panel history-panel">
            <div className="section-heading">
              <div>
                <h2>Your sessions</h2>
                <p className="panel-subtitle">A record of showing up.</p>
              </div>
              <button
                className="button outline"
                onClick={() => downloadJson(data, "taktgeber-export.json")}
              >
                <ArrowDownToLine size={16} />
                Export JSON
              </button>
            </div>
            {data.history.length === 0 ? (
              <div className="empty-state">
                <History size={36} />
                <h3>A fresh start.</h3>
                <p>
                  Finish your first workout and it will appear here.
                  <br />
                  Your history is available offline on this device.
                </p>
                <button
                  className="button primary"
                  onClick={() => setTab("workout")}
                >
                  Go to workout <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              data.history.map((item) => (
                <HistoryItem
                  key={item.id}
                  session={item}
                  onReview={workout.reviewResult}
                />
              ))
            )}
          </section>
        )}

        {tab === "device" && (
          <div className="device-grid">
            <section className="panel">
              <div className="section-heading">
                <h2>Your device, at a glance</h2>
                <MonitorSmartphone size={22} />
              </div>
              <p className="panel-subtitle">
                This prototype runs locally. No account or cloud sync yet.
              </p>
              <dl className="device-status">
                <div>
                  <dt>Connection</dt>
                  <dd>{online ? "Online" : "Offline"}</dd>
                </div>
                <div>
                  <dt>Secure context</dt>
                  <dd>
                    {window.isSecureContext ? "Available" : "HTTPS required"}
                  </dd>
                </div>
                <div>
                  <dt>Local storage</dt>
                  <dd>{workout.saveStatus}</dd>
                </div>
                <div>
                  <dt>Screen wake lock</dt>
                  <dd>{workout.wakeStatus}</dd>
                </div>
                <div>
                  <dt>Audio</dt>
                  <dd>{workout.audioState}</dd>
                </div>
                <div>
                  <dt>Audio mixing hint</dt>
                  <dd>
                    {"audioSession" in navigator
                      ? "Ambient supported"
                      : "Managed by browser"}
                  </dd>
                </div>
                <div>
                  <dt>Offline app shell</dt>
                  <dd>
                    {offlineReady || navigator.serviceWorker?.controller
                      ? "Ready"
                      : import.meta.env.DEV
                        ? "Production build only"
                        : "Preparing / unavailable"}
                  </dd>
                </div>
                <div>
                  <dt>Display mode</dt>
                  <dd>
                    {matchMedia("(display-mode: standalone)").matches
                      ? "Installed app"
                      : "Browser tab"}
                  </dd>
                </div>
              </dl>
              <button
                className="button outline full-width"
                onClick={() =>
                  downloadJson(
                    {
                      exportedAt: new Date().toISOString(),
                      userAgent: navigator.userAgent,
                      secure: window.isSecureContext,
                      wakeLock: workout.wakeStatus,
                      audio: workout.audioState,
                      events: workout.events,
                    },
                    "taktgeber-device-check.json",
                  )
                }
              >
                <ArrowDownToLine size={16} /> Export device check
              </button>
            </section>
            <section className="panel">
              <h2>The iPhone check</h2>
              <p className="panel-subtitle">
                Try in Safari and as a Home Screen app.
              </p>
              <ol className="checklist">
                <li>
                  <strong>Bring your own soundtrack.</strong>
                  <span>
                    Play music or a podcast, then use Test sound. Playback
                    should continue underneath the cue.
                  </span>
                </li>
                <li>
                  <strong>Start a short workout.</strong>
                  <span>
                    Use 5-second exercises and rests. Check the countdown,
                    transitions, and manual Done button.
                  </span>
                </li>
                <li>
                  <strong>Step away and come back.</strong>
                  <span>
                    Lock the phone or switch apps. Return and check that timing
                    has caught up. Manual exercises still wait for you.
                  </span>
                </li>
                <li>
                  <strong>Take it offline.</strong>
                  <span>
                    After the app is cached, enable airplane mode and reopen.
                    Your session and history should still be here.
                  </span>
                </li>
              </ol>
              <p className="device-footnote">
                Screen-off sounds and iOS audio mixing need real-device
                verification. Vibration is not available in iOS Safari.
              </p>
            </section>
            <section className="panel event-panel">
              <h2>Recent device events</h2>
              {workout.events.length ? (
                <ul>
                  {workout.events.map((event, i) => (
                    <li key={`${event.at}-${i}`}>
                      <time>{new Date(event.at).toLocaleTimeString()}</time>
                      <span>{event.message}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="panel-subtitle">
                  Start a workout or test a sound to see events here.
                </p>
              )}
            </section>
          </div>
        )}

        {tab === "workout" &&
          complete &&
          session &&
          session.results.some((r) => r.outcome === "unconfirmed") && (
            <section className="panel review-panel">
              <h2>A quick check-in</h2>
              <p>
                These sets ended while the app was away. Did you complete them?
              </p>
              <ReviewSets session={session} onReview={workout.reviewResult} />
            </section>
          )}
        <footer className="app-footer">
          <span>
            <span className="tiny-brand">t.</span> Made for movement, at your
            pace.
          </span>
          <span>
            {viewedConfig.unit.toUpperCase()} · iOS & web prototype{" "}
            <span className="footer-dot">·</span>
            <button onClick={() => setTab("device")}>
              Device check <ArrowRight size={12} />
            </button>
          </span>
        </footer>
      </main>
    </div>
  );
}

function Toggle({
  label,
  detail,
  checked,
  onChange,
}: {
  label: string;
  detail: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch-track" aria-hidden="true" />
    </label>
  );
}

function ConfigForm({
  config,
  onChange,
}: {
  config: WorkoutConfig;
  onChange: (config: WorkoutConfig) => void;
}) {
  return (
    <div className="config-form">
      {(
        [
          ["seconds", "Work (seconds)", 5, 600],
          ["rest", "Rest (seconds)", 0, 180],
          ["reps", "Reps per side", 1, 100],
          ["sets", "Sets per exercise", 1, 5],
          ["rounds", "Rounds", 1, 5],
        ] as const
      ).map(([key, label, min, max]) => (
        <ConfigNumber
          key={key}
          label={label}
          min={min}
          max={max}
          value={config[key]}
          onChange={(value) => onChange({ ...config, [key]: value })}
        />
      ))}
      <label>
        Weight unit
        <select
          value={config.unit}
          onChange={(e) =>
            onChange({ ...config, unit: e.target.value as "kg" | "lb" })
          }
        >
          <option value="kg">kg</option>
          <option value="lb">lb</option>
        </select>
      </label>
      <p>
        5-second lead-in. Rest between sets, including rounds. No rest after the
        final set.
      </p>
    </div>
  );
}

function ConfigNumber({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  return (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step="1"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = e.target.valueAsNumber;
          if (Number.isInteger(n) && n >= min && n <= max) onChange(n);
        }}
        onBlur={() => setDraft(String(value))}
      />
    </label>
  );
}

function ManualEntry({
  step,
  session,
  paused,
  onDone,
}: {
  step: Extract<Step, { kind: "manual" }>;
  session: Session;
  paused: boolean;
  onDone: (reps: number, weight?: number) => void;
}) {
  const [reps, setReps] = useState(String(step.reps));
  const [weight, setWeight] = useState("");
  const n = Number(reps);
  const w = weight.trim() === "" ? undefined : Number(weight);
  const valid =
    reps.trim() !== "" &&
    Number.isInteger(n) &&
    n >= 0 &&
    n <= 999 &&
    (w === undefined || (Number.isFinite(w) && w >= 0 && w <= 2000));
  return (
    <form
      className="manual-entry"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !paused) onDone(n, w);
      }}
    >
      <div className="manual-fields">
        <label>
          Actual reps / side
          <input
            type="number"
            min="0"
            max="999"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
          />
        </label>
        <label>
          {step.weightLabel} ({session.config.unit})
          <input
            type="number"
            min="0"
            max="2000"
            step="0.1"
            placeholder="Optional"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </label>
      </div>
      <button
        className="button primary full-width"
        disabled={paused || !valid}
        type="submit"
      >
        <Check size={19} /> Done with this set
      </button>
    </form>
  );
}

type ReviewHandler = (
  sessionId: string,
  stepId: string,
  completed: boolean,
) => void;
function ReviewSets({
  session,
  onReview,
}: {
  session: Session;
  onReview: ReviewHandler;
}) {
  return (
    <div className="review-sets">
      {session.results
        .filter((r) => r.outcome === "unconfirmed")
        .map((result) => {
          const step = session.steps.find((s) => s.id === result.stepId)!;
          return (
            <div key={result.stepId}>
              <span>
                {step.name}
                <small>
                  Round {step.round} · Set {step.set}
                </small>
              </span>
              <button
                className="button small"
                onClick={() => onReview(session.id, step.id, true)}
              >
                Completed
              </button>
              <button
                className="button text small"
                onClick={() => onReview(session.id, step.id, false)}
              >
                Exclude
              </button>
            </div>
          );
        })}
    </div>
  );
}
function HistoryItem({
  session,
  onReview,
}: {
  session: Session;
  onReview: ReviewHandler;
}) {
  const results = session.results.filter((r) => r.outcome === "completed");
  return (
    <details className="history-item">
      <summary>
        <span className="history-icon">
          <Check size={20} />
        </span>
        <span>
          <strong>Everyday strength</strong>
          <small>
            {new Date(session.startedAt).toLocaleString([], {
              dateStyle: "medium",
              timeStyle: "short",
            })}{" "}
            ·{" "}
            {session.index === session.steps.length
              ? "Finished"
              : "Finished early"}
          </small>
        </span>
        <span className="history-duration">
          {time(durationMs(session, session.endedAt!))}
          <small>{results.length} completed sets</small>
        </span>
        <ChevronRight size={17} />
      </summary>
      <div className="history-detail">
        {results.length === 0 && (
          <p>No confirmed exercises in this session yet.</p>
        )}
        {exercises.map((exercise) => {
          const matching = results.filter(
            (r) =>
              session.steps.find((s) => s.id === r.stepId)?.exerciseId ===
              exercise.id,
          );
          if (!matching.length) return null;
          return (
            <div className="history-exercise" key={exercise.id}>
              <strong>{exercise.name}</strong>
              {matching.map((result) => {
                const step = session.steps.find((s) => s.id === result.stepId)!;
                return (
                  <p key={result.stepId}>
                    Round {step.round} · Set {step.set}
                    <span>
                      {result.reps !== undefined
                        ? `${result.reps} reps / side`
                        : step.kind === "timed"
                          ? `${step.seconds}s`
                          : ""}
                      {result.weight !== undefined &&
                        ` · ${result.weight} ${session.config.unit} per dumbbell`}
                    </span>
                  </p>
                );
              })}
              {session.notes[exercise.id] && (
                <blockquote>{session.notes[exercise.id]}</blockquote>
              )}
            </div>
          );
        })}
        <ReviewSets session={session} onReview={onReview} />
        <p className="wall-time">
          Total time including pauses:{" "}
          {time(session.endedAt! - session.startedAt)}
        </p>
      </div>
    </details>
  );
}
