import type { TimerStep, Workout } from './types';

export function buildTimerSequence(workout: Workout): TimerStep[] {
  const exercises = workout.exercises
    .filter((exercise) => !exercise.deleted_at)
    .sort((a, b) => a.position - b.position);

  const rounds = Math.max(1, workout.rounds);
  const steps: TimerStep[] = [];

  for (let round = 1; round <= rounds; round += 1) {
    for (const exercise of exercises) {
      steps.push({
        id: `${round}:${exercise.id}:exercise`,
        type: 'exercise',
        workout_id: workout.id,
        exercise_id: exercise.id,
        name: exercise.name,
        duration_seconds: Math.max(1, exercise.duration_seconds),
        round,
        total_rounds: rounds,
        exercise_position: exercise.position
      });

      if (exercise.break_seconds && exercise.break_seconds > 0) {
        steps.push({
          id: `${round}:${exercise.id}:break`,
          type: 'break',
          workout_id: workout.id,
          exercise_id: exercise.id,
          name: `Break after ${exercise.name}`,
          duration_seconds: exercise.break_seconds,
          round,
          total_rounds: rounds,
          exercise_position: exercise.position
        });
      }
    }
  }

  return steps;
}

export function formatDuration(seconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds
      .toString()
      .padStart(2, '0')}`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function calculateWorkoutDuration(workout: Workout): number {
  return buildTimerSequence(workout).reduce(
    (total, step) => total + step.duration_seconds,
    0
  );
}

export function findNextExercise(sequence: TimerStep[], currentIndex: number): TimerStep | null {
  return (
    sequence
      .slice(currentIndex + 1)
      .find((step) => step.type === 'exercise') ?? null
  );
}
