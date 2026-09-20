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

const SAMPLE_RATE = 22_050;

function wavUrl(cue?: Cue, sound: Sound = "soft") {
  const notes = cue
    ? cue === "finish"
      ? [1, 1.25, 1.5]
      : cue === "change"
        ? [1, 1.5]
        : [1]
    : [];
  const duration = cue ? (notes.length - 1) * 0.16 + 0.15 : 0.02;
  const samples = Math.ceil(duration * SAMPLE_RATE);
  const bytes = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(bytes);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++)
      view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples * 2, true);

  const base = sound === "soft" ? 520 : sound === "bright" ? 880 : 240;
  for (let i = 0; i < samples; i++) {
    const at = i / SAMPLE_RATE;
    const note = Math.floor(at / 0.16);
    const elapsed = at - note * 0.16;
    let value = 0;
    if (notes[note] && elapsed < 0.15) {
      const phase = 2 * Math.PI * base * notes[note] * elapsed;
      const wave =
        sound === "wood"
          ? (2 / Math.PI) * Math.asin(Math.sin(phase))
          : Math.sin(phase);
      const envelope =
        elapsed < 0.008 ? elapsed / 0.008 : Math.exp(-38 * (elapsed - 0.008));
      value = wave * envelope * 0.9;
    }
    view.setInt16(44 + i * 2, Math.round(value * 0x7fff), true);
  }
  return URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
}

export class BrowserAudio {
  private readonly element = new Audio();
  private readonly urls = new Map<string, string>();
  private enabled = false;

  private url(cue?: Cue, sound: Sound = "soft") {
    const key = cue ? `${sound}-${cue}` : "silence";
    let url = this.urls.get(key);
    if (!url) {
      url = wavUrl(cue, sound);
      this.urls.set(key, url);
    }
    return url;
  }

  async unlock() {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = "transient";
    if (this.enabled) return;
    this.element.src = this.url();
    this.element.volume = 1;
    let timeout = 0;
    try {
      await Promise.race([
        this.element.play(),
        new Promise<never>(
          (_, reject) =>
            (timeout = window.setTimeout(() => {
              this.element.pause();
              reject(new Error("Tap Test sound to enable audio."));
            }, 2000)),
        ),
      ]);
      this.element.pause();
      this.element.currentTime = 0;
      this.enabled = true;
    } catch (error) {
      this.enabled = false;
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  get state() {
    return this.enabled ? "running" : "not enabled";
  }
  async play(cue: Cue, sound: Sound, volume: number) {
    if (!this.enabled) return false;
    this.element.pause();
    this.element.src = this.url(cue, sound);
    this.element.currentTime = 0;
    this.element.volume = volume;
    try {
      await this.element.play();
      return true;
    } catch {
      this.enabled = false;
      return false;
    }
  }
  silence() {
    this.element.pause();
    this.element.currentTime = 0;
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
