/**
 * Save a remote or same-origin file to the device.
 * Cross-origin `download` on an <a> is ignored by browsers (they just open the URL).
 * Fetch → blob → object URL forces a real download when CORS allows it.
 */
export async function downloadFile(url: string, name?: string): Promise<void> {
  const safeName = (name || 'download').replace(/[/\\?%*:|"<>]/g, '-').trim() || 'download';
  const response = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-store' });
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = href;
    link.download = safeName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(href), 60_000);
  }
}
