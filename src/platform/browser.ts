/** Platform services stay outside the workout domain for a future native implementation. */
export class BrowserClock {
  private wall = Date.now();
  private monotonic = performance.now();
  now() {
    return this.wall + performance.now() - this.monotonic;
  }
  reanchor(floor = 0) {
    const wall = Date.now();
    this.wall = Math.max(wall, floor);
    this.monotonic = performance.now();
    return wall < floor;
  }
}

export type Sound = "soft" | "bright" | "wood";
export type Cue = "countdown" | "change" | "finish";
export class BrowserAudio {
  private context: AudioContext | null = null;
  private voices = new Set<OscillatorNode>();
  async unlock() {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = "ambient";
    this.context ??= new AudioContext();
    if (this.context.state !== "running") {
      await Promise.race([
        this.context.resume(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Tap Test sound to enable audio.")),
            2000,
          ),
        ),
      ]);
    }
    if (this.context.state !== "running")
      throw new Error("Audio is unavailable. Tap Test sound to retry.");
  }
  get state() {
    return this.context?.state ?? "not enabled";
  }
  play(cue: Cue, sound: Sound, volume: number) {
    const ctx = this.context;
    if (!ctx || ctx.state !== "running") return false;
    const base = sound === "soft" ? 520 : sound === "bright" ? 880 : 240;
    const notes =
      cue === "finish" ? [1, 1.25, 1.5] : cue === "change" ? [1, 1.5] : [1];
    notes.forEach((ratio, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = ctx.currentTime + index * 0.16;
      oscillator.type = sound === "wood" ? "triangle" : "sine";
      oscillator.frequency.value = base * ratio;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(volume * 0.25, at + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.13);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      this.voices.add(oscillator);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        this.voices.delete(oscillator);
      };
      oscillator.start(at);
      oscillator.stop(at + 0.15);
    });
    return true;
  }
  silence() {
    for (const voice of this.voices) {
      try {
        voice.stop();
      } catch {
        /* Already ended. */
      }
    }
  }
}

export type WakeStatus =
  "off" | "requesting" | "active" | "released" | "unavailable";
export class BrowserWakeLock {
  private lock: WakeLockSentinel | null = null;
  private wanted = false;
  private requestId = 0;
  constructor(private onChange: (status: WakeStatus) => void) {}
  async setWanted(wanted: boolean) {
    this.wanted = wanted;
    const request = ++this.requestId;
    if (!wanted) {
      const lock = this.lock;
      this.lock = null;
      await lock?.release().catch(() => {});
      if (request === this.requestId) this.onChange("off");
      return;
    }
    if (!window.isSecureContext || !("wakeLock" in navigator)) {
      this.onChange("unavailable");
      return;
    }
    if (document.visibilityState !== "visible") {
      this.onChange("released");
      return;
    }
    if (this.lock && !this.lock.released) {
      this.onChange("active");
      return;
    }
    this.onChange("requesting");
    try {
      const lock = await navigator.wakeLock.request("screen");
      if (!this.wanted || request !== this.requestId) {
        await lock.release();
        return;
      }
      this.lock = lock;
      this.onChange("active");
      lock.addEventListener("release", () => {
        if (this.lock === lock) {
          this.lock = null;
          this.onChange(this.wanted ? "released" : "off");
        }
      });
    } catch {
      if (request === this.requestId) this.onChange("unavailable");
    }
  }
}

export function downloadJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
