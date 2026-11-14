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
  // Phones reject size and aspect limits. A facing mode alone is what opens the camera.
  if (!desktopWideCamera()) {
    return { audio: false, video: { facingMode: facing } };
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
  const request = navigator.mediaDevices.getUserMedia(liveCameraConstraints(facing));
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
