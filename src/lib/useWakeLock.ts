import { useEffect, useState } from 'react';

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
}

interface NavigatorWithWakeLock {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
}

export interface WakeLockState {
  supported: boolean;
  active: boolean;
  warning: string | null;
}

export function useWakeLock(enabled: boolean): WakeLockState {
  const [state, setState] = useState<WakeLockState>({
    supported: true,
    active: false,
    warning: null
  });

  useEffect(() => {
    const navigatorWithWakeLock = navigator as NavigatorWithWakeLock;
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    async function requestLock() {
      if (!enabled) {
        setState((current) => ({ ...current, active: false }));
        return;
      }

      if (!navigatorWithWakeLock.wakeLock) {
        setState({
          supported: false,
          active: false,
          warning: 'Screen Wake Lock is not supported in this browser.'
        });
        return;
      }

      try {
        sentinel = await navigatorWithWakeLock.wakeLock.request('screen');

        if (cancelled) {
          await sentinel.release();
          return;
        }

        sentinel.addEventListener('release', () => {
          setState((current) => ({ ...current, active: false }));
        });
        setState({ supported: true, active: true, warning: null });
      } catch (error) {
        setState({
          supported: true,
          active: false,
          warning:
            error instanceof Error
              ? error.message
              : 'Screen Wake Lock could not be enabled.'
        });
      }
    }

    function handleVisibilityChange() {
      if (
        document.visibilityState === 'visible' &&
        enabled &&
        (!sentinel || sentinel.released)
      ) {
        void requestLock();
      }
    }

    void requestLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (sentinel && !sentinel.released) {
        void sentinel.release();
      }
    };
  }, [enabled]);

  return state;
}
