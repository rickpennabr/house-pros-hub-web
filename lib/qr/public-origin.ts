/**
 * Host encoded by every QR. A local dev server must not print localhost,
 * because a phone cannot open that, and a live deploy must not keep a
 * localhost value from NEXT_PUBLIC_SITE_URL.
 */
export function publicOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? ''
  if (configured && !/localhost|127\.0\.0\.1/i.test(configured)) return configured
  return 'https://houseproshub.com'
}

/** Absolute public URL for a site path such as /en/business/the-paver-pro. */
export function publicPageUrl(path: string): string {
  const origin = publicOrigin()
  if (!path || path === '/') return `${origin}/`
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${origin}${normalized}`
}
