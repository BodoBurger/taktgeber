import Dexie, { type Table } from 'dexie';
import type { Exercise, WorkoutRecord } from './types';

class WorkoutTimerDatabase extends Dexie {
  workouts!: Table<WorkoutRecord, string>;
  exercises!: Table<Exercise, string>;

  constructor() {
    super('workout_timer_pwa');

    this.version(1).stores({
      workouts: '&id, user_id, sync_status, updated_at, deleted_at',
      exercises:
        '&id, workout_id, user_id, sync_status, position, updated_at, deleted_at'
    });
  }
}

export const db = new WorkoutTimerDatabase();
