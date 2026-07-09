import { useMemo, useRef, useState } from 'react';
import { createTimerAudio, type TimerAudio } from '../lib/audio';
import {
  buildTimerSequence,
  calculateWorkoutDuration,
  findNextExercise,
  formatDuration
} from '../lib/timer';
import type { Workout } from '../lib/types';
import { useWakeLock } from '../lib/useWakeLock';
import { useWorkoutTimer } from '../lib/useWorkoutTimer';

interface TimerScreenProps {
  workout: Workout;
  onExit: () => void;
}

export function TimerScreen({ workout, onExit }: TimerScreenProps) {
  const sequence = useMemo(() => buildTimerSequence(workout), [workout]);
  const audioRef = useRef<TimerAudio | null>(null);
  const [audioWarning, setAudioWarning] = useState<string | null>(null);
  const timer = useWorkoutTimer(sequence, {
    onStepStart: (step) => {
      audioRef.current?.playStepStart(step.type);
    },
    onFinished: () => {
      audioRef.current?.playWorkoutFinished();
    }
  });
  const wakeLock = useWakeLock(timer.state.status === 'running');
  const currentStep = timer.currentStep;
  const nextExercise = findNextExercise(sequence, timer.state.currentIndex);
  const totalDuration = calculateWorkoutDuration(workout);
  const elapsedBeforeCurrent = sequence
    .slice(0, timer.state.currentIndex)
    .reduce((total, step) => total + step.duration_seconds, 0);
  const elapsedCurrent = currentStep
    ? currentStep.duration_seconds - timer.state.remainingSeconds
    : 0;
  const progressPercent =
    totalDuration > 0
      ? Math.min(100, Math.max(0, ((elapsedBeforeCurrent + elapsedCurrent) / totalDuration) * 100))
      : 0;

  async function handleStart() {
    setAudioWarning(null);

    try {
      if (!audioRef.current) {
        audioRef.current = await createTimerAudio();
      } else {
        await audioRef.current.resume();
      }
    } catch (error) {
      setAudioWarning(
        error instanceof Error ? error.message : 'Audio could not be initialized.'
      );
    }

    timer.start();
  }

  async function handleResume() {
    try {
      await audioRef.current?.resume();
    } catch {
      // The timer can resume even if the browser keeps audio suspended.
    }

    timer.resume();
  }

  function handleStop() {
    timer.stop();
    onExit();
  }

  if (sequence.length === 0) {
    return (
      <main className="app-screen timer-screen">
        <div className="empty-state">
          <h1>{workout.name}</h1>
          <p>Add at least one exercise before starting this workout.</p>
          <button className="button primary" type="button" onClick={onExit}>
            Back
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="timer-screen">
      <header className="timer-top-bar">
        <div>
          <p className="eyebrow">{workout.name}</p>
          <h1>
            Round {currentStep?.round ?? 1} of {workout.rounds}
          </h1>
        </div>
        <button className="button secondary compact" type="button" onClick={handleStop}>
          Stop
        </button>
      </header>

      <section className={`timer-stage ${currentStep?.type === 'break' ? 'break-stage' : ''}`}>
        <p className="timer-kind">{currentStep?.type === 'break' ? 'Break' : 'Exercise'}</p>
        <h2>{currentStep?.name}</h2>
        <div className="timer-time" aria-live="polite">
          {formatDuration(timer.state.remainingSeconds)}
        </div>

        <div className="progress-block" aria-label="Workout progress">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="progress-meta">
            <span>
              Step {Math.min(timer.state.currentIndex + 1, sequence.length)} of{' '}
              {sequence.length}
            </span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
        </div>
      </section>

      <section className="timer-info">
        <div>
          <span>Next exercise</span>
          <strong>{nextExercise ? nextExercise.name : 'Finish'}</strong>
        </div>
        <div>
          <span>Total time</span>
          <strong>{formatDuration(totalDuration)}</strong>
        </div>
      </section>

      {wakeLock.warning ? <p className="notice">{wakeLock.warning}</p> : null}
      {audioWarning ? <p className="notice">{audioWarning}</p> : null}

      {timer.state.status === 'finished' ? (
        <section className="finish-panel">
          <h2>Workout finished</h2>
          <button className="button primary" type="button" onClick={onExit}>
            Done
          </button>
        </section>
      ) : (
        <section className="timer-controls" aria-label="Timer controls">
          <button className="button secondary control-button" type="button" onClick={timer.skipBack}>
            Back
          </button>
          {timer.state.status === 'idle' ? (
            <button className="button primary control-button main-control" type="button" onClick={handleStart}>
              Start workout
            </button>
          ) : timer.state.status === 'running' ? (
            <button className="button primary control-button main-control" type="button" onClick={timer.pause}>
              Pause
            </button>
          ) : (
            <button className="button primary control-button main-control" type="button" onClick={handleResume}>
              Resume
            </button>
          )}
          <button
            className="button secondary control-button"
            type="button"
            onClick={timer.skipForward}
          >
            Skip
          </button>
        </section>
      )}
    </main>
  );
}
