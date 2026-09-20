import { z } from "zod";
import {
  buildSteps,
  configSchema,
  stepSchema,
  type Step,
  type WorkoutConfig,
} from "./workout";

const resultSchema = z.object({
  stepId: z.string(),
  outcome: z.enum(["completed", "skipped", "unconfirmed"]),
  reps: z.number().int().min(0).max(999).optional(),
  weight: z.number().min(0).max(2000).optional(),
});
export const sessionSchema = z
  .object({
    id: z.string(),
    config: configSchema,
    steps: z.array(stepSchema).min(1).max(1000),
    index: z.number().int().nonnegative(),
    status: z.enum(["running", "paused", "finished"]),
    startedAt: z.number().finite(),
    stepStartedAt: z.number().finite(),
    pausedAt: z.number().finite().nullable(),
    pausedMs: z.number().nonnegative(),
    endedAt: z.number().finite().nullable(),
    results: z.array(resultSchema),
    notes: z.record(z.string(), z.string().max(240)),
  })
  .refine(
    (s) =>
      s.index <= s.steps.length &&
      (s.status === "finished"
        ? s.endedAt !== null
        : s.index < s.steps.length) &&
      (s.status === "paused" ? s.pausedAt !== null : s.pausedAt === null),
    "Invalid session state",
  );
export type Session = z.infer<typeof sessionSchema>;
export type SetResult = z.infer<typeof resultSchema>;

export function startSession(
  config: WorkoutConfig,
  now: number,
  id: string,
): Session {
  return {
    id,
    config: { ...config },
    steps: buildSteps(config),
    index: 0,
    status: "running",
    startedAt: now,
    stepStartedAt: now,
    pausedAt: null,
    pausedMs: 0,
    endedAt: null,
    results: [],
    notes: {},
  };
}
export function currentStep(session: Session): Step | undefined {
  return session.steps[session.index];
}
export function remainingMs(session: Session, now: number): number {
  const step = currentStep(session);
  return step?.kind === "timed"
    ? Math.max(
        0,
        step.seconds * 1000 -
          ((session.pausedAt ?? now) - session.stepStartedAt),
      )
    : 0;
}
export function durationMs(session: Session, now: number): number {
  return Math.max(
    0,
    (session.endedAt ?? session.pausedAt ?? now) -
      session.startedAt -
      session.pausedMs,
  );
}
function advance(
  session: Session,
  at: number,
  outcome: SetResult["outcome"],
  values: Pick<SetResult, "reps" | "weight"> = {},
): Session {
  const step = currentStep(session);
  if (!step) return session;
  const results = step.exerciseId
    ? [...session.results, { stepId: step.id, outcome, ...values }]
    : session.results;
  const index = session.index + 1;
  const finished = index === session.steps.length;
  return {
    ...session,
    index,
    results,
    stepStartedAt: at,
    status: finished ? "finished" : "running",
    endedAt: finished ? at : null,
  };
}
/** Catch up against deadlines, never advance past a step needing a human action. */
export function reconcile(
  session: Session,
  now: number,
  recovered = false,
): Session {
  if (session.status !== "running") return session;
  let next = session;
  while (next.status === "running") {
    const step = currentStep(next);
    if (!step || step.kind === "manual" || remainingMs(next, now) > 0) break;
    next = advance(
      next,
      next.stepStartedAt + step.seconds * 1000,
      recovered ? "unconfirmed" : "completed",
    );
  }
  return next;
}
export function pause(session: Session, now: number): Session {
  const next = reconcile(session, now);
  return next.status === "running"
    ? { ...next, status: "paused", pausedAt: now }
    : next;
}
export function resume(session: Session, now: number): Session {
  if (session.status !== "paused" || session.pausedAt === null) return session;
  const delta = Math.max(0, now - session.pausedAt);
  return {
    ...session,
    status: "running",
    stepStartedAt: session.stepStartedAt + delta,
    pausedMs: session.pausedMs + delta,
    pausedAt: null,
  };
}
export function completeManual(
  session: Session,
  now: number,
  reps: number,
  weight?: number,
): Session {
  if (session.status !== "running" || currentStep(session)?.kind !== "manual")
    return session;
  resultSchema.parse({
    stepId: currentStep(session)!.id,
    outcome: "completed",
    reps,
    weight,
  });
  return advance(session, now, "completed", { reps, weight });
}
export function skip(session: Session, now: number): Session {
  if (session.status !== "running") return session;
  const next = reconcile(session, now);
  // A delayed click must not skip a different step than the one the user saw.
  return next.index === session.index ? advance(next, now, "skipped") : next;
}
export function finish(session: Session, now: number): Session {
  if (session.status === "finished") return session;
  session = reconcile(session, now);
  if (session.status === "finished") return session;
  const pausedMs =
    session.pausedMs +
    (session.pausedAt === null ? 0 : Math.max(0, now - session.pausedAt));
  return {
    ...session,
    status: "finished",
    endedAt: now,
    pausedAt: null,
    pausedMs,
  };
}
