'use client';

/**
 * Standard upload for the whole Hub: same call as fetch(url, { method: 'POST', body }),
 * but it reports the percentage so the global UploadProgressBar can show it.
 * Returns a real Response, so callers keep using res.ok / res.json().
 */

/** Same cookie and header as proxy.ts and CsrfFetchPatch (double-submit CSRF). */
const CSRF_COOKIE = 'hph_csrf';
const CSRF_HEADER = 'x-hph-csrf';

function csrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const row = document.cookie.split('; ').find((part) => part.startsWith(`${CSRF_COOKIE}=`));
  return row ? decodeURIComponent(row.slice(CSRF_COOKIE.length + 1)) : null;
}

export interface UploadState {
  id: number;
  label: string;
  percent: number;
}

type Listener = (uploads: UploadState[]) => void;
let uploads: UploadState[] = [];
const listeners = new Set<Listener>();
let nextId = 1;

function emit() {
  const snapshot = [...uploads];
  listeners.forEach((listener) => listener(snapshot));
}

export function subscribeUploads(listener: Listener): () => void {
  listeners.add(listener);
  listener([...uploads]);
  return () => {
    listeners.delete(listener);
  };
}

function fileLabel(body: BodyInit | null | undefined): string {
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    for (const value of body.values()) {
      if (typeof File !== 'undefined' && value instanceof File) return value.name;
    }
  }
  return 'file';
}

export function uploadWithProgress(
  url: string,
  /** silent: no global progress bar; the caller shows progress itself (chat rings, WhatsApp-style). */
  init: RequestInit & { onProgress?: (percent: number) => void; label?: string; silent?: boolean } = {}
): Promise<Response> {
  const id = nextId++;
  const silent = init.silent === true;
  if (!silent) {
    uploads = [...uploads, { id, label: init.label ?? fileLabel(init.body), percent: 0 }];
    emit();
  }
  const update = (percent: number) => {
    if (!silent) {
      uploads = uploads.map((u) => (u.id === id ? { ...u, percent } : u));
      emit();
    }
    init.onProgress?.(percent);
  };
  const done = () => {
    if (silent) return;
    uploads = uploads.filter((u) => u.id !== id);
    emit();
  };

  return new Promise<Response>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(init.method ?? 'POST', url);
    xhr.withCredentials = init.credentials !== 'omit';
    const headers = new Headers(init.headers);
    // XMLHttpRequest skips the fetch patch (components/security/CsrfFetchPatch.tsx), so add the
    // CSRF header here too; without it proxy.ts answers 403 "CSRF token is required".
    const csrf = csrfToken();
    if (csrf && !headers.has(CSRF_HEADER)) headers.set(CSRF_HEADER, csrf);
    headers.forEach((value, key) => xhr.setRequestHeader(key, value));
    xhr.upload.onprogress = (event) => {
      // Keep 99% until the server answers (it still saves the file).
      if (event.lengthComputable) update(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      update(100);
      window.setTimeout(done, 400);
      const headers = new Headers();
      const type = xhr.getResponseHeader('content-type');
      if (type) headers.set('content-type', type);
      const status = xhr.status >= 200 && xhr.status <= 599 ? xhr.status : 500;
      resolve(new Response(status === 204 ? null : xhr.responseText, { status, headers }));
    };
    xhr.onerror = () => {
      done();
      reject(new TypeError('Upload failed. Check your connection and try again.'));
    };
    xhr.onabort = () => {
      done();
      reject(new DOMException('Upload cancelled', 'AbortError'));
    };
    init.signal?.addEventListener('abort', () => xhr.abort());
    xhr.send((init.body as XMLHttpRequestBodyInit | null | undefined) ?? null);
  });
}
