let shutterContext: AudioContext | null = null;

function audioContext(): AudioContext | null {
  const Ctx = typeof window !== 'undefined'
    ? (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
    : null;
  if (!Ctx) return null;
  if (!shutterContext) shutterContext = new Ctx();
  if (shutterContext.state === 'suspended') void shutterContext.resume();
  return shutterContext;
}

/** Call this inside the record tap, before any await, so the click is allowed to play. */
export function primeCameraShutter(): void {
  try {
    audioContext();
  } catch {
    // A missing sound should not block the recording.
  }
}

/** One crisp tick. Two of these, close together, are the phone shutter. */
function shutterTick(ctx: AudioContext, at: number, ms: number, frequency: number, volume: number): void {
  const length = ms / 1000;
  const frames = Math.max(1, Math.floor(ctx.sampleRate * length));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 8;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = frequency;
  filter.Q.value = 1.2;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, at);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(at);
  noise.stop(at + length);
}

/** The short double-click a phone makes when the shutter fires. */
export function playCameraShutter(): void {
  try {
    const ctx = audioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    shutterTick(ctx, now, 10, 4800, 0.85);
    shutterTick(ctx, now + 0.042, 16, 1700, 0.6);
  } catch {
    // A missing sound should not block the recording.
  }
}
