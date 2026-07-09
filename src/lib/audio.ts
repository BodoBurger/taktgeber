import type { TimerStepType } from './types';

type AudioContextConstructor = typeof AudioContext;

declare global {
  interface Window {
    webkitAudioContext?: AudioContextConstructor;
  }
}

export class TimerAudio {
  private context: AudioContext;

  constructor(context: AudioContext) {
    this.context = context;
  }

  async resume(): Promise<void> {
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  playStepStart(type: TimerStepType): void {
    if (type === 'exercise') {
      this.playTone(880, 0.12, 0.22);
      window.setTimeout(() => this.playTone(1100, 0.1, 0.18), 130);
      return;
    }

    this.playTone(440, 0.18, 0.18);
  }

  playWorkoutFinished(): void {
    [660, 880, 990].forEach((frequency, index) => {
      window.setTimeout(() => this.playTone(frequency, 0.18, 0.2), index * 160);
    });
  }

  private playTone(frequency: number, duration: number, volume: number): void {
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const start = this.context.currentTime;

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }
}

export async function createTimerAudio(): Promise<TimerAudio> {
  const Context = window.AudioContext ?? window.webkitAudioContext;

  if (!Context) {
    throw new Error('Audio is not supported in this browser.');
  }

  const audio = new TimerAudio(new Context());
  await audio.resume();
  return audio;
}
