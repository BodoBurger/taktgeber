import { db } from './database';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import type { Exercise, SyncSummary, WorkoutRecord } from './types';

type RemoteWorkout = Omit<WorkoutRecord, 'sync_status'>;
type RemoteExercise = Omit<Exercise, 'sync_status'>;

function toRemoteWorkout(record: WorkoutRecord, userId: string): RemoteWorkout {
  const { sync_status: _syncStatus, ...remote } = record;
  return { ...remote, user_id: userId };
}

function toRemoteExercise(record: Exercise, userId: string): RemoteExercise {
  const { sync_status: _syncStatus, ...remote } = record;
  return { ...remote, user_id: userId };
}

export async function syncNow(userId: string): Promise<SyncSummary> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }

  if (!navigator.onLine) {
    return { pushed: 0, pulled: 0 };
  }

  const pushed = await pushPendingChanges(userId);
  const pulled = await pullRemoteChanges(userId);

  return { pushed, pulled };
}

async function pushPendingChanges(userId: string): Promise<number> {
  const client = getSupabaseClient();
  let pushed = 0;

  const pendingWorkoutUpserts = await db.workouts
    .where('sync_status')
    .anyOf('pending_create', 'pending_update')
    .toArray();
  const activeWorkoutUpserts = pendingWorkoutUpserts.filter(
    (workout) => !workout.deleted_at
  );

  if (activeWorkoutUpserts.length > 0) {
    const { error } = await client
      .from('workouts')
      .upsert(activeWorkoutUpserts.map((workout) => toRemoteWorkout(workout, userId)), {
        onConflict: 'id'
      });

    if (error) {
      throw error;
    }

    await db.transaction('rw', db.workouts, async () => {
      await Promise.all(
        activeWorkoutUpserts.map((workout) =>
          db.workouts.update(workout.id, {
            user_id: userId,
            sync_status: 'synced'
          })
        )
      );
    });
    pushed += activeWorkoutUpserts.length;
  }

  const deletedWorkoutIds = new Set(
    (await db.workouts.where('sync_status').equals('pending_delete').toArray()).map(
      (workout) => workout.id
    )
  );
  const pendingExerciseUpserts = await db.exercises
    .where('sync_status')
    .anyOf('pending_create', 'pending_update')
    .toArray();
  const activeExerciseUpserts = pendingExerciseUpserts.filter(
    (exercise) => !exercise.deleted_at && !deletedWorkoutIds.has(exercise.workout_id)
  );

  if (activeExerciseUpserts.length > 0) {
    const { error } = await client
      .from('exercises')
      .upsert(activeExerciseUpserts.map((exercise) => toRemoteExercise(exercise, userId)), {
        onConflict: 'id'
      });

    if (error) {
      throw error;
    }

    await db.transaction('rw', db.exercises, async () => {
      await Promise.all(
        activeExerciseUpserts.map((exercise) =>
          db.exercises.update(exercise.id, {
            user_id: userId,
            sync_status: 'synced'
          })
        )
      );
    });
    pushed += activeExerciseUpserts.length;
  }

  const pendingExerciseDeletes = await db.exercises
    .where('sync_status')
    .equals('pending_delete')
    .toArray();

  for (const exercise of pendingExerciseDeletes) {
    if (exercise.user_id) {
      const { error } = await client
        .from('exercises')
        .update({
          deleted_at: exercise.deleted_at,
          updated_at: exercise.updated_at
        })
        .eq('id', exercise.id)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }
    }

    await db.exercises.update(exercise.id, {
      user_id: userId,
      sync_status: 'synced'
    });
    pushed += 1;
  }

  const pendingWorkoutDeletes = await db.workouts
    .where('sync_status')
    .equals('pending_delete')
    .toArray();

  for (const workout of pendingWorkoutDeletes) {
    if (workout.user_id) {
      const { error } = await client
        .from('workouts')
        .update({
          deleted_at: workout.deleted_at,
          updated_at: workout.updated_at
        })
        .eq('id', workout.id)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }
    }

    await db.workouts.update(workout.id, {
      user_id: userId,
      sync_status: 'synced'
    });
    pushed += 1;
  }

  return pushed;
}

async function pullRemoteChanges(userId: string): Promise<number> {
  const client = getSupabaseClient();

  const [{ data: remoteWorkouts, error: workoutError }, { data: remoteExercises, error: exerciseError }] =
    await Promise.all([
      client.from('workouts').select('*').eq('user_id', userId),
      client.from('exercises').select('*').eq('user_id', userId)
    ]);

  if (workoutError) {
    throw workoutError;
  }

  if (exerciseError) {
    throw exerciseError;
  }

  let pulled = 0;

  await db.transaction('rw', db.workouts, db.exercises, async () => {
    for (const remoteWorkout of (remoteWorkouts ?? []) as RemoteWorkout[]) {
      const localWorkout = await db.workouts.get(remoteWorkout.id);

      if (localWorkout && localWorkout.sync_status !== 'synced') {
        continue;
      }

      await db.workouts.put({
        ...remoteWorkout,
        sync_status: 'synced'
      });
      pulled += 1;
    }

    for (const remoteExercise of (remoteExercises ?? []) as RemoteExercise[]) {
      const localExercise = await db.exercises.get(remoteExercise.id);

      if (localExercise && localExercise.sync_status !== 'synced') {
        continue;
      }

      await db.exercises.put({
        ...remoteExercise,
        sync_status: 'synced'
      });
      pulled += 1;
    }
  });

  return pulled;
}
