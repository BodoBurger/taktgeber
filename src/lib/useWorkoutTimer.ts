import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { TimerStep } from './types';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

interface TimerState {
  status: TimerStatus;
  currentIndex: number;
  remainingSeconds: number;
}

type TimerAction =
  | { type: 'reset'; firstStepSeconds: number }
  | { type: 'start'; firstStepSeconds: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'stop'; firstStepSeconds: number }
  | { type: 'tick'; sequence: TimerStep[] }
  | { type: 'skipForward'; sequence: TimerStep[] }
  | { type: 'skipBack'; sequence: TimerStep[] };

function getFirstStepSeconds(sequence: TimerStep[]): number {
  return sequence[0]?.duration_seconds ?? 0;
}

function timerReducer(state: TimerState, action: TimerAction): TimerState {
  switch (action.type) {
    case 'reset':
      return {
        status: 'idle',
        currentIndex: 0,
        remainingSeconds: action.firstStepSeconds
      };
    case 'start':
      return {
        status: 'running',
        currentIndex: 0,
        remainingSeconds: action.firstStepSeconds
      };
    case 'pause':
      return state.status === 'running' ? { ...state, status: 'paused' } : state;
    case 'resume':
      return state.status === 'paused' ? { ...state, status: 'running' } : state;
    case 'stop':
      return {
        status: 'idle',
        currentIndex: 0,
        remainingSeconds: action.firstStepSeconds
      };
    case 'tick': {
      if (state.status !== 'running') {
        return state;
      }

      if (state.remainingSeconds > 1) {
        return { ...state, remainingSeconds: state.remainingSeconds - 1 };
      }

      const nextIndex = state.currentIndex + 1;

      if (nextIndex >= action.sequence.length) {
        return { ...state, status: 'finished', remainingSeconds: 0 };
      }

      return {
        status: 'running',
        currentIndex: nextIndex,
        remainingSeconds: action.sequence[nextIndex].duration_seconds
      };
    }
    case 'skipForward': {
      const nextIndex = state.currentIndex + 1;

      if (nextIndex >= action.sequence.length) {
        return { ...state, status: 'finished', remainingSeconds: 0 };
      }

      return {
        ...state,
        currentIndex: nextIndex,
        remainingSeconds: action.sequence[nextIndex].duration_seconds
      };
    }
    case 'skipBack': {
      const previousIndex = Math.max(0, state.currentIndex - 1);
      return {
        ...state,
        currentIndex: previousIndex,
        remainingSeconds: action.sequence[previousIndex]?.duration_seconds ?? 0
      };
    }
    default:
      return state;
  }
}

export function useWorkoutTimer(
  sequence: TimerStep[],
  callbacks?: {
    onStepStart?: (step: TimerStep) => void;
    onFinished?: () => void;
  }
) {
  const initialSeconds = useMemo(() => getFirstStepSeconds(sequence), [sequence]);
  const [state, dispatch] = useReducer(timerReducer, {
    status: 'idle',
    currentIndex: 0,
    remainingSeconds: initialSeconds
  });
  const announcedStepId = useRef<string | null>(null);
  const announcedFinished = useRef(false);

  useEffect(() => {
    dispatch({ type: 'reset', firstStepSeconds: getFirstStepSeconds(sequence) });
    announcedStepId.current = null;
    announcedFinished.current = false;
  }, [sequence]);

  useEffect(() => {
    if (state.status !== 'running') {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      dispatch({ type: 'tick', sequence });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [sequence, state.status]);

  const currentStep = sequence[state.currentIndex] ?? null;

  useEffect(() => {
    if (state.status === 'running' && currentStep && announcedStepId.current !== currentStep.id) {
      announcedStepId.current = currentStep.id;
      callbacks?.onStepStart?.(currentStep);
    }
  }, [callbacks, currentStep, state.status]);

  useEffect(() => {
    if (state.status === 'finished' && !announcedFinished.current) {
      announcedFinished.current = true;
      callbacks?.onFinished?.();
    }
  }, [callbacks, state.status]);

  const start = useCallback(() => {
    if (sequence.length === 0) {
      return;
    }

    announcedStepId.current = null;
    announcedFinished.current = false;
    dispatch({ type: 'start', firstStepSeconds: getFirstStepSeconds(sequence) });
  }, [sequence]);

  const pause = useCallback(() => dispatch({ type: 'pause' }), []);
  const resume = useCallback(() => dispatch({ type: 'resume' }), []);
  const stop = useCallback(() => {
    announcedStepId.current = null;
    announcedFinished.current = false;
    dispatch({ type: 'stop', firstStepSeconds: getFirstStepSeconds(sequence) });
  }, [sequence]);
  const skipForward = useCallback(
    () => dispatch({ type: 'skipForward', sequence }),
    [sequence]
  );
  const skipBack = useCallback(() => dispatch({ type: 'skipBack', sequence }), [sequence]);

  return {
    state,
    currentStep,
    start,
    pause,
    resume,
    stop,
    skipForward,
    skipBack
  };
}
