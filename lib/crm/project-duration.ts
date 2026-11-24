/** Planned length from start to end, counting both days (Nov 23 to Nov 26 is 4 days). */
export function projectDurationText(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return '';
  const days = Math.round((Date.parse(`${end.slice(0, 10)}T00:00:00Z`) - Date.parse(`${start.slice(0, 10)}T00:00:00Z`)) / 86_400_000) + 1;
  if (!Number.isFinite(days) || days < 1) return '';
  if (days < 14) return `${days} day${days === 1 ? '' : 's'}`;
  const weeks = Math.round((days / 7) * 10) / 10;
  return `${weeks} weeks (${days} days)`;
}
