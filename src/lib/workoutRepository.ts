import { db } from './database';
import type {
  Exercise,
  SyncStatus,
  Workout,
  WorkoutFormInput,
  WorkoutRecord
} from './types';
import { clampInteger, createId, nowIso } from './utils';

const DEMO_SEEDED_KEY = 'workout-timer-demo-seeded';

function nextMutationStatus(current?: SyncStatus): SyncStatus {
  return current === 'pending_create' ? 'pending_create' : 'pending_update';
}

function nextDeleteStatus(): SyncStatus {
  return 'pending_delete';
}

function normalizeWorkoutRecord(record: WorkoutRecord, exercises: Exercise[]): Workout {
  return {
    ...record,
    exercises: exercises
      .filter((exercise) => !exercise.deleted_at)
      .sort((a, b) => a.position - b.position)
  };
}

function normalizeExerciseInput(
  value: number | null | undefined,
  fallback: number,
  allowZero = false
): number | null {
  if (value === null || value === undefined || value === 0) {
    return allowZero ? 0 : null;
  }

  return clampInteger(value, fallback);
}

export async function ensureDemoWorkout(): Promise<void> {
  if (localStorage.getItem(DEMO_SEEDED_KEY)) {
    return;
  }

  const existingWorkoutCount = await db.workouts.count();

  if (existingWorkoutCount === 0) {
    await saveWorkout({
      name: 'Starter HIIT',
      rounds: 3,
      exercises: [
        {
          name: 'Jumping Jacks',
          duration_seconds: 30,
          break_seconds: 15,
          position: 0
        },
        {
          name: 'Push-ups',
          duration_seconds: 30,
          break_seconds: 15,
          position: 1
        },
        {
          name: 'Squats',
          duration_seconds: 40,
          break_seconds: 20,
          position: 2
        },
        {
          name: 'Plank',
          duration_seconds: 45,
          break_seconds: 30,
          position: 3
        }
      ]
    });
  }

  localStorage.setItem(DEMO_SEEDED_KEY, 'true');
}

export async function listWorkouts(includeDeleted = false): Promise<Workout[]> {
  const records = await db.workouts.orderBy('updated_at').reverse().toArray();
  const visibleRecords = includeDeleted
    ? records
    : records.filter((record) => !record.deleted_at);

  const workouts = await Promise.all(
    visibleRecords.map(async (record) => {
      const exercises = await db.exercises
        .where('workout_id')
        .equals(record.id)
        .sortBy('position');

      return normalizeWorkoutRecord(record, exercises);
    })
  );

  return workouts;
}

export async function getWorkout(id: string): Promise<Workout | null> {
  const record = await db.workouts.get(id);

  if (!record || record.deleted_at) {
    return null;
  }

  const exercises = await db.exercises.where('workout_id').equals(id).sortBy('position');
  return normalizeWorkoutRecord(record, exercises);
}

export async function saveWorkout(
  input: WorkoutFormInput,
  userId?: string | null
): Promise<Workout> {
  const now = nowIso();
  const workoutId = input.id ?? createId();
  const existingWorkout = await db.workouts.get(workoutId);
  const existingExercises = await db.exercises
    .where('workout_id')
    .equals(workoutId)
    .toArray();
  const incomingIds = new Set<string>();
  const cleanName = input.name.trim() || 'Untitled workout';
  const ownerId = userId ?? existingWorkout?.user_id ?? null;

  const workoutRecord: WorkoutRecord = {
    id: workoutId,
    user_id: ownerId,
    name: cleanName,
    rounds: clampInteger(input.rounds, 1),
    created_at: existingWorkout?.created_at ?? now,
    updated_at: now,
    deleted_at: null,
    sync_status: existingWorkout
      ? nextMutationStatus(existingWorkout.sync_status)
      : 'pending_create'
  };

  const exerciseRecords: Exercise[] = input.exercises.map((exercise, index) => {
    const exerciseId = exercise.id ?? createId();
    const existingExercise = existingExercises.find((item) => item.id === exerciseId);
    incomingIds.add(exerciseId);

    return {
      id: exerciseId,
      workout_id: workoutId,
      user_id: ownerId,
      name: exercise.name.trim() || `Exercise ${index + 1}`,
      duration_seconds: clampInteger(exercise.duration_seconds, 1),
      break_seconds: normalizeExerciseInput(exercise.break_seconds, 0),
      position: index,
      created_at: existingExercise?.created_at ?? now,
      updated_at: now,
      deleted_at: null,
      sync_status: existingExercise
        ? nextMutationStatus(existingExercise.sync_status)
        : 'pending_create'
    };
  });

  const deletedExerciseRecords = existingExercises
    .filter((exercise) => !incomingIds.has(exercise.id) && !exercise.deleted_at)
    .map<Exercise>((exercise) => ({
      ...exercise,
      user_id: ownerId,
      updated_at: now,
      deleted_at: now,
      sync_status: nextDeleteStatus()
    }));

  await db.transaction('rw', db.workouts, db.exercises, async () => {
    await db.workouts.put(workoutRecord);

    if (exerciseRecords.length > 0) {
      await db.exercises.bulkPut(exerciseRecords);
    }

    if (deletedExerciseRecords.length > 0) {
      await db.exercises.bulkPut(deletedExerciseRecords);
    }
  });

  const savedWorkout = await getWorkout(workoutId);

  if (!savedWorkout) {
    throw new Error('Workout could not be saved.');
  }

  return savedWorkout;
}

export async function duplicateWorkout(id: string): Promise<Workout | null> {
  const workout = await getWorkout(id);

  if (!workout) {
    return null;
  }

  return saveWorkout({
    name: `${workout.name} Copy`,
    rounds: workout.rounds,
    exercises: workout.exercises.map((exercise, index) => ({
      name: exercise.name,
      duration_seconds: exercise.duration_seconds,
      break_seconds: exercise.break_seconds,
      position: index
    }))
  });
}

export async function softDeleteWorkout(id: string): Promise<void> {
  const now = nowIso();
  const workout = await db.workouts.get(id);

  if (!workout) {
    return;
  }

  const exercises = await db.exercises.where('workout_id').equals(id).toArray();

  await db.transaction('rw', db.workouts, db.exercises, async () => {
    await db.workouts.put({
      ...workout,
      updated_at: now,
      deleted_at: now,
      sync_status: nextDeleteStatus()
    });

    if (exercises.length > 0) {
      await db.exercises.bulkPut(
        exercises.map((exercise) => ({
          ...exercise,
          updated_at: now,
          deleted_at: exercise.deleted_at ?? now,
          sync_status: nextDeleteStatus()
        }))
      );
    }
  });
}
