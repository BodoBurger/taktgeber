import type { Workout } from '../lib/types';
import { calculateWorkoutDuration, formatDuration } from '../lib/timer';

interface WorkoutListProps {
  workouts: Workout[];
  loading: boolean;
  online: boolean;
  syncLabel: string;
  canSync: boolean;
  syncing: boolean;
  onCreate: () => void;
  onEdit: (id: string) => void;
  onStart: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onSettings: () => void;
  onSync: () => void;
}

export function WorkoutList({
  workouts,
  loading,
  online,
  syncLabel,
  canSync,
  syncing,
  onCreate,
  onEdit,
  onStart,
  onDuplicate,
  onDelete,
  onSettings,
  onSync
}: WorkoutListProps) {
  return (
    <main className="app-screen">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Offline-first PWA</p>
          <h1>Workout Timer</h1>
        </div>
        <button className="button secondary compact" type="button" onClick={onSettings}>
          Account
        </button>
      </header>

      <section className="status-strip" aria-live="polite">
        <span className={online ? 'status-pill online' : 'status-pill offline'}>
          {online ? 'Online' : 'Offline'}
        </span>
        <span>{syncLabel}</span>
        {canSync ? (
          <button
            className="text-button"
            type="button"
            onClick={onSync}
            disabled={syncing || !online}
          >
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
        ) : null}
      </section>

      <div className="screen-actions">
        <button className="button primary" type="button" onClick={onCreate}>
          New workout
        </button>
      </div>

      {loading ? (
        <div className="empty-state" role="status">
          Loading workouts...
        </div>
      ) : workouts.length === 0 ? (
        <div className="empty-state">
          <h2>No workouts yet</h2>
          <p>Create a workout to start timing exercises offline.</p>
          <button className="button primary" type="button" onClick={onCreate}>
            Create workout
          </button>
        </div>
      ) : (
        <div className="workout-list">
          {workouts.map((workout) => (
            <article className="workout-card" key={workout.id}>
              <div className="workout-card-header">
                <div>
                  <h2>{workout.name}</h2>
                  <p>
                    {workout.rounds} {workout.rounds === 1 ? 'round' : 'rounds'} -{' '}
                    {workout.exercises.length}{' '}
                    {workout.exercises.length === 1 ? 'exercise' : 'exercises'}
                  </p>
                </div>
                <strong>{formatDuration(calculateWorkoutDuration(workout))}</strong>
              </div>

              <div className="workout-exercise-preview">
                {workout.exercises.slice(0, 3).map((exercise) => (
                  <span key={exercise.id}>{exercise.name}</span>
                ))}
                {workout.exercises.length > 3 ? <span>+{workout.exercises.length - 3}</span> : null}
              </div>

              <div className="button-row">
                <button
                  className="button primary"
                  type="button"
                  onClick={() => onStart(workout.id)}
                  disabled={workout.exercises.length === 0}
                >
                  Start
                </button>
                <button className="button secondary" type="button" onClick={() => onEdit(workout.id)}>
                  Edit
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => onDuplicate(workout.id)}
                >
                  Duplicate
                </button>
                <button
                  className="button danger"
                  type="button"
                  onClick={() => onDelete(workout.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
