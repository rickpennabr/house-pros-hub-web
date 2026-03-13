/**
 * Optional analytics ingest for debug/experiments.
 * Only sends when NEXT_PUBLIC_ANALYTICS_INGEST_URL is set, so the app does not
 * trigger ERR_CONNECTION_REFUSED when the ingest server is not running.
 */
const INGEST_URL = process.env.NEXT_PUBLIC_ANALYTICS_INGEST_URL;

export interface AnalyticsIngestPayload {
  location: string;
  message: string;
  data: unknown;
  timestamp: number;
  sessionId?: string;
  runId?: string;
  hypothesisId?: string;
}

export function sendAnalyticsIngest(payload: AnalyticsIngestPayload): void {
  if (!INGEST_URL || typeof window === 'undefined') return;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 100);

  fetch(INGEST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: controller.signal,
  })
    .catch(() => {})
    .finally(() => clearTimeout(timeoutId));
}
