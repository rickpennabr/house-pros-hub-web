/** Active on-site seconds for a visit, excluding completed breaks and an open pause. */
export function computeActiveSeconds(input: {
  startedAt: string | Date;
  endedAt?: string | Date | null;
  breakSeconds?: number | null;
  pauseStartedAt?: string | Date | null;
  now?: Date;
}): number {
  const now = input.now ?? new Date();
  const started = new Date(input.startedAt).getTime();
  const ended = input.endedAt ? new Date(input.endedAt).getTime() : now.getTime();
  const wall = Math.max(0, Math.floor((ended - started) / 1000));
  let breaks = Math.max(0, input.breakSeconds ?? 0);
  if (input.pauseStartedAt) {
    const pauseStarted = new Date(input.pauseStartedAt).getTime();
    breaks += Math.max(0, Math.floor((ended - pauseStarted) / 1000));
  }
  return Math.max(0, wall - breaks);
}

export function computeLaborSeconds(durationSeconds: number, workerCount: number): number {
  return Math.max(0, durationSeconds) * Math.max(1, workerCount);
}

export function formatLaborHours(laborSeconds: number): string {
  const hours = laborSeconds / 3600;
  return `${hours.toFixed(hours >= 10 ? 1 : 2)}h`;
}
