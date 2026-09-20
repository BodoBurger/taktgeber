import { z } from "zod";

export const configSchema = z.object({
  seconds: z.number().int().min(5).max(600),
  rest: z.number().int().min(0).max(180),
  reps: z.number().int().min(1).max(100),
  sets: z.number().int().min(1).max(5),
  rounds: z.number().int().min(1).max(5),
  unit: z.enum(["kg", "lb"]),
});
export type WorkoutConfig = z.infer<typeof configSchema>;
export const defaultConfig: WorkoutConfig = {
  seconds: 30,
  rest: 15,
  reps: 10,
  sets: 1,
  rounds: 2,
  unit: "kg",
};

const shared = {
  id: z.string(),
  exerciseId: z.string(),
  name: z.string(),
  instruction: z.string(),
  set: z.number().int().positive(),
  round: z.number().int().positive(),
};
export const stepSchema = z.discriminatedUnion("kind", [
  z.object({
    ...shared,
    kind: z.literal("timed"),
    phase: z.enum(["prepare", "exercise", "rest"]),
    seconds: z.number().positive(),
  }),
  z.object({
    ...shared,
    kind: z.literal("manual"),
    reps: z.number().int().positive(),
    weightLabel: z.string(),
  }),
]);
export type Step = z.infer<typeof stepSchema>;

export const exercises = [
  {
    id: "squats",
    name: "Bodyweight squats",
    instruction: "Sit back. Keep your chest tall. Find a steady pace.",
    kind: "timed",
  },
  {
    id: "rows",
    name: "Dumbbell rows",
    instruction: "Keep your back long. Complete the target reps on each side.",
    kind: "manual",
  },
  {
    id: "plank",
    name: "Forearm plank",
    instruction: "Brace your core. Breathe slowly. Keep a straight line.",
    kind: "timed",
  },
] as const;

export function buildSteps(input: WorkoutConfig): Step[] {
  const config = configSchema.parse(input);
  const steps: Step[] = [
    {
      id: "prepare",
      exerciseId: "",
      name: "Get ready",
      instruction: "Take a breath. Your first set is coming up.",
      set: 1,
      round: 1,
      kind: "timed",
      phase: "prepare",
      seconds: 5,
    },
  ];
  for (let round = 1; round <= config.rounds; round++) {
    for (const exercise of exercises) {
      for (let set = 1; set <= config.sets; set++) {
        const id = `${round}-${exercise.id}-${set}`;
        const base = {
          id,
          exerciseId: exercise.id,
          name: exercise.name,
          instruction: exercise.instruction,
          set,
          round,
        };
        steps.push(
          exercise.kind === "manual"
            ? {
                ...base,
                kind: "manual",
                reps: config.reps,
                weightLabel: "Weight per dumbbell",
              }
            : {
                ...base,
                kind: "timed",
                phase: "exercise",
                seconds: config.seconds,
              },
        );
        const isLast =
          round === config.rounds &&
          exercise.id === "plank" &&
          set === config.sets;
        if (config.rest && !isLast)
          steps.push({
            ...base,
            id: `${id}-rest`,
            exerciseId: "",
            name: "Take a breather",
            instruction: "Relax your shoulders. Get ready for the next set.",
            kind: "timed",
            phase: "rest",
            seconds: config.rest,
          });
      }
    }
  }
  return steps;
}
