import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { BrowserAudio } from "../src/platform/browser";

class FakeAudio {
  src = "";
  volume = 1;
  currentTime = 0;
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
}

describe("browser audio", () => {
  let audio: FakeAudio;
  let audioSession: { type: string };

  beforeEach(() => {
    audio = new FakeAudio();
    audioSession = { type: "auto" };
    vi.stubGlobal(
      "Audio",
      class {
        constructor() {
          return audio;
        }
      },
    );
    vi.stubGlobal("navigator", { audioSession });
    vi.stubGlobal("window", globalThis);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:cue");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("primes one HTML audio channel when unlocked", async () => {
    const service = new BrowserAudio();

    const unlocking = service.unlock();

    expect(audio.play).toHaveBeenCalledOnce();
    expect(audio.src).toBe("blob:cue");
    await unlocking;
    expect(audioSession.type).toBe("transient");
    expect(audio.pause).toHaveBeenCalledOnce();
    expect(service.state).toBe("running");
  });

  test("plays later timer cues through the primed channel", async () => {
    const service = new BrowserAudio();
    await service.unlock();
    audio.play.mockClear();

    await expect(service.play("finish", "wood", 0.4)).resolves.toBe(true);

    expect(audio.play).toHaveBeenCalledOnce();
    expect(audio.volume).toBe(0.4);
    expect(audio.currentTime).toBe(0);
  });

  test("requires another tap if iOS rejects later playback", async () => {
    const service = new BrowserAudio();
    await service.unlock();
    audio.play.mockRejectedValueOnce(new Error("interrupted"));

    await expect(service.play("countdown", "soft", 1)).resolves.toBe(false);
    expect(service.state).toBe("not enabled");
  });
});
