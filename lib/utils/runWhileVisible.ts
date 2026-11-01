/**
 * Run a task on an interval only while the tab is visible.
 * Hidden tabs stop polling so idle visitors do not keep hitting the API.
 */
export function runWhileVisible(task: () => void, intervalMs: number): () => void {
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const start = () => {
    if (intervalId !== null) return;
    intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') task();
    }, intervalMs);
  };

  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      task();
      start();
    } else {
      stop();
    }
  };

  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    task();
    start();
  }
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    stop();
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
