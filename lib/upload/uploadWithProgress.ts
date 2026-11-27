'use client';

/**
 * Standard upload for the whole Hub: same call as fetch(url, { method: 'POST', body }),
 * but it reports the percentage so the global UploadProgressBar can show it.
 * Returns a real Response, so callers keep using res.ok / res.json().
 */

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
  init: RequestInit & { onProgress?: (percent: number) => void; label?: string } = {}
): Promise<Response> {
  const id = nextId++;
  uploads = [...uploads, { id, label: init.label ?? fileLabel(init.body), percent: 0 }];
  emit();
  const update = (percent: number) => {
    uploads = uploads.map((u) => (u.id === id ? { ...u, percent } : u));
    emit();
    init.onProgress?.(percent);
  };
  const done = () => {
    uploads = uploads.filter((u) => u.id !== id);
    emit();
  };

  return new Promise<Response>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(init.method ?? 'POST', url);
    xhr.withCredentials = init.credentials !== 'omit';
    if (init.headers) new Headers(init.headers).forEach((value, key) => xhr.setRequestHeader(key, value));
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
