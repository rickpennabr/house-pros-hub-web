/**
 * Message sound: a short two-note chime played when new messages arrive.
 * The on/off setting is per device (like a phone's sound setting) and defaults to on.
 * Built with Web Audio, so there is no sound file to load and it works in every modern browser.
 * Browsers only allow sound after the person has touched the page once; until then it stays silent.
 */
const SOUND_KEY = 'hph-message-sound';
export const MESSAGE_SOUND_CHANGED_EVENT = 'hph:message-sound-changed';

export function messageSoundOn(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SOUND_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setMessageSoundOn(on: boolean) {
  try {
    window.localStorage.setItem(SOUND_KEY, on ? '1' : '0');
  } catch {
    // Storage blocked (private mode): the choice lasts for this visit only.
  }
  window.dispatchEvent(new CustomEvent(MESSAGE_SOUND_CHANGED_EVENT, { detail: on }));
}

type AudioCtor = typeof AudioContext;
let ctx: AudioContext | null = null;
let lastPlayed = 0;

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  const Ctor: AudioCtor | undefined =
    window.AudioContext ?? (window as Window & { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Call from a tap or key press so later chimes are allowed (iOS Safari and Chrome need this). */
export function unlockMessageSound() {
  const audio = audioContext();
  if (audio && audio.state === 'suspended') void audio.resume().catch(() => undefined);
}

/** Play the chime. `force` plays it even when the setting is off (the "Test" button). */
export function playMessageSound(force = false) {
  if (!force && !messageSoundOn()) return;
  // The banner and the unread badge can both fire for one message: one chime.
  const now = Date.now();
  if (!force && now - lastPlayed < 2000) return;
  lastPlayed = now;
  const audio = audioContext();
  if (!audio) return;
  if (audio.state === 'suspended') void audio.resume().catch(() => undefined);
  const start = audio.currentTime + 0.01;
  [
    { freq: 880, at: 0 },
    { freq: 1318.5, at: 0.12 },
  ].forEach(({ freq, at }) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start + at);
    gain.gain.exponentialRampToValueAtTime(0.25, start + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + at + 0.35);
    osc.connect(gain).connect(audio.destination);
    osc.start(start + at);
    osc.stop(start + at + 0.4);
  });
}
