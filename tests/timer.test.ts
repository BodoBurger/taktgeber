import { describe, expect, it } from "vitest";
import { buildSteps, defaultConfig } from "../src/domain/workout";
import {
  completeManual,
  currentStep,
  durationMs,
  finish,
  pause,
  reconcile,
  remainingMs,
  resume,
  sessionSchema,
  skip,
  startSession,
} from "../src/domain/timer";

const config = { ...defaultConfig, seconds: 10, rest: 5, rounds: 1 };
const start = () => startSession(config, 1000, "session");

describe("workout sequence", () => {
  it("expands exercise sets inside rounds with a single rest between sets", () => {
    const steps = buildSteps({ ...config, sets: 2, rounds: 2 });
    expect(steps.filter((s) => s.exerciseId)).toHaveLength(12);
    expect(
      steps.filter((s) => s.kind === "timed" && s.phase === "rest"),
    ).toHaveLength(11);
    expect(
      steps
        .filter((s) => s.exerciseId)
        .map((s) => s.exerciseId)
        .slice(0, 6),
    ).toEqual(["squats", "squats", "rows", "rows", "plank", "plank"]);
    expect(steps.at(-1)).toMatchObject({
      name: "Forearm plank",
      round: 2,
      set: 2,
    });
  });
  it("omits all rests when configured to zero", () => {
    expect(
      buildSteps({ ...config, rest: 0 }).filter(
        (s) => s.kind === "timed" && s.phase === "rest",
      ),
    ).toHaveLength(0);
  });
  it("rejects invalid configuration at the domain boundary", () => {
    expect(() => buildSteps({ ...config, rounds: 0 })).toThrow();
    expect(() => buildSteps({ ...config, seconds: NaN })).toThrow();
  });
});

describe("timestamp timer", () => {
  it("moves across timed steps using their deadlines, not callback time", () => {
    const next = reconcile(start(), 18500);
    expect(currentStep(next)).toMatchObject({ phase: "rest" });
    expect(next.stepStartedAt).toBe(16000);
    expect(remainingMs(next, 18500)).toBe(2500);
    expect(next.results).toEqual([
      { stepId: "1-squats-1", outcome: "completed" },
    ]);
  });
  it("stops long background recovery at a manual step without inventing reps", () => {
    const next = reconcile(start(), 3600000, true);
    expect(currentStep(next)).toMatchObject({
      kind: "manual",
      name: "Dumbbell rows",
    });
    expect(next.results).toEqual([
      { stepId: "1-squats-1", outcome: "unconfirmed" },
    ]);
    expect(reconcile(next, 7200000, true)).toBe(next);
  });
  it("does not change a timer when no deadline has passed", () => {
    const initial = start();
    expect(reconcile(initial, 1200)).toBe(initial);
    expect(remainingMs(initial, 1200)).toBe(4800);
  });
  it("pauses without counting pause time in the active duration", () => {
    const frozen = pause(reconcile(start(), 9000), 10000);
    expect(remainingMs(frozen, 60000)).toBe(6000);
    expect(reconcile(frozen, 60000)).toBe(frozen);
    expect(durationMs(frozen, 60000)).toBe(9000);
    const running = resume(frozen, 60000);
    expect(remainingMs(running, 61000)).toBe(5000);
    expect(durationMs(running, 61000)).toBe(10000);
    expect(running.pausedMs).toBe(50000);
  });
  it("preserves original sessions when applying transitions", () => {
    const initial = start();
    reconcile(initial, 22000);
    expect(initial.index).toBe(0);
    expect(initial.results).toHaveLength(0);
  });
  it("records actual reps and optional weight only on manual completion", () => {
    const manual = reconcile(start(), 22000);
    const next = completeManual(manual, 24000, 8, 12.5);
    expect(next.results.at(-1)).toEqual({
      stepId: "1-rows-1",
      outcome: "completed",
      reps: 8,
      weight: 12.5,
    });
    expect(next.stepStartedAt).toBe(24000);
    expect(currentStep(next)).toMatchObject({ phase: "rest" });
  });
  it("rejects invalid results and cannot complete a paused or timed set manually", () => {
    const initial = start();
    expect(completeManual(initial, 1500, 10)).toBe(initial);
    const manual = reconcile(initial, 22000);
    expect(() => completeManual(manual, 23000, -1)).toThrow();
    expect(() => completeManual(manual, 23000, 10, NaN)).toThrow();
    const frozen = pause(manual, 23000);
    expect(completeManual(frozen, 24000, 10)).toBe(frozen);
  });
  it("skips an exercise without counting it as completed", () => {
    const next = skip(reconcile(start(), 8000), 9000);
    expect(next.results).toEqual([
      { stepId: "1-squats-1", outcome: "skipped" },
    ]);
    expect(next.results.filter((r) => r.outcome === "completed")).toHaveLength(
      0,
    );
  });
  it("does not skip the next step when a delayed click lands beyond a deadline", () => {
    const next = skip(reconcile(start(), 8000), 17000);
    expect(currentStep(next)).toMatchObject({ phase: "rest" });
    expect(next.results[0].outcome).toBe("completed");
  });
  it("finishes at the last deadline even when the next tick is late", () => {
    const manual = reconcile(start(), 22000);
    const next = reconcile(completeManual(manual, 25000, 10), 50000);
    expect(next.status).toBe("finished");
    expect(next.endedAt).toBe(40000);
    expect(durationMs(next, 90000)).toBe(39000);
    expect(next.results).toHaveLength(3);
  });
  it("finishes a paused workout with correct active and wall-clock durations", () => {
    const done = finish(pause(reconcile(start(), 8000), 9000), 20000);
    expect(durationMs(done, 20000)).toBe(8000);
    expect(done.endedAt! - done.startedAt).toBe(19000);
    expect(done.pausedAt).toBeNull();
    expect(done.results).toHaveLength(0);
  });
  it("restores a serialized session and retains a snapshot of configuration", () => {
    const editable = { ...config };
    const session = startSession(editable, 1000, "saved");
    editable.seconds = 90;
    expect(session.config.seconds).toBe(10);
    expect(
      currentStep(
        reconcile(
          sessionSchema.parse(JSON.parse(JSON.stringify(session))),
          22000,
          true,
        ),
      )?.kind,
    ).toBe("manual");
  });
  it("rejects corrupted saved session indices and pause state", () => {
    expect(() => sessionSchema.parse({ ...start(), index: 900 })).toThrow();
    expect(() =>
      sessionSchema.parse({ ...start(), status: "paused" }),
    ).toThrow();
  });
});
