type PrimedCamera = {
  facing: 'environment' | 'user';
  stream: Promise<MediaStream | null>;
};

let pending: PrimedCamera | null = null;

export function canUseLiveCamera(): boolean {
  return typeof window !== 'undefined'
    && typeof navigator.mediaDevices?.getUserMedia === 'function';
}

/** A computer webcam is 16:9, the same wide frame Google Meet uses. Phones stay 4:3. */
export function desktopWideCamera(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia('(min-width: 1024px) and (pointer: fine)').matches;
}

export function liveCameraConstraints(facing: 'environment' | 'user'): MediaStreamConstraints {
  // Phones: Safari adds 640x480 when no size is given, which looks blurry next to the native camera.
  // Ask for the 4:3 photo frame as an ideal only, so no phone can reject it.
  if (!desktopWideCamera()) {
    return {
      audio: false,
      video: {
        facingMode: facing,
        width: { ideal: 1920 },
        height: { ideal: 1440 },
      },
    };
  }
  return {
    audio: false,
    video: {
      facingMode: facing,
      aspectRatio: { ideal: 16 / 9 },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  };
}

/** Open the camera sharp, falling back to a facing mode alone on phones that still refuse sizes. */
export async function openLiveCamera(facing: 'environment' | 'user'): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia(liveCameraConstraints(facing));
  } catch (error) {
    if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) throw error;
    return navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: facing } });
  }
}

/** Keep focus, exposure and white balance on auto where the browser allows it (Chrome on Android). */
export async function autoFocusTrack(track: MediaStreamTrack | undefined) {
  if (!track?.getCapabilities) return;
  const caps = track.getCapabilities() as Record<string, unknown>;
  const advanced: Record<string, string>[] = [];
  for (const key of ['focusMode', 'exposureMode', 'whiteBalanceMode']) {
    const modes = caps[key];
    if (Array.isArray(modes) && modes.includes('continuous')) advanced.push({ [key]: 'continuous' });
  }
  if (advanced.length === 0) return;
  try {
    await track.applyConstraints({ advanced } as MediaTrackConstraints);
  } catch {
    // Auto is already the default.
  }
}

/** Ask the open track for its widest 16:9 mode so the preview is not a center crop. */
export async function widenDesktopTrack(track: MediaStreamTrack | undefined) {
  if (!track || !desktopWideCamera()) return;
  const caps = track.getCapabilities?.();
  const maxWidth = caps?.width?.max ?? 1920;
  const maxHeight = caps?.height?.max ?? 1080;
  const width = Math.min(maxWidth, 1920);
  const height = Math.min(maxHeight, Math.round(width * 9 / 16));
  try {
    await track.applyConstraints({
      width: { ideal: width },
      height: { ideal: height },
      aspectRatio: { ideal: 16 / 9 },
    });
  } catch {
    // The stream already asked for 16:9.
  }
}

/**
 * Phones only open the camera from the tap that asked for it.
 * Call this in that click, before any await, so the preview can start on its own.
 */
export function primeLiveCamera(facing: 'environment' | 'user' = 'environment') {
  if (!canUseLiveCamera() || pending) return;
  const request = openLiveCamera(facing);
  pending = {
    facing,
    stream: request.then((stream) => {
      const preview = document.createElement('video');
      preview.muted = true;
      preview.playsInline = true;
      preview.setAttribute('playsinline', 'true');
      preview.srcObject = stream;
      void preview.play().catch(() => undefined);
      return stream;
    }).catch(() => null),
  };
}

/** The stream requested by the opening tap. Several starts can share it. */
export function readPrimedCamera(facing: 'environment' | 'user'): Promise<MediaStream | null> | null {
  if (!pending) return null;
  if (pending.facing !== facing) {
    releasePrimedCamera();
    return null;
  }
  return pending.stream;
}

export function clearPrimedCamera() {
  pending = null;
}

export function releasePrimedCamera() {
  const current = pending;
  pending = null;
  void current?.stream.then((stream) => stream?.getTracks().forEach((track) => track.stop()));
}
