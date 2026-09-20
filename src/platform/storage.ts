import { openDB } from "idb";
import { z } from "zod";
import { configSchema, defaultConfig } from "../domain/workout";
import { sessionSchema } from "../domain/timer";

export const preferencesSchema = z.object({
  sound: z.enum(["soft", "bright", "wood"]),
  volume: z.number().min(0).max(1),
  muted: z.boolean(),
  countdown: z.boolean(),
  wakeLock: z.boolean(),
  vibration: z.boolean(),
});
export const snapshotSchema = z.object({
  schemaVersion: z.literal(1),
  savedAt: z.number(),
  config: configSchema,
  preferences: preferencesSchema,
  session: sessionSchema.nullable(),
  history: z.array(sessionSchema),
});
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
export function emptySnapshot(): Snapshot {
  return {
    schemaVersion: 1,
    savedAt: Date.now(),
    config: defaultConfig,
    session: null,
    history: [],
    preferences: {
      sound: "soft",
      volume: 0.6,
      muted: false,
      countdown: true,
      wakeLock: true,
      vibration: false,
    },
  };
}
const database = () =>
  openDB("taktgeber", 1, {
    upgrade(db) {
      db.createObjectStore("prototype");
    },
  });
let pending: Promise<void> = Promise.resolve();
export async function loadSnapshot(): Promise<Snapshot> {
  const db = await database();
  try {
    const saved = await db.get("prototype", "state");
    return saved === undefined ? emptySnapshot() : snapshotSchema.parse(saved);
  } finally {
    db.close();
  }
}
export function saveSnapshot(snapshot: Snapshot): Promise<void> {
  // Serialize writes so a slow earlier save cannot overwrite a more recent transition.
  const write = pending
    .catch(() => {})
    .then(async () => {
      const db = await database();
      try {
        await db.put("prototype", snapshot, "state");
      } finally {
        db.close();
      }
    });
  pending = write;
  return write;
}
