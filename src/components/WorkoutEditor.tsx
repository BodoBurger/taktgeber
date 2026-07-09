import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Workout, WorkoutFormInput } from '../lib/types';
import { createId } from '../lib/utils';

interface WorkoutEditorProps {
  workout: Workout | null;
  saving: boolean;
  onSave: (input: WorkoutFormInput) => Promise<void>;
  onCancel: () => void;
}

interface ExerciseFormState {
  id: string;
  name: string;
  duration_seconds: number;
  break_seconds: number | '';
}

function createBlankExercise(index: number): ExerciseFormState {
  return {
    id: createId(),
    name: `Exercise ${index + 1}`,
    duration_seconds: 30,
    break_seconds: 15
  };
}

export function WorkoutEditor({ workout, saving, onSave, onCancel }: WorkoutEditorProps) {
  const initialExercises = useMemo<ExerciseFormState[]>(
    () =>
      workout
        ? workout.exercises.map((exercise) => ({
            id: exercise.id,
            name: exercise.name,
            duration_seconds: exercise.duration_seconds,
            break_seconds: exercise.break_seconds ?? ''
          }))
        : [createBlankExercise(0)],
    [workout]
  );
  const [name, setName] = useState(workout?.name ?? 'New workout');
  const [rounds, setRounds] = useState(workout?.rounds ?? 3);
  const [exercises, setExercises] = useState<ExerciseFormState[]>(initialExercises);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(workout?.name ?? 'New workout');
    setRounds(workout?.rounds ?? 3);
    setExercises(initialExercises);
    setError(null);
  }, [initialExercises, workout]);

  function updateExercise(
    id: string,
    changes: Partial<Omit<ExerciseFormState, 'id'>>
  ): void {
    setExercises((current) =>
      current.map((exercise) =>
        exercise.id === id ? { ...exercise, ...changes } : exercise
      )
    );
  }

  function moveExercise(id: string, direction: -1 | 1): void {
    setExercises((current) => {
      const index = current.findIndex((exercise) => exercise.id === id);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const copy = [...current];
      const [exercise] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, exercise);
      return copy;
    });
  }

  function removeExercise(id: string): void {
    setExercises((current) => current.filter((exercise) => exercise.id !== id));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (name.trim().length === 0) {
      setError('Give the workout a name.');
      return;
    }

    if (rounds < 1) {
      setError('Rounds must be at least 1.');
      return;
    }

    if (exercises.length === 0) {
      setError('Add at least one exercise.');
      return;
    }

    const invalidExercise = exercises.find(
      (exercise) => exercise.name.trim().length === 0 || exercise.duration_seconds < 1
    );

    if (invalidExercise) {
      setError('Each exercise needs a name and a duration of at least 1 second.');
      return;
    }

    await onSave({
      id: workout?.id,
      name,
      rounds,
      exercises: exercises.map((exercise, index) => ({
        id: exercise.id,
        name: exercise.name,
        duration_seconds: exercise.duration_seconds,
        break_seconds: exercise.break_seconds === '' ? null : exercise.break_seconds,
        position: index
      }))
    });
  }

  return (
    <main className="app-screen editor-screen">
      <header className="top-bar">
        <div>
          <p className="eyebrow">{workout ? 'Edit workout' : 'Create workout'}</p>
          <h1>{workout ? workout.name : 'New workout'}</h1>
        </div>
        <button className="button secondary compact" type="button" onClick={onCancel}>
          Cancel
        </button>
      </header>

      <form className="editor-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Workout name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
          />
        </label>

        <label className="field">
          <span>Rounds</span>
          <input
            type="number"
            min={1}
            max={99}
            value={rounds}
            onChange={(event) => setRounds(Number(event.target.value))}
            required
          />
        </label>

        <section className="editor-section" aria-labelledby="exercise-list-title">
          <div className="section-title-row">
            <h2 id="exercise-list-title">Exercises</h2>
            <button
              className="button secondary compact"
              type="button"
              onClick={() =>
                setExercises((current) => [...current, createBlankExercise(current.length)])
              }
            >
              Add
            </button>
          </div>

          <div className="exercise-list">
            {exercises.map((exercise, index) => (
              <article className="exercise-card" key={exercise.id}>
                <div className="exercise-card-header">
                  <strong>{index + 1}</strong>
                  <div className="button-row compact-row">
                    <button
                      className="button secondary compact"
                      type="button"
                      onClick={() => moveExercise(exercise.id, -1)}
                      disabled={index === 0}
                    >
                      Up
                    </button>
                    <button
                      className="button secondary compact"
                      type="button"
                      onClick={() => moveExercise(exercise.id, 1)}
                      disabled={index === exercises.length - 1}
                    >
                      Down
                    </button>
                    <button
                      className="button danger compact"
                      type="button"
                      onClick={() => removeExercise(exercise.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <label className="field">
                  <span>Name</span>
                  <input
                    type="text"
                    value={exercise.name}
                    onChange={(event) =>
                      updateExercise(exercise.id, { name: event.target.value })
                    }
                    maxLength={80}
                    required
                  />
                </label>

                <div className="field-grid">
                  <label className="field">
                    <span>Duration seconds</span>
                    <input
                      type="number"
                      min={1}
                      value={exercise.duration_seconds}
                      onChange={(event) =>
                        updateExercise(exercise.id, {
                          duration_seconds: Number(event.target.value)
                        })
                      }
                      required
                    />
                  </label>

                  <label className="field">
                    <span>Break seconds</span>
                    <input
                      type="number"
                      min={0}
                      placeholder="None"
                      value={exercise.break_seconds}
                      onChange={(event) =>
                        updateExercise(exercise.id, {
                          break_seconds:
                            event.target.value === '' ? '' : Number(event.target.value)
                        })
                      }
                    />
                  </label>
                </div>
              </article>
            ))}
          </div>
        </section>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="sticky-actions">
          <button className="button primary" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save workout'}
          </button>
        </div>
      </form>
    </main>
  );
}
