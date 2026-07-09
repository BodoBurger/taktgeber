import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { SettingsScreen } from './components/SettingsScreen';
import { TimerScreen } from './components/TimerScreen';
import { WorkoutEditor } from './components/WorkoutEditor';
import { WorkoutList } from './components/WorkoutList';
import {
  duplicateWorkout,
  ensureDemoWorkout,
  getWorkout,
  listWorkouts,
  saveWorkout,
  softDeleteWorkout
} from './lib/workoutRepository';
import {
  getCurrentSession,
  isSupabaseConfigured,
  onAuthStateChange,
  signInWithEmail,
  signOut,
  signUpWithEmail
} from './lib/supabase';
import { syncNow } from './lib/sync';
import type { Workout, WorkoutFormInput } from './lib/types';
import { useOnlineStatus } from './lib/useOnlineStatus';

type Screen =
  | { name: 'list' }
  | { name: 'editor'; workoutId?: string }
  | { name: 'timer'; workoutId: string }
  | { name: 'settings' };

function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'list' });
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);
  const [timerWorkout, setTimerWorkout] = useState<Workout | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState('Local changes are saved on this device.');
  const online = useOnlineStatus();

  const refreshWorkouts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await ensureDemoWorkout();
      setWorkouts(await listWorkouts());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Workouts could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  const runSync = useCallback(async () => {
    if (!session?.user || !isSupabaseConfigured) {
      setSyncMessage('Sign in to sync workouts with Supabase.');
      return;
    }

    if (!online) {
      setSyncMessage('Offline. Changes will sync when the connection returns.');
      return;
    }

    setSyncing(true);
    setError(null);

    try {
      const summary = await syncNow(session.user.id);
      await refreshWorkouts();
      setSyncMessage(`Synced ${summary.pushed} local and ${summary.pulled} remote changes.`);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Sync failed.');
      setSyncMessage('Sync failed. Local data is still saved.');
    } finally {
      setSyncing(false);
    }
  }, [online, refreshWorkouts, session]);

  useEffect(() => {
    void refreshWorkouts();
  }, [refreshWorkouts]);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const currentSession = await getCurrentSession();

        if (mounted) {
          setSession(currentSession);
          setSyncMessage(
            currentSession
              ? 'Signed in. Local changes sync when online.'
              : 'Local changes are saved on this device.'
          );
        }
      } catch (sessionError) {
        if (mounted) {
          setError(
            sessionError instanceof Error ? sessionError.message : 'Session could not be loaded.'
          );
        }
      }
    }

    void loadSession();

    const subscription = onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSyncMessage(
        nextSession
          ? 'Signed in. Local changes sync when online.'
          : 'Local changes are saved on this device.'
      );
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session?.user && online) {
      void runSync();
    } else if (!online) {
      setSyncMessage('Offline. Changes will sync when the connection returns.');
    }
  }, [online, runSync, session]);

  async function openEditor(workoutId?: string) {
    setError(null);
    setEditingWorkout(workoutId ? await getWorkout(workoutId) : null);
    setScreen({ name: 'editor', workoutId });
  }

  async function openTimer(workoutId: string) {
    setError(null);
    const workout = await getWorkout(workoutId);

    if (!workout) {
      setError('Workout could not be found.');
      return;
    }

    setTimerWorkout(workout);
    setScreen({ name: 'timer', workoutId });
  }

  async function handleSaveWorkout(input: WorkoutFormInput) {
    setSaving(true);
    setError(null);

    try {
      await saveWorkout(input, session?.user.id);
      await refreshWorkouts();
      setScreen({ name: 'list' });

      if (session?.user && online) {
        void runSync();
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Workout could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicateWorkout(workoutId: string) {
    setError(null);

    try {
      await duplicateWorkout(workoutId);
      await refreshWorkouts();

      if (session?.user && online) {
        void runSync();
      }
    } catch (duplicateError) {
      setError(
        duplicateError instanceof Error
          ? duplicateError.message
          : 'Workout could not be duplicated.'
      );
    }
  }

  async function handleDeleteWorkout(workoutId: string) {
    const workout = workouts.find((item) => item.id === workoutId);
    const confirmed = window.confirm(
      `Delete ${workout?.name ?? 'this workout'}? This will sync as a soft delete.`
    );

    if (!confirmed) {
      return;
    }

    setError(null);

    try {
      await softDeleteWorkout(workoutId);
      await refreshWorkouts();

      if (session?.user && online) {
        void runSync();
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Workout could not be deleted.');
    }
  }

  let activeScreen: ReactNode;

  if (screen.name === 'editor') {
    activeScreen = (
      <WorkoutEditor
        workout={editingWorkout}
        saving={saving}
        onSave={handleSaveWorkout}
        onCancel={() => setScreen({ name: 'list' })}
      />
    );
  } else if (screen.name === 'timer') {
    if (!timerWorkout) {
      activeScreen = (
        <main className="app-screen">
          <div className="empty-state">Loading timer...</div>
        </main>
      );
    } else {
      activeScreen = (
        <TimerScreen workout={timerWorkout} onExit={() => setScreen({ name: 'list' })} />
      );
    }
  } else if (screen.name === 'settings') {
    activeScreen = (
      <SettingsScreen
        session={session}
        online={online}
        supabaseConfigured={isSupabaseConfigured}
        syncLabel={syncMessage}
        syncing={syncing}
        onBack={() => setScreen({ name: 'list' })}
        onSync={runSync}
        onSignIn={async (email, password) => {
          await signInWithEmail(email, password);
        }}
        onSignUp={async (email, password) => {
          await signUpWithEmail(email, password);
        }}
        onSignOut={async () => {
          await signOut();
          setSession(null);
          setSyncMessage('Local changes are saved on this device.');
        }}
      />
    );
  } else {
    activeScreen = (
      <WorkoutList
        workouts={workouts}
        loading={loading}
        online={online}
        syncLabel={syncMessage}
        canSync={Boolean(session?.user && isSupabaseConfigured)}
        syncing={syncing}
        onCreate={() => void openEditor()}
        onEdit={(id) => void openEditor(id)}
        onStart={(id) => void openTimer(id)}
        onDuplicate={(id) => void handleDuplicateWorkout(id)}
        onDelete={(id) => void handleDeleteWorkout(id)}
        onSettings={() => setScreen({ name: 'settings' })}
        onSync={runSync}
      />
    );
  }

  return (
    <>
      {error ? (
        <div className="app-error" role="alert">
          <span>{error}</span>
          <button className="text-button" type="button" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      ) : null}
      {activeScreen}
    </>
  );
}

export default App;
