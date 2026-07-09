export type SyncStatus =
  | 'synced'
  | 'pending_create'
  | 'pending_update'
  | 'pending_delete';

export interface Exercise {
  id: string;
  workout_id: string;
  user_id?: string | null;
  name: string;
  duration_seconds: number;
  break_seconds?: number | null;
  position: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  sync_status: SyncStatus;
}

export interface Workout {
  id: string;
  user_id?: string | null;
  name: string;
  rounds: number;
  exercises: Exercise[];
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  sync_status: SyncStatus;
}

export type WorkoutRecord = Omit<Workout, 'exercises'>;

export type TimerStepType = 'exercise' | 'break';

export interface TimerStep {
  id: string;
  type: TimerStepType;
  workout_id: string;
  exercise_id: string;
  name: string;
  duration_seconds: number;
  round: number;
  total_rounds: number;
  exercise_position: number;
}

export interface WorkoutFormExercise {
  id?: string;
  name: string;
  duration_seconds: number;
  break_seconds?: number | null;
  position: number;
}

export interface WorkoutFormInput {
  id?: string;
  name: string;
  rounds: number;
  exercises: WorkoutFormExercise[];
}

export interface SyncSummary {
  pushed: number;
  pulled: number;
}
